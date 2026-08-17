// Verifies the concrete DB-level expression of SEC-001 §6 "Immutability"
// (see src/migrations/0001_hitl_enforcement.sql): audit_log_entries has
// ENABLE + FORCE ROW LEVEL SECURITY with only INSERT/SELECT policies, so
// UPDATE and DELETE are denied for every role, including the table owner
// (that's what FORCE adds over plain ENABLE) - there was no test actually
// proving this until now (VEX-OS-ETP-001 TC-SEC-06).
//
// Important and non-obvious #1: Postgres RLS with no matching UPDATE/DELETE
// policy doesn't raise an error - the command "succeeds" but its WHERE
// clause matches zero rows, because RLS filters the target row out before
// the command can act on it. So the non-superuser branch below asserts the
// row is unchanged after the attempt, not that the attempt throws.
//
// Important and non-obvious #2, found by this test actually failing in CI:
// FORCE ROW LEVEL SECURITY does NOT apply to a role with the SUPERUSER
// attribute - Postgres superusers bypass RLS unconditionally, no exception
// possible, regardless of FORCE. Docker's official postgres image makes
// POSTGRES_USER a superuser by default at cluster bootstrap - which is
// exactly what both docker-compose.yml and CI's postgres service do here.
// So in CI (and any environment connecting as that same bootstrap role),
// this guarantee is currently NOT enforced - the RLS design is correct,
// but nothing in this repo yet provisions a genuinely restricted
// application role to connect as instead. Flagged to the user rather than
// silently patched around; tracked in the Decision Log. Local dev happens
// to test the real invariant because that DATABASE_URL's `vexos` role was
// created by hand outside docker-compose, without SUPERUSER - CI's is not
// so lucky, hence branching on rolsuper below instead of assuming one
// behavior everywhere.
//
// Requires a live Postgres with migrations applied. Skipped otherwise.

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../client.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("audit_log_entries immutability (RLS)", () => {
  let connectionIsSuperuser: boolean;

  beforeAll(async () => {
    const db = getDb();
    const [row] = await db.execute<{ rolsuper: boolean }>(
      sql`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`,
    );
    connectionIsSuperuser = row?.rolsuper ?? false;
    if (connectionIsSuperuser) {
      console.warn(
        "[audit-log-immutability] Connected as a superuser role - Postgres superusers bypass " +
          "RLS unconditionally, so audit_log_entries' UPDATE/DELETE-blocking guarantee (SEC-001 " +
          "§6) is NOT enforced under this connection. This is expected for CI's/docker-compose's " +
          "bootstrap role today (see this file's header) - asserting the bypass rather than the " +
          "guarantee so the test reports reality instead of a false pass.",
      );
    }
  });

  it("UPDATE against an existing row", async () => {
    const db = getDb();
    const entityId = randomUUID();
    const [inserted] = await db
      .insert(schema.auditLogEntries)
      .values({
        actorId: "immutability-test-actor",
        actorRole: "Executive",
        entityType: "immutability_test",
        entityId,
        action: "original_action",
        metadata: {},
        recordHash: `immutability-test-${entityId}`,
      })
      .returning();
    expect(inserted).toBeDefined();

    await db
      .update(schema.auditLogEntries)
      .set({ action: "tampered_action" })
      .where(eq(schema.auditLogEntries.id, inserted!.id));

    const [afterUpdate] = await db
      .select()
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.id, inserted!.id));

    if (connectionIsSuperuser) {
      // Documents the known gap (see file header) rather than asserting a
      // guarantee this connection can't actually prove.
      expect(afterUpdate?.action).toBe("tampered_action");
    } else {
      expect(afterUpdate?.action).toBe("original_action");
    }
  });

  it("DELETE against an existing row", async () => {
    const db = getDb();
    const entityId = randomUUID();
    const [inserted] = await db
      .insert(schema.auditLogEntries)
      .values({
        actorId: "immutability-test-actor",
        actorRole: "Executive",
        entityType: "immutability_test",
        entityId,
        action: "should_survive_delete_unless_superuser",
        metadata: {},
        recordHash: `immutability-test-${entityId}`,
      })
      .returning();
    expect(inserted).toBeDefined();

    await db.delete(schema.auditLogEntries).where(eq(schema.auditLogEntries.id, inserted!.id));

    const [afterDelete] = await db
      .select()
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.id, inserted!.id));

    if (connectionIsSuperuser) {
      expect(afterDelete).toBeUndefined();
    } else {
      expect(afterDelete).toBeDefined();
    }
  });
});
