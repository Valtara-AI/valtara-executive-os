// Requires a live Postgres. Verifies the precedence rules that decide what
// role apps/web mints a brand-new session with.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { resolveRoleForEmail } from "./resolve-role-for-email.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

describe.skipIf(!hasDb)("resolveRoleForEmail", () => {
  const cleanupExecutiveIds: string[] = [];
  const cleanupDelegateLinkEmails: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
    for (const email of cleanupDelegateLinkEmails.splice(0)) {
      await db.delete(schema.delegateLinks).where(eq(schema.delegateLinks.delegateEmail, email));
    }
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it("returns 'Executive' for a brand-new email with no history at all", async () => {
    const role = await resolveRoleForEmail(`brand-new-${Date.now()}@example.com`);
    expect(role).toBe("Executive");
  });

  it("returns 'Executive' when an Executive row already exists for the email", async () => {
    const db = getDb();
    const email = `existing-exec-${Date.now()}@example.com`;
    const [executive] = await db.insert(schema.executives).values({ name: "E", email }).returning();
    cleanupExecutiveIds.push(executive!.id);

    expect(await resolveRoleForEmail(email)).toBe("Executive");
  });

  it("returns 'Delegate' for an email with a pending delegate invitation and no Executive row", async () => {
    const db = getDb();
    const ownerEmail = `owner-${Date.now()}@example.com`;
    const delegateEmail = `pending-delegate-${Date.now()}@example.com`;
    cleanupDelegateLinkEmails.push(delegateEmail);

    const [owner] = await db
      .insert(schema.executives)
      .values({ name: "O", email: ownerEmail })
      .returning();
    cleanupExecutiveIds.push(owner!.id);
    await db.insert(schema.delegateLinks).values({ executiveId: owner!.id, delegateEmail });

    expect(await resolveRoleForEmail(delegateEmail)).toBe("Delegate");
  });

  it("returns 'Delegate' even when the invitation hasn't been accepted yet", async () => {
    // Mirrors the prior test's setup but asserts explicitly on status to
    // make the "pending is enough" behavior unambiguous, not incidental.
    const db = getDb();
    const ownerEmail = `owner2-${Date.now()}@example.com`;
    const delegateEmail = `pending-delegate2-${Date.now()}@example.com`;
    cleanupDelegateLinkEmails.push(delegateEmail);

    const [owner] = await db
      .insert(schema.executives)
      .values({ name: "O", email: ownerEmail })
      .returning();
    cleanupExecutiveIds.push(owner!.id);
    const [link] = await db
      .insert(schema.delegateLinks)
      .values({ executiveId: owner!.id, delegateEmail })
      .returning();
    expect(link?.status).toBe("pending");

    expect(await resolveRoleForEmail(delegateEmail)).toBe("Delegate");
  });

  it("prefers 'Executive' when both an Executive row and a delegate invitation exist for the same email", async () => {
    const db = getDb();
    const ownerEmail = `owner3-${Date.now()}@example.com`;
    const bothEmail = `both-${Date.now()}@example.com`;
    cleanupDelegateLinkEmails.push(bothEmail);

    const [owner] = await db
      .insert(schema.executives)
      .values({ name: "O", email: ownerEmail })
      .returning();
    cleanupExecutiveIds.push(owner!.id);
    await db
      .insert(schema.delegateLinks)
      .values({ executiveId: owner!.id, delegateEmail: bothEmail });

    const [both] = await db
      .insert(schema.executives)
      .values({ name: "Both", email: bothEmail })
      .returning();
    cleanupExecutiveIds.push(both!.id);

    expect(await resolveRoleForEmail(bothEmail)).toBe("Executive");
  });

  it("returns 'Administrator' for an email in ADMIN_EMAILS, ahead of any Executive/Delegate history", async () => {
    const db = getDb();
    const email = `admin-${Date.now()}@example.com`;
    process.env.ADMIN_EMAILS = `someone-else@example.com, ${email} ,another@example.com`;

    // Even with an Executive row for the same email, ADMIN_EMAILS wins -
    // it's an explicit operator decision, not incidental account history.
    const [executive] = await db.insert(schema.executives).values({ name: "E", email }).returning();
    cleanupExecutiveIds.push(executive!.id);

    expect(await resolveRoleForEmail(email)).toBe("Administrator");
  });

  it("matches ADMIN_EMAILS case-insensitively", async () => {
    const email = `Mixed-Admin-${Date.now()}@Example.com`;
    process.env.ADMIN_EMAILS = email.toLowerCase();

    expect(await resolveRoleForEmail(email.toUpperCase())).toBe("Administrator");
  });

  it("returns 'Executive' when ADMIN_EMAILS is unset or doesn't match", async () => {
    delete process.env.ADMIN_EMAILS;
    expect(await resolveRoleForEmail(`not-admin-${Date.now()}@example.com`)).toBe("Executive");
  });

  it("matches case-insensitively", async () => {
    const db = getDb();
    const ownerEmail = `owner4-${Date.now()}@example.com`;
    const delegateEmail = `Mixed-Case-${Date.now()}@Example.com`;
    cleanupDelegateLinkEmails.push(delegateEmail.toLowerCase());

    const [owner] = await db
      .insert(schema.executives)
      .values({ name: "O", email: ownerEmail })
      .returning();
    cleanupExecutiveIds.push(owner!.id);
    await db
      .insert(schema.delegateLinks)
      .values({ executiveId: owner!.id, delegateEmail: delegateEmail.toLowerCase() });

    expect(await resolveRoleForEmail(delegateEmail.toUpperCase())).toBe("Delegate");
  });
});
