// Requires a live Postgres.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { inviteDelegate, normalizeEmail } from "./invite-delegate.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("inviteDelegate", () => {
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
      .values({ name: "E", email: `exec-${Date.now()}-${Math.random()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("creates a pending invitation, normalizing the email to lowercase", async () => {
    const executive = await makeExecutive();
    const link = await inviteDelegate(executive.id, "Delegate@Example.COM");
    expect(link.status).toBe("pending");
    expect(link.delegateEmail).toBe("delegate@example.com");
  });

  it("is idempotent for an already-pending invitation - returns the same row, doesn't duplicate", async () => {
    const executive = await makeExecutive();
    const first = await inviteDelegate(executive.id, "delegate@example.com");
    const second = await inviteDelegate(executive.id, "delegate@example.com");
    expect(second.id).toBe(first.id);

    const rows = await getDb()
      .select()
      .from(schema.delegateLinks)
      .where(eq(schema.delegateLinks.executiveId, executive.id));
    expect(rows).toHaveLength(1);
  });

  it("is a no-op for an already-accepted invitation - doesn't reset it to pending", async () => {
    const executive = await makeExecutive();
    const created = await inviteDelegate(executive.id, "delegate@example.com");
    await getDb()
      .update(schema.delegateLinks)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(schema.delegateLinks.id, created.id));

    const result = await inviteDelegate(executive.id, "delegate@example.com");
    expect(result.status).toBe("accepted");
  });

  it("reinstates a declined/revoked invitation back to pending", async () => {
    const executive = await makeExecutive();
    const created = await inviteDelegate(executive.id, "delegate@example.com");
    await getDb()
      .update(schema.delegateLinks)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(schema.delegateLinks.id, created.id));

    const result = await inviteDelegate(executive.id, "delegate@example.com");
    expect(result.id).toBe(created.id);
    expect(result.status).toBe("pending");
    expect(result.revokedAt).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
  });
});
