// DB-gated. Unlike most route tests, successful responses here are raw
// files (CSV/JSON), not the {success, data, error} envelope - see
// compliance.ts's header for why.
//
// No cleanup for the audit_log_entries rows this file creates (directly or
// via the routes it calls) - audit_log_entries is RLS-immutable by design
// (SEC-001 §6, proved in packages/database's
// audit-log-immutability.test.ts), so a db.delete() against it has no
// effect for any role this app ever connects as. Rows just accumulate
// harmlessly, same as audit-logger.test.ts already does.

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { AuditLogger } from "@nyxor/audit";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const hasDb = Boolean(process.env.DATABASE_URL);

interface AuditRow {
  id: string;
  entityType: string;
  action: string;
}
interface ApiErrorEnvelope {
  error: { code: string; message: string } | null;
}

describe.skipIf(!hasDb)("compliance routes", () => {
  let createApp: typeof import("../app").createApp;
  let signToken: Awaited<ReturnType<typeof createTestJwtSigner>>["signToken"];
  const logger = new AuditLogger();

  beforeAll(async () => {
    const signer = await createTestJwtSigner();
    process.env.JWT_PUBLIC_KEY = signer.publicKeyPem;
    signToken = signer.signToken;
    ({ createApp } = await import("../app"));
  });

  async function adminToken(label: string) {
    return signToken({
      email: `compliance-admin-${label}-${Date.now()}@example.com`,
      role: "Administrator",
    });
  }

  async function seedEntry(entityType: string) {
    const entityId = randomUUID();
    await logger.log({
      actorId: "seed-actor",
      actorRole: "Executive",
      entityType,
      entityId,
      action: "seed_action",
    });
    return entityId;
  }

  // Every successful (200) export call writes its own real
  // "audit_log_exported" row (compliance.ts's self-log requirement) -
  // sequential single-writer test execution (vitest.config.ts's
  // fileParallelism: false) means the most recent one by timestamp right
  // after a call is reliably the one that call just created.
  async function mostRecentExportLogEntityId(): Promise<string> {
    const db = getDb();
    const [row] = await db
      .select({ entityId: schema.auditLogEntries.entityId })
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.action, "audit_log_exported"))
      .orderBy(desc(schema.auditLogEntries.timestamp))
      .limit(1);
    return row!.entityId;
  }

  it("rejects a non-Administrator (Executive)", async () => {
    const app = createApp();
    const token = await signToken({
      email: `compliance-exec-${Date.now()}@example.com`,
      role: "Executive",
    });
    const res = await app.request("/api/v1/compliance/audit-export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("rejects a non-Administrator (Delegate)", async () => {
    const app = createApp();
    const token = await signToken({
      email: `compliance-delegate-${Date.now()}@example.com`,
      role: "Delegate",
    });
    const res = await app.request("/api/v1/compliance/audit-export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/compliance/audit-export");
    expect(res.status).toBe(401);
  });

  it("returns a JSON array by default, filtered by entityType, as a downloadable attachment", async () => {
    const app = createApp();
    const marker = `export-json-${Date.now()}`;
    await seedEntry(marker);
    await seedEntry("unrelated-type");

    const res = await app.request(`/api/v1/compliance/audit-export?entityType=${marker}`, {
      headers: { Authorization: `Bearer ${await adminToken("json")}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");

    const rows = (await res.json()) as AuditRow[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.entityType === marker)).toBe(true);
  });

  it("returns CSV when format=csv", async () => {
    const app = createApp();
    const marker = `export-csv-${Date.now()}`;
    await seedEntry(marker);

    const res = await app.request(
      `/api/v1/compliance/audit-export?format=csv&entityType=${marker}`,
      {
        headers: { Authorization: `Bearer ${await adminToken("csv")}` },
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toContain("record_hash");
    expect(csv).toContain(marker);
  });

  it("returns 400 for an invalid format value", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/compliance/audit-export?format=xml", {
      headers: { Authorization: `Bearer ${await adminToken("bad-format")}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorEnvelope;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a malformed date", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/compliance/audit-export?from=not-a-date", {
      headers: { Authorization: `Bearer ${await adminToken("bad-date")}` },
    });
    expect(res.status).toBe(400);
  });

  it("audit-logs the export event itself, with filters and row count in metadata", async () => {
    const app = createApp();
    const marker = `export-selflog-${Date.now()}`;
    await seedEntry(marker);

    const res = await app.request(`/api/v1/compliance/audit-export?entityType=${marker}`, {
      headers: { Authorization: `Bearer ${await adminToken("self-log")}` },
    });
    expect(res.status).toBe(200);

    const loggedEntityId = await mostRecentExportLogEntityId();
    const [logged] = await getDb()
      .select()
      .from(schema.auditLogEntries)
      .where(eq(schema.auditLogEntries.entityId, loggedEntityId));
    expect(logged!.entityType).toBe("audit_export");
    expect(logged!.action).toBe("audit_log_exported");
    expect(logged!.metadata).toMatchObject({ entityType: marker, format: "json", rowCount: 1 });
  });
});
