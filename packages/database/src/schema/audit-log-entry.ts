import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Shape per VEX-OS-SAD-001 §4.6 (audit-layer spec, authoritative for
// implementation — see the note in packages/shared/src/types/entities.ts):
// {id, timestamp, actor_id, actor_role, entity_type, entity_id, action,
// input_hash, output_hash, metadata}, plus prev_hash/record_hash for the
// SHA-256 chain-integrity requirement (SEC-001 §6). Append-only: no
// updated_at column, and row-level security (added in the RLS migration)
// disables UPDATE/DELETE for every role including Administrator.
export const auditLogEntries = pgTable("audit_log_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  // text, not uuid (migration 0003+): actor_id originally assumed every
  // actor was an Executive (a real UUID). Now that Delegates can act too
  // (hitl.ts's resolveActorId), their identity is the JWT's `sub` claim -
  // an OAuth-provider-qualified string that isn't guaranteed to be
  // UUID-shaped (Google's subject ids are plain numeric strings; only
  // Microsoft's happen to look like GUIDs). uuid was too narrow a type for
  // "whoever actually did this" in general.
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  inputHash: text("input_hash"),
  outputHash: text("output_hash"),
  metadata: jsonb("metadata").notNull().default({}),
  prevHash: text("prev_hash"),
  recordHash: text("record_hash").notNull(),
});
