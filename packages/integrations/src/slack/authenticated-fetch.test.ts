// Requires a live Postgres (token-store persistence) + DB_ENCRYPTION_KEY.
// Unlike google/microsoft's authenticated-fetch tests, several cases here
// exercise Slack's HTTP-200-but-ok:false error shape rather than HTTP
// status codes - see authenticated-fetch.ts's header for why that
// distinction matters.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { saveTokens } from "../token-store.js";
import { InsufficientScopeError, SlackApiError, slackApiFetch } from "./authenticated-fetch.js";
import { IntegrationNotConnectedError } from "../types.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("slackApiFetch", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
    vi.restoreAllMocks();
  });

  async function makeConnectedExecutive(overrides?: { expiresAt?: Date; refreshToken?: string }) {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Slack Fetch Test Exec",
        email: `slack-fetch-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    await saveTokens(executive!.id, "slack", {
      accessToken: "xoxb-initial",
      refreshToken: overrides?.refreshToken,
      scopes: ["channels:read"],
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
    });

    return executive!;
  }

  it("throws IntegrationNotConnectedError when no tokens are stored", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "No Tokens", email: `no-tokens-slack-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    await expect(slackApiFetch(executive!.id, "conversations.list")).rejects.toThrow(
      IntegrationNotConnectedError,
    );
  });

  it("returns the parsed body on ok: true, using a POST with the Bearer token", async () => {
    const executive = await makeConnectedExecutive();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, channels: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = await slackApiFetch(executive.id, "conversations.list");
    expect(body).toEqual({ ok: true, channels: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/conversations.list",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer xoxb-initial" }),
      }),
    );
  });

  it("throws InsufficientScopeError on ok:false with error missing_scope, despite HTTP 200", async () => {
    const executive = await makeConnectedExecutive();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false, error: "missing_scope" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(slackApiFetch(executive.id, "chat.postMessage")).rejects.toThrow(
      InsufficientScopeError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with a refreshed token on ok:false invalid_auth, if a refresh token is stored", async () => {
    const executive = await makeConnectedExecutive({ refreshToken: "xoxe-refresh" });
    let apiCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("oauth.v2.access")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ ok: true, access_token: "xoxb-refreshed", scope: "channels:read" }),
        });
      }
      apiCallCount++;
      if (apiCallCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: false, error: "invalid_auth" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, channels: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = await slackApiFetch(executive.id, "conversations.list");
    expect(body).toEqual({ ok: true, channels: [] });
    expect(apiCallCount).toBe(2);
  });

  it("throws SlackApiError for any other application-level error", async () => {
    const executive = await makeConnectedExecutive();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "channel_not_found" }),
      }),
    );

    await expect(slackApiFetch(executive.id, "chat.postMessage")).rejects.toThrow(SlackApiError);
  });

  it("backs off and retries on real HTTP 429, respecting Retry-After, then succeeds", async () => {
    const executive = await makeConnectedExecutive();
    let apiCallCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      apiCallCount++;
      if (apiCallCount === 1) {
        return Promise.resolve({ status: 429, headers: new Headers({ "Retry-After": "0" }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ ok: true, channels: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = await slackApiFetch(executive.id, "conversations.list");
    expect(body).toEqual({ ok: true, channels: [] });
    expect(apiCallCount).toBe(2);
  });
});
