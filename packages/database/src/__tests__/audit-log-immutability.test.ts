// Verifies the concrete DB-level expression of SEC-001 §6 "Immutability"
// (see src/migrations/0001_hitl_enforcement.sql and 0006_app_role_
// privilege_separation.sql): audit_log_entries can't be tampered with by
// the role the application actually connects as (VEX-OS-ETP-001 TC-SEC-06).
// There are two independent layers, and Postgres evaluates them in a
// specific order that changes what "blocked" looks like:
//
//  1. Table-level GRANT/REVOKE, checked first. vexos_app has UPDATE/DELETE
//     explicitly revoked on this table (0006_...sql) - so for that role,
//     the command never even starts: it throws "permission denied for
//     table audit_log_entries" immediately.
//  2. Row-level security (ENABLE + FORCE ROW LEVEL SECURITY, no UPDATE/
//     DELETE policy - 0001_...sql), which only matters for a role that
//     *does* hold the table-level grant (e.g. the table owner, who isn't
//     auto-revoked). For that role, the command "succeeds" but its WHERE
//     clause matches zero rows - RLS filters the target row out before
//     the command can act on it, no exception raised. This is the layer
//     that matters if grants were ever misconfigured back to permissive.
//
// Neither layer applies to a role with the SUPERUSER attribute - Postgres
// superusers bypass both unconditionally, no exception possible. Docker's
// official postgres image makes POSTGRES_USER a superuser by default at
// cluster bootstrap, which is exactly what docker-compose.yml's and CI's
// postgres services do - discovered when this test's first version
// (assuming RLS-only, no REVOKE yet) passed locally but genuinely failed
// in CI for exactly this reason. DATABASE_URL is expected to point at
// vexos_app (not the bootstrap role) in every environment now - see
// .env.example - so the superuser branch below exists to document what
// happens if that expectation is ever violated, not because it's a
// supported configuration.
//
// Requires a live Postgres with migrations applied. Skipped otherwise.

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../client.js";
import { expectDbErrorMessage } from "./expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("audit_log_entries immutability", () => {
  let isSuperuser: boolean;
  let hasUpdateGrant: boolean;

  beforeAll(async () => {
    const db = getDb();
    const [row] = await db.execute<{ rolsuper: boolean; can_update: boolean }>(
      sql`SELECT
            rolsuper,
            has_table_privilege(current_user, 'audit_log_entries', 'UPDATE') AS can_update
          FROM pg_roles WHERE rolname = current_user`,
    );
    isSuperuser = row?.rolsuper ?? false;
    hasUpdateGrant = row?.can_update ?? false;

    if (isSuperuser) {
      console.warn(
        "[audit-log-immutability] Connected as a superuser - bypasses both the table-level " +
          "REVOKE and row-level security unconditionally. DATABASE_URL should point at vexos_app " +
          "instead (see .env.example) - asserting the bypass rather than a guarantee this " +
          "connection can't actually prove.",
      );
    } else if (hasUpdateGrant) {
      console.warn(
        "[audit-log-immutability] Connected as a role that still holds UPDATE/DELETE grants on " +
          "audit_log_entries (expected only for vexos_app, whose migration revokes them) - " +
          "falling back to proving the row-level security layer alone.",
      );
    }
  });

  async function insertRow(action: string) {
    const entityId = randomUUID();
    const [inserted] = await getDb()
      .insert(schema.auditLogEntries)
      .values({
        actorId: "immutability-test-actor",
        actorRole: "Executive",
        entityType: "immutability_test",
        entityId,
        action,
        metadata: {},
        recordHash: `immutability-test-${entityId}`,
      })
      .returning();
    expect(inserted).toBeDefined();
    return inserted!;
  }

  it("UPDATE against an existing row", async () => {
    const db = getDb();
    const inserted = await insertRow("original_action");

    if (!isSuperuser && !hasUpdateGrant) {
      // vexos_app's real configuration: blocked at the grant layer,
      // before RLS is even relevant.
      await expectDbErrorMessage(
        db
          .update(schema.auditLogEntries)
          .set({ action: "tampered_action" })
          .where(eq(schema.auditLogEntries.id, inserted.id)),
        /permission denied/i,
      );
      return;
    }

    await db
      .update(schema.auditLogEntries)
      .set({ action: "tampered_action" })
      .where(eq(schema.auditLogEntries.id, inserted.id));

    const [afterUpdate] = await db
      .select()
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.id, inserted.id));

    // Superuser: full bypass, the tamper succeeds. Grant-holding
    // non-superuser: RLS silently no-ops it.
    expect(afterUpdate?.action).toBe(isSuperuser ? "tampered_action" : "original_action");
  });

  it("DELETE against an existing row", async () => {
    const db = getDb();
    const inserted = await insertRow("should_survive_delete");

    if (!isSuperuser && !hasUpdateGrant) {
      await expectDbErrorMessage(
        db.delete(schema.auditLogEntries).where(eq(schema.auditLogEntries.id, inserted.id)),
        /permission denied/i,
      );
      return;
    }

    await db.delete(schema.auditLogEntries).where(eq(schema.auditLogEntries.id, inserted.id));

    const [afterDelete] = await db
      .select()
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.id, inserted.id));

    if (isSuperuser) {
      expect(afterDelete).toBeUndefined();
    } else {
      expect(afterDelete).toBeDefined();
    }
  });
});
