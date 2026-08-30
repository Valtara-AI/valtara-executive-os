// API-001 §2.7: GET /dashboard/summary. Unlike briefs.ts, this aggregates
// across every accessible executive rather than requiring a single target
// - the numbers here are counts, which sum sensibly for a Delegate serving
// more than one executive; brief *content* doesn't.

import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveAccessibleExecutiveIds } from "../domains/delegates/resolve-accessible-executive-ids.js";

export const dashboardRoute = new Hono<{ Variables: AuthedVariables }>();

dashboardRoute.use("*", requireRole("Executive", "Delegate"));

const ACTIVE_TASK_STATUSES: ("queued" | "in_progress" | "at_checkpoint")[] = [
  "queued",
  "in_progress",
  "at_checkpoint",
];

dashboardRoute.get("/summary", async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  if (accessibleExecutiveIds.length === 0) {
    return c.json(
      ok({ hitlQueueCount: 0, activeTaskCount: 0, pendingDecisionCount: 0, integrations: [] }),
    );
  }

  const db = getDb();

  const pendingHitlItems = await db
    .select({ id: schema.hitlQueueItems.id })
    .from(schema.hitlQueueItems)
    .where(
      and(
        inArray(schema.hitlQueueItems.executiveId, accessibleExecutiveIds),
        eq(schema.hitlQueueItems.status, "pending"),
      ),
    );

  const activeTasks = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(
      and(
        inArray(schema.tasks.executiveId, accessibleExecutiveIds),
        inArray(schema.tasks.status, ACTIVE_TASK_STATUSES),
      ),
    );

  return c.json(
    ok({
      hitlQueueCount: pendingHitlItems.length,
      activeTaskCount: activeTasks.length,
      // FR-DB-04's decision inbox ("populated from agent outputs, calendar
      // context, and communication analysis") isn't its own concept yet -
      // the HITL queue is currently the only source of "things needing
      // executive input" that's actually built, so this mirrors it rather
      // than fabricating a separate number.
      pendingDecisionCount: pendingHitlItems.length,
      // No integrations exist until Sprint 4+ (Gmail/Calendar/Outlook/Slack).
      integrations: [],
    }),
  );
});
