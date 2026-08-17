// Verifies the concrete DB-level expression of SEC-001 §6 "Immutability"
// (see src/migrations/0001_hitl_enforcement.sql): audit_log_entries has
// ENABLE + FORCE ROW LEVEL SECURITY with only INSERT/SELECT policies, so
// UPDATE and DELETE are denied for every role, including the table owner
// (that's what FORCE adds over plain ENABLE) - there was no test actually
// proving this until now (VEX-OS-ETP-001 TC-SEC-06).
//
// Important and non-obvious: Postgres RLS with no matching UPDATE/DELETE
// policy doesn't raise an error - the command "succeeds" but its WHERE
// clause matches zero rows, because RLS filters the target row out before
// the command can act on it. So this test asserts the row is unchanged
// after the attempt, not that the attempt throws. Confirmed by hand
// against local Postgres before writing this: `UPDATE ... WHERE id = ...`
// returns "UPDATE 0", not a permission-denied exception.
//
// A consequence of this being real: rows this test (or any test) inserts
// into audit_log_entries can never be cleaned up afterward, by any role
// the application ever connects as - that's the whole point of the
// guarantee. This test intentionally does not attempt afterEach/afterAll
// cleanup for that reason (see audit-logger.test.ts, which has never
// attempted it either); the one row it creates just becomes a permanent,
// harmless part of whatever database this runs against.
//
// Requires a live Postgres with migrations applied. Skipped otherwise.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../client.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("audit_log_entries immutability (RLS)", () => {
  it("UPDATE against an existing row has no effect", async () => {
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
    expect(afterUpdate?.action).toBe("original_action");
  });

  it("DELETE against an existing row has no effect", async () => {
    const db = getDb();
    const entityId = randomUUID();
    const [inserted] = await db
      .insert(schema.auditLogEntries)
      .values({
        actorId: "immutability-test-actor",
        actorRole: "Executive",
        entityType: "immutability_test",
        entityId,
        action: "should_survive_delete",
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
    expect(afterDelete).toBeDefined();
    expect(afterDelete?.action).toBe("should_survive_delete");
  });
});
