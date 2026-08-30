// Mounted at /api/v1/personal-development. Read access for Executive +
// Delegate (same reasoning as briefs.ts - a Delegate reviewing on the
// executive's behalf plausibly wants to see this too); status mutation
// (marking something in-progress/completed/dismissed) is Executive-only -
// this is the executive's own self-directed reading list, not something a
// Delegate acts on for them.

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@nyxor/database";
import { fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { resolveAccessibleExecutiveIds } from "../domains/delegates/resolve-accessible-executive-ids.js";

export const personalDevelopmentRoute = new Hono<{ Variables: AuthedVariables }>();

personalDevelopmentRoute.use("*", requireRole("Executive", "Delegate"));

const StatusFilterSchema = z.enum(["suggested", "in_progress", "completed", "dismissed"]);

async function resolveTargetExecutiveId(
  accessibleExecutiveIds: string[],
  requestedExecutiveId: string | undefined,
): Promise<string | undefined> {
  if (requestedExecutiveId) {
    return accessibleExecutiveIds.includes(requestedExecutiveId) ? requestedExecutiveId : undefined;
  }
  return accessibleExecutiveIds[0];
}

personalDevelopmentRoute.get("/", async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  const executiveId = await resolveTargetExecutiveId(
    accessibleExecutiveIds,
    c.req.query("executiveId"),
  );
  if (!executiveId) return c.json(ok([]));

  const statusFilterParse = StatusFilterSchema.safeParse(c.req.query("status"));
  const conditions = [eq(schema.personalDevelopmentRecommendations.executiveId, executiveId)];
  if (statusFilterParse.success) {
    conditions.push(eq(schema.personalDevelopmentRecommendations.status, statusFilterParse.data));
  }

  const rows = await getDb()
    .select()
    .from(schema.personalDevelopmentRecommendations)
    .where(and(...conditions))
    .orderBy(desc(schema.personalDevelopmentRecommendations.recommendedAt));

  return c.json(ok(rows));
});

const UpdateStatusSchema = z.object({
  status: z.enum(["in_progress", "completed", "dismissed"]),
});

personalDevelopmentRoute.patch("/:id", requireRole("Executive"), async (c) => {
  const { id: executiveId } = await resolveExecutive(c.get("user"));
  const db = getDb();

  const parsed = UpdateStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const [updated] = await db
    .update(schema.personalDevelopmentRecommendations)
    .set({ status: parsed.data.status, statusUpdatedAt: new Date() })
    .where(
      and(
        eq(schema.personalDevelopmentRecommendations.id, c.req.param("id")!),
        eq(schema.personalDevelopmentRecommendations.executiveId, executiveId),
      ),
    )
    .returning();
  if (!updated) {
    return c.json(fail("NOT_FOUND", "Recommendation not found."), 404);
  }
  return c.json(ok(updated));
});
