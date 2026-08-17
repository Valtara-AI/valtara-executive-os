// Requires a live Postgres (needs DB_ENCRYPTION_KEY too, for crypto.ts).

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { deleteTokens, getTokens, needsRefresh, saveTokens } from "./token-store.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("token-store", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  async function makeExecutive() {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Token Test Exec",
        email: `token-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("round-trips access token, refresh token, scopes, and expiry", async () => {
    const executive = await makeExecutive();
    const expiresAt = new Date(Date.now() + 3600_000);

    await saveTokens(executive.id, "google", {
      accessToken: "plaintext-access-token",
      refreshToken: "plaintext-refresh-token",
      scopes: ["scope-a", "scope-b"],
      expiresAt,
    });

    const tokens = await getTokens(executive.id, "google");
    expect(tokens?.accessToken).toBe("plaintext-access-token");
    expect(tokens?.refreshToken).toBe("plaintext-refresh-token");
    expect(tokens?.scopes).toEqual(["scope-a", "scope-b"]);
    expect(tokens?.expiresAt?.getTime()).toBe(expiresAt.getTime());
  });

  it("stores the access and refresh tokens encrypted, not in plaintext", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "super-secret-access-token",
      refreshToken: "super-secret-refresh-token",
      scopes: [],
      expiresAt: new Date(),
    });

    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.integrationTokens)
      .where(eq(schema.integrationTokens.executiveId, executive.id));
    expect(row?.accessTokenEncrypted).not.toContain("super-secret-access-token");
    expect(row?.refreshTokenEncrypted).not.toContain("super-secret-refresh-token");
    // Encrypted format: base64(iv).base64(authTag).base64(ciphertext)
    expect(row?.accessTokenEncrypted.split(".")).toHaveLength(3);
  });

  it("upserts on a second save rather than creating a duplicate row", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "first",
      scopes: [],
      expiresAt: new Date(),
    });
    await saveTokens(executive.id, "google", {
      accessToken: "second",
      scopes: [],
      expiresAt: new Date(),
    });

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.integrationTokens)
      .where(eq(schema.integrationTokens.executiveId, executive.id));
    expect(rows).toHaveLength(1);

    const tokens = await getTokens(executive.id, "google");
    expect(tokens?.accessToken).toBe("second");
  });

  it("returns undefined for an executive with no stored tokens", async () => {
    const executive = await makeExecutive();
    expect(await getTokens(executive.id, "google")).toBeUndefined();
  });

  it("deleteTokens removes the row", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "a",
      scopes: [],
      expiresAt: new Date(),
    });
    await deleteTokens(executive.id, "google");
    expect(await getTokens(executive.id, "google")).toBeUndefined();
  });

  it("keeps tokens for different providers independent", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "google-token",
      scopes: [],
      expiresAt: new Date(),
    });
    await saveTokens(executive.id, "microsoft", {
      accessToken: "microsoft-token",
      scopes: [],
      expiresAt: new Date(),
    });

    expect((await getTokens(executive.id, "google"))?.accessToken).toBe("google-token");
    expect((await getTokens(executive.id, "microsoft"))?.accessToken).toBe("microsoft-token");
  });
});

describe("needsRefresh", () => {
  it("is true when expiresAt is null", () => {
    expect(
      needsRefresh({ accessToken: "a", refreshToken: undefined, scopes: [], expiresAt: null }),
    ).toBe(true);
  });

  it("is true when expiring within 2 minutes", () => {
    const soon = new Date(Date.now() + 60_000);
    expect(
      needsRefresh({ accessToken: "a", refreshToken: undefined, scopes: [], expiresAt: soon }),
    ).toBe(true);
  });

  it("is false when expiry is well in the future", () => {
    const later = new Date(Date.now() + 3600_000);
    expect(
      needsRefresh({ accessToken: "a", refreshToken: undefined, scopes: [], expiresAt: later }),
    ).toBe(false);
  });
});
