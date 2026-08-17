// Requires a live Postgres (token-store persistence) + DB_ENCRYPTION_KEY.
// Mocks the global fetch (the actual Google API call) so this is
// deterministic and needs no real Google credentials.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { saveTokens } from "../token-store.js";
import { googleApiFetch, InsufficientScopeError } from "./authenticated-fetch.js";
import { IntegrationNotConnectedError } from "../types.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("googleApiFetch", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function makeConnectedExecutive(overrides?: { expiresAt?: Date; refreshToken?: string }) {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Fetch Test Exec",
        email: `fetch-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    await saveTokens(executive!.id, "google", {
      accessToken: "initial-access-token",
      refreshToken: overrides?.refreshToken ?? "initial-refresh-token",
      scopes: ["scope-a"],
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 3600_000),
    });

    return executive!;
  }

  it("throws IntegrationNotConnectedError when no tokens are stored", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "No Tokens", email: `no-tokens-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    await expect(googleApiFetch(executive!.id, "https://example.com/api")).rejects.toThrow(
      IntegrationNotConnectedError,
    );
  });

  it("succeeds on the first attempt with a valid token, no refresh needed", async () => {
    const executive = await makeConnectedExecutive();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await googleApiFetch(executive.id, "https://example.com/api");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer initial-access-token" }),
      }),
    );
  });

  it("refreshes proactively when the stored token is near expiry, before making the call", async () => {
    const executive = await makeConnectedExecutive({ expiresAt: new Date(Date.now() + 30_000) });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "refreshed-token",
              expires_in: 3600,
              scope: "scope-a",
              token_type: "Bearer",
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await googleApiFetch(executive.id, "https://example.com/api");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer refreshed-token" }),
      }),
    );
  });

  it("retries once with a refreshed token on a 401", async () => {
    const executive = await makeConnectedExecutive();
    let apiCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "refreshed-after-401",
              expires_in: 3600,
              scope: "scope-a",
              token_type: "Bearer",
            }),
        });
      }
      apiCallCount++;
      if (apiCallCount === 1) return Promise.resolve({ ok: false, status: 401 });
      return Promise.resolve({ ok: true, status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await googleApiFetch(executive.id, "https://example.com/api");
    expect(res.status).toBe(200);
    expect(apiCallCount).toBe(2);
  });

  it("throws InsufficientScopeError on 403 without retrying", async () => {
    const executive = await makeConnectedExecutive();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleApiFetch(executive.id, "https://example.com/api")).rejects.toThrow(
      InsufficientScopeError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("backs off and retries on 429, respecting Retry-After, then succeeds", async () => {
    const executive = await makeConnectedExecutive();
    let apiCallCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      apiCallCount++;
      if (apiCallCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "0" }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, headers: new Headers() });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await googleApiFetch(executive.id, "https://example.com/api");
    expect(res.status).toBe(200);
    expect(apiCallCount).toBe(2);
  });

  it("retries transient 5xx errors up to the max, then throws", async () => {
    const executive = await makeConnectedExecutive();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleApiFetch(executive.id, "https://example.com/api")).rejects.toThrow(
      /after 3 attempts/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10000);
});
