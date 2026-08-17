// SAD-001 §4.6 Export row, mounted at /api/v1/compliance. Administrator
// role only (SEC-001 §3.2). Unlike every other route in this API, the
// success response here is NOT the {success, data, error} envelope - this
// endpoint produces a downloadable file (CSV or JSON), and CSV can't hold
// that shape at all, so JSON is kept consistent with CSV as a raw file
// rather than half-conforming to the general convention.

import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { fail } from "@vex-os/shared";
import { logTaskEvent } from "@vex-os/audit";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import {
  queryAuditLogForExport,
  serializeForCsvExport,
  serializeForJsonExport,
} from "../domains/compliance/export-audit-log.js";

// jwtMiddleware is applied via app.ts's v1.use("/compliance/*", ...),
// same as every other route except integrations.ts's special-cased
// unauthenticated-callback split. requireRole lives here, matching
// agents.ts/briefs.ts/dashboard.ts's convention.
export const complianceRoute = new Hono<{ Variables: AuthedVariables }>();

complianceRoute.use("*", requireRole("Administrator"));

const ExportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  entityType: z.string().min(1).optional(),
});

complianceRoute.get("/audit-export", async (c) => {
  const parsed = ExportQuerySchema.safeParse({
    format: c.req.query("format") ?? undefined,
    from: c.req.query("from") ?? undefined,
    to: c.req.query("to") ?? undefined,
    entityType: c.req.query("entityType") ?? undefined,
  });
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid export query parameters.", parsed.error.flatten()),
      400,
    );
  }
  const { format, from, to, entityType } = parsed.data;

  const rows = await queryAuditLogForExport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    entityType,
  });

  // The export event itself is audit-logged (SAD-001 §4.6) - it has no
  // natural single entity to attach to (it's a query over the whole log,
  // not an action on one record), so a fresh UUID identifies this specific
  // export operation; the filters and result size go in metadata.
  const admin = c.get("user");
  await logTaskEvent({
    actorId: admin.sub,
    actorRole: admin.role,
    entityType: "audit_export",
    entityId: randomUUID(),
    action: "audit_log_exported",
    metadata: {
      format,
      from: from ?? null,
      to: to ?? null,
      entityType: entityType ?? null,
      rowCount: rows.length,
    },
  });

  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return c.body(serializeForCsvExport(rows), 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vex-os-audit-export-${filenameDate}.csv"`,
    });
  }

  return c.body(JSON.stringify(serializeForJsonExport(rows), null, 2), 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="vex-os-audit-export-${filenameDate}.json"`,
  });
});
