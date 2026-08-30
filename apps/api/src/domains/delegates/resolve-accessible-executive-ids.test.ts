// Requires a live Postgres. This is the actual authorization boundary for
// every Executive+Delegate route, so its edge cases matter more than most.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import type { JwtPayload } from "@nyxor/shared";
import { resolveAccessibleExecutiveIds } from "./resolve-accessible-executive-ids.js";

const hasDb = Boolean(process.env.DATABASE_URL);

function fakeUser(overrides: Partial<JwtPayload>): JwtPayload {
  return {
    sub: "sub-" + Math.random().toString(36).slice(2),
    email: "unused@example.com",
    role: "Executive",
    iat: 0,
    exp: 0,
    ...overrides,
  };
}

describe.skipIf(!hasDb)("resolveAccessibleExecutiveIds", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  it("Executive: resolves to their own (find-or-create) executive id only", async () => {
    const email = `exec-${Date.now()}@example.com`;
    const ids = await resolveAccessibleExecutiveIds(fakeUser({ role: "Executive", email }));
    expect(ids).toHaveLength(1);

    const db = getDb();
    const [created] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    cleanupExecutiveIds.push(created!.id);
    expect(ids).toEqual([created!.id]);
  });

  it("Administrator: resolves to an empty array (no access to executive content)", async () => {
    const ids = await resolveAccessibleExecutiveIds(
      fakeUser({ role: "Administrator", email: `admin-${Date.now()}@example.com` }),
    );
    expect(ids).toEqual([]);
  });

  it("Delegate: resolves to executives with an accepted link, excluding pending and revoked", async () => {
    const db = getDb();
    const delegateEmail = `delegate-${Date.now()}@example.com`;

    const [accepted] = await db
      .insert(schema.executives)
      .values({ name: "Accepted", email: `a-${Date.now()}@example.com` })
      .returning();
    const [pending] = await db
      .insert(schema.executives)
      .values({ name: "Pending", email: `p-${Date.now()}@example.com` })
      .returning();
    const [revoked] = await db
      .insert(schema.executives)
      .values({ name: "Revoked", email: `r-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(accepted!.id, pending!.id, revoked!.id);

    await db.insert(schema.delegateLinks).values([
      { executiveId: accepted!.id, delegateEmail, status: "accepted" },
      { executiveId: pending!.id, delegateEmail, status: "pending" },
      { executiveId: revoked!.id, delegateEmail, status: "revoked" },
    ]);

    const ids = await resolveAccessibleExecutiveIds(
      fakeUser({ role: "Delegate", email: delegateEmail }),
    );
    expect(ids).toEqual([accepted!.id]);
  });

  it("Delegate: matches their email case-insensitively", async () => {
    const db = getDb();
    const delegateEmail = `case-delegate-${Date.now()}@example.com`;
    const [owner] = await db
      .insert(schema.executives)
      .values({ name: "O", email: `co-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(owner!.id);
    await db
      .insert(schema.delegateLinks)
      .values({ executiveId: owner!.id, delegateEmail, status: "accepted" });

    const ids = await resolveAccessibleExecutiveIds(
      fakeUser({ role: "Delegate", email: delegateEmail.toUpperCase() }),
    );
    expect(ids).toEqual([owner!.id]);
  });

  it("Delegate: resolves to an empty array when they have no accepted links", async () => {
    const ids = await resolveAccessibleExecutiveIds(
      fakeUser({ role: "Delegate", email: `no-links-${Date.now()}@example.com` }),
    );
    expect(ids).toEqual([]);
  });
});
