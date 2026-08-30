// SAD-001 §4.6's Export row: "Compliance export endpoint produces CSV and
// JSON; date-range and entity-type filters; accessible to Administrator
// role only; export event itself audit-logged." The route
// (routes/compliance.ts) owns the Administrator gate and the self-audit
// log entry; this module owns the query and the two serialization
// formats.

import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";

export interface AuditExportFilters {
  from?: Date;
  to?: Date;
  entityType?: string;
}

export type AuditLogRow = typeof schema.auditLogEntries.$inferSelect;

// A compliance export is expected to be scoped by date range for anything
// large - this cap is a safety backstop against an unscoped request
// pulling the entire table, not the primary way exports are expected to
// stay a reasonable size.
export const MAX_EXPORT_ROWS = 50_000;

export async function queryAuditLogForExport(filters: AuditExportFilters): Promise<AuditLogRow[]> {
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(schema.auditLogEntries.timestamp, filters.from));
  if (filters.to) conditions.push(lte(schema.auditLogEntries.timestamp, filters.to));
  if (filters.entityType)
    conditions.push(eq(schema.auditLogEntries.entityType, filters.entityType));

  return db
    .select()
    .from(schema.auditLogEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(schema.auditLogEntries.timestamp))
    .limit(MAX_EXPORT_ROWS);
}

export function serializeForJsonExport(rows: AuditLogRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    actorId: row.actorId,
    actorRole: row.actorRole,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    inputHash: row.inputHash,
    outputHash: row.outputHash,
    metadata: row.metadata,
    prevHash: row.prevHash,
    recordHash: row.recordHash,
  }));
}

const CSV_COLUMNS = [
  "id",
  "timestamp",
  "actor_id",
  "actor_role",
  "entity_type",
  "entity_id",
  "action",
  "input_hash",
  "output_hash",
  "metadata",
  "prev_hash",
  "record_hash",
] as const;

// RFC 4180: a field is quoted (and any embedded quote doubled) whenever it
// contains a comma, quote, or newline - metadata is a JSON blob, so it
// routinely contains all three.
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeForCsvExport(rows: AuditLogRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.timestamp.toISOString(),
        row.actorId,
        row.actorRole,
        row.entityType,
        row.entityId,
        row.action,
        row.inputHash,
        row.outputHash,
        JSON.stringify(row.metadata),
        row.prevHash,
        row.recordHash,
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }
  // Trailing CRLF per RFC 4180; also what most spreadsheet tools expect.
  return lines.join("\r\n") + "\r\n";
}
