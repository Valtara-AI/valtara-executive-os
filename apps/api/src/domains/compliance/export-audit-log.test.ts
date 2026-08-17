// Requires a live Postgres. Uses packages/audit's real AuditLogger so the
// rows under test are genuine chain-linked entries, not hand-built fixtures.

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { AuditLogger } from "@vex-os/audit";
import {
  queryAuditLogForExport,
  serializeForCsvExport,
  serializeForJsonExport,
} from "./export-audit-log.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("export-audit-log", () => {
  const logger = new AuditLogger();
  const cleanupEntityIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const entityId of cleanupEntityIds.splice(0)) {
      await db.delete(schema.auditLogEntries).where(eq(schema.auditLogEntries.entityId, entityId));
    }
  });

  async function logEntry(overrides?: {
    entityType?: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const entityId = randomUUID();
    cleanupEntityIds.push(entityId);
    return logger.log({
      actorId: overrides?.actorId ?? "actor-1",
      actorRole: "Executive",
      entityType: overrides?.entityType ?? "compliance_export_test",
      entityId,
      action: "test_action",
      metadata: overrides?.metadata,
    });
  }

  it("filters by entityType", async () => {
    const marker = `type-${Date.now()}`;
    await logEntry({ entityType: marker });
    await logEntry({ entityType: "some_other_type" });

    const rows = await queryAuditLogForExport({ entityType: marker });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.entityType === marker)).toBe(true);
  });

  it("filters by date range", async () => {
    const marker = `range-${Date.now()}`;
    const before = await logEntry({ entityType: marker });
    const from = new Date(Date.now() + 60_000); // an hour-scale window strictly after `before`

    const rows = await queryAuditLogForExport({ entityType: marker, from });
    expect(rows.find((r) => r.id === before.id)).toBeUndefined();
  });

  it("orders results chronologically ascending", async () => {
    const marker = `order-${Date.now()}`;
    const first = await logEntry({ entityType: marker });
    const second = await logEntry({ entityType: marker });

    const rows = await queryAuditLogForExport({ entityType: marker });
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  it("serializeForJsonExport produces plain objects with ISO timestamps", async () => {
    const marker = `json-${Date.now()}`;
    await logEntry({ entityType: marker, metadata: { note: "hello" } });

    const rows = await queryAuditLogForExport({ entityType: marker });
    const json = serializeForJsonExport(rows);
    expect(json[0]!.entityType).toBe(marker);
    expect(typeof json[0]!.timestamp).toBe("string");
    expect(json[0]!.metadata).toEqual({ note: "hello" });
  });

  // Minimal RFC 4180 field splitter for a single CSV line - used to verify
  // round-trip correctness (parse the line back, confirm the metadata
  // field decodes to the original object) rather than pattern-matching
  // the raw escaped text, which gets confusing once JSON.stringify's own
  // backslash-escaping of the embedded quote is layered under the CSV
  // layer's doubled-quote escaping.
  function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  }

  it("serializeForCsvExport quotes fields containing commas/quotes/newlines, and round-trips correctly", async () => {
    const marker = `csv-${Date.now()}`;
    const metadata = { note: 'has, a comma and a "quote"\nand a newline' };
    await logEntry({ entityType: marker, metadata });

    const rows = await queryAuditLogForExport({ entityType: marker });
    const csv = serializeForCsvExport(rows);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe(
      "id,timestamp,actor_id,actor_role,entity_type,entity_id,action,input_hash,output_hash,metadata,prev_hash,record_hash",
    );
    expect(lines).toHaveLength(2);

    const fields = parseCsvLine(lines[1]!);
    expect(fields[4]).toBe(marker); // entity_type
    expect(JSON.parse(fields[9]!)).toEqual(metadata); // metadata round-trips exactly
  });

  it("serializeForCsvExport produces just the header row for no data", () => {
    expect(serializeForCsvExport([]).trim()).toBe(
      "id,timestamp,actor_id,actor_role,entity_type,entity_id,action,input_hash,output_hash,metadata,prev_hash,record_hash",
    );
  });
});
