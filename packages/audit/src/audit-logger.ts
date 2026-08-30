// AuditLogger service (SAD §4.6). Append-only: full input/output hashed
// (SHA-256) rather than stored raw in this table — "full input/output
// stored separately with reference hash" per SAD §4.6, meaning the raw
// payload lives in the relevant domain table (e.g.
// hitl_queue_items.original_output) and this table only holds the hash.
//
// Chain integrity (SEC-001 §6): each record's record_hash covers
// prev_hash + this record's own fields, so tampering with any historical
// record breaks every record_hash after it. A naive "read last hash, then
// insert" has a race under concurrent writers — two transactions could both
// read the same "last" row before either commits, producing two records
// with the same prev_hash (a fork, silently breaking the single-chain
// invariant). This is closed with a Postgres advisory lock scoping the
// read-then-insert to one writer at a time.

import { createHash } from "node:crypto";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import type { AuditLogEntry } from "@nyxor/shared";

// Arbitrary fixed key identifying "the audit log chain" as an advisory lock
// target. Any int64 works as long as it's unique to this lock's purpose
// within the application (no other code should lock this same key).
const AUDIT_LOG_CHAIN_LOCK_KEY = 727284001n;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface AuditLogInput {
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export class AuditLogger {
  async log(entry: AuditLogInput): Promise<AuditLogEntry> {
    const db = getDb();

    const inputHash = entry.input !== undefined ? sha256(JSON.stringify(entry.input)) : null;
    const outputHash = entry.output !== undefined ? sha256(JSON.stringify(entry.output)) : null;
    const metadata = entry.metadata ?? {};

    return db.transaction(async (tx) => {
      // Serializes the read-then-insert critical section across concurrent
      // writers for the lifetime of this transaction; released automatically
      // on commit/rollback.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_LOG_CHAIN_LOCK_KEY})`);

      const [lastEntry] = await tx
        .select({ recordHash: schema.auditLogEntries.recordHash })
        .from(schema.auditLogEntries)
        .orderBy(desc(schema.auditLogEntries.timestamp))
        .limit(1);

      const prevHash = lastEntry?.recordHash ?? null;

      const payload = JSON.stringify({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        inputHash,
        outputHash,
        metadata,
      });
      const recordHash = sha256((prevHash ?? "") + payload);

      const [inserted] = await tx
        .insert(schema.auditLogEntries)
        .values({
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          inputHash,
          outputHash,
          metadata,
          prevHash,
          recordHash,
        })
        .returning();

      if (!inserted) {
        throw new Error("Audit log insert returned no row.");
      }

      return {
        id: inserted.id,
        timestamp: inserted.timestamp.toISOString(),
        actorId: inserted.actorId,
        actorRole: inserted.actorRole,
        entityType: inserted.entityType,
        entityId: inserted.entityId,
        action: inserted.action,
        inputHash: inserted.inputHash,
        outputHash: inserted.outputHash,
        metadata: inserted.metadata as Record<string, unknown>,
        prevHash: inserted.prevHash,
        recordHash: inserted.recordHash,
      };
    });
  }
}
