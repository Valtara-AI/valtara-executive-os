// API-001 §2.7 brief endpoints, mounted at /api/v1/briefs. Executive+
// Delegate read access via resolveAccessibleExecutiveIds, same pattern as
// tasks.ts - a Delegate reviewing on the executive's behalf plausibly
// wants the morning brief too, and nothing here is mutable so there's no
// judgment call to gate the way task cancellation was.

import { Hono } from "hono";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveAccessibleExecutiveIds } from "../domains/delegates/resolve-accessible-executive-ids.js";
import { localDateString } from "../domains/morning-brief/generate-brief.js";

export const briefsRoute = new Hono<{ Variables: AuthedVariables }>();

briefsRoute.use("*", requireRole("Executive", "Delegate"));

// Single-executive convention for this whole route: a Delegate serving
// multiple executives must specify which one via ?executiveId= (defaults
// to their first accessible executive otherwise, which is only ever
// unambiguous for an Executive themselves, who has exactly one).
async function resolveTargetExecutiveId(
  accessibleExecutiveIds: string[],
  requestedExecutiveId: string | undefined,
): Promise<string | undefined> {
  if (requestedExecutiveId) {
    return accessibleExecutiveIds.includes(requestedExecutiveId) ? requestedExecutiveId : undefined;
  }
  return accessibleExecutiveIds[0];
}

briefsRoute.get("/", async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  const executiveId = await resolveTargetExecutiveId(
    accessibleExecutiveIds,
    c.req.query("executiveId"),
  );
  if (!executiveId) return c.json(ok([]));

  // MB-05: 30-day rolling window.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select()
    .from(schema.morningBriefs)
    .where(
      and(
        eq(schema.morningBriefs.executiveId, executiveId),
        gte(schema.morningBriefs.generatedAt, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(schema.morningBriefs.generatedAt));

  return c.json(ok(rows));
});

briefsRoute.get("/today", async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  const executiveId = await resolveTargetExecutiveId(
    accessibleExecutiveIds,
    c.req.query("executiveId"),
  );
  if (!executiveId) return c.json(ok(null));

  const db = getDb();
  const [executive] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.id, executiveId));
  if (!executive) return c.json(ok(null));

  const today = localDateString(executive.timezone);
  const [brief] = await db
    .select()
    .from(schema.morningBriefs)
    .where(
      and(eq(schema.morningBriefs.executiveId, executiveId), eq(schema.morningBriefs.date, today)),
    );

  return c.json(ok(brief ?? null));
});

briefsRoute.get("/:briefId", async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  const [brief] = await getDb()
    .select()
    .from(schema.morningBriefs)
    .where(eq(schema.morningBriefs.id, c.req.param("briefId")!));
  if (!brief || !accessibleExecutiveIds.includes(brief.executiveId)) {
    return c.json(fail("NOT_FOUND", "Brief not found."), 404);
  }
  return c.json(ok(brief));
});
