// API-001 §2.6 HITL queue endpoints, mounted at /api/v1/hitl/queue.
//
// Same Delegate-access gap noted in routes/agents.ts: SRS describes
// Delegates managing the HITL queue on an executive's behalf, but no
// Executive-Delegate relationship exists in the schema to authorize that
// against. Executive-role-only until that data model exists.
//
// "Triggers downstream action" (HITL-02) is honestly scoped to what Sprint
// 2 can do: no real external integrations exist yet (Gmail/Slack/etc. are
// Sprint 4+), so approving an item finalizes it within VEX-OS (marks the
// TaskOutput approved, audit-logs it) rather than actually sending or
// posting anything anywhere.

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@vex-os/database";
import { fail, ok } from "@vex-os/shared";
import { logHitlEvent } from "@vex-os/audit";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const hitlRoute = new Hono<{ Variables: AuthedVariables }>();

hitlRoute.use("*", requireRole("Executive"));

async function loadOwnedPendingItem(executiveId: string, itemId: string) {
  const [item] = await getDb()
    .select()
    .from(schema.hitlQueueItems)
    .where(eq(schema.hitlQueueItems.id, itemId));
  if (!item || item.executiveId !== executiveId) return undefined;
  return item;
}

hitlRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const statusFilter = c.req.query("status") ?? "pending";

  const conditions = [eq(schema.hitlQueueItems.executiveId, executive.id)];
  if (statusFilter !== "all") {
    conditions.push(
      eq(
        schema.hitlQueueItems.status,
        statusFilter as (typeof schema.hitlQueueItems.status.enumValues)[number],
      ),
    );
  }

  const rows = await getDb()
    .select()
    .from(schema.hitlQueueItems)
    .where(and(...conditions))
    .orderBy(desc(schema.hitlQueueItems.actionedAt));

  return c.json(ok(rows));
});

hitlRoute.get("/:itemId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const item = await loadOwnedPendingItem(executive.id, c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  return c.json(ok(item));
});

async function finalizeItem(
  itemId: string,
  taskOutputId: string | null,
  status: "approved" | "edited" | "rejected",
  patch: { finalOutput?: string; rejectionReason?: string },
  executiveId: string,
) {
  const db = getDb();

  const [updated] = await db
    .update(schema.hitlQueueItems)
    .set({ status, actionedAt: new Date(), actionedBy: executiveId, ...patch })
    .where(eq(schema.hitlQueueItems.id, itemId))
    .returning();

  if (taskOutputId) {
    await db
      .update(schema.taskOutputs)
      .set({ hitlStatus: status })
      .where(eq(schema.taskOutputs.id, taskOutputId));
  }

  return updated;
}

hitlRoute.post("/:itemId/approve", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const item = await loadOwnedPendingItem(executive.id, c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  if (item.status !== "pending") {
    return c.json(fail("INVALID_STATE", `Item is already "${item.status}".`), 409);
  }

  const updated = await finalizeItem(item.id, item.taskOutputId, "approved", {}, executive.id);

  await logHitlEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityId: item.id,
    action: "hitl_approved",
    input: { originalOutput: item.originalOutput },
  });

  return c.json(ok(updated));
});

const EditBodySchema = z.object({ finalOutput: z.string().min(1) });

hitlRoute.post("/:itemId/edit", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const item = await loadOwnedPendingItem(executive.id, c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  if (item.status !== "pending") {
    return c.json(fail("INVALID_STATE", `Item is already "${item.status}".`), 409);
  }

  const parsed = EditBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const updated = await finalizeItem(
    item.id,
    item.taskOutputId,
    "edited",
    { finalOutput: parsed.data.finalOutput },
    executive.id,
  );

  await logHitlEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityId: item.id,
    action: "hitl_edited",
    input: { originalOutput: item.originalOutput },
    output: { finalOutput: parsed.data.finalOutput },
  });

  return c.json(ok(updated));
});

const RejectBodySchema = z.object({ reason: z.string().optional() });

hitlRoute.post("/:itemId/reject", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const item = await loadOwnedPendingItem(executive.id, c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  if (item.status !== "pending") {
    return c.json(fail("INVALID_STATE", `Item is already "${item.status}".`), 409);
  }

  const parsed = RejectBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  // HITL-04's "agent notified for retry if retry_on_reject=true" isn't
  // implemented - Agent has no retry_on_reject field, and there's no
  // re-execution trigger wired from a rejection back into the task queue.
  const updated = await finalizeItem(
    item.id,
    item.taskOutputId,
    "rejected",
    { rejectionReason: parsed.data.reason },
    executive.id,
  );

  await logHitlEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityId: item.id,
    action: "hitl_rejected",
    input: { originalOutput: item.originalOutput },
    output: { reason: parsed.data.reason },
  });

  return c.json(ok(updated));
});
