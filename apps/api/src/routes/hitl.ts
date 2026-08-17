// API-001 §2.6 HITL queue endpoints, mounted at /api/v1/hitl/queue.
// Executive and Delegate both get access (PRD §3.2: a Delegate "reviews
// agent outputs on behalf of the executive... manages HITL approval
// queue") via resolveAccessibleExecutiveIds - an Executive sees only their
// own items, a Delegate sees every executive with an *accepted* link to
// their email.
//
// hitl_queue_items.actioned_by is FK'd to executives.id, so it always
// records the *owning* executive regardless of who actually clicked
// (a Delegate has no executives row to point it at). The real actor -
// Delegate or Executive - is recorded in the audit log's actorId/actorRole
// instead, which has no such FK constraint.
//
// "Triggers downstream action" (HITL-02) is honestly scoped to what's
// built so far: no real external integrations exist yet (Gmail/Slack/etc.
// are Sprint 4+), so approving an item finalizes it within VEX-OS (marks
// the TaskOutput approved, audit-logs it) rather than actually sending or
// posting anything anywhere.

import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@vex-os/database";
import { fail, ok, type JwtPayload } from "@vex-os/shared";
import { logHitlEvent } from "@vex-os/audit";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { resolveAccessibleExecutiveIds } from "../domains/delegates/resolve-accessible-executive-ids.js";

export const hitlRoute = new Hono<{ Variables: AuthedVariables }>();

hitlRoute.use("*", requireRole("Executive", "Delegate"));

// Executives have an executives.id; Delegates don't (they never go through
// onboarding). This is what actually identifies the acting user in the
// audit log - resolveExecutive()'s id for an Executive, the JWT's stable
// subject claim for a Delegate.
async function resolveActorId(user: JwtPayload): Promise<string> {
  if (user.role === "Executive") return (await resolveExecutive(user)).id;
  return user.sub;
}

async function loadAccessibleItem(user: JwtPayload, itemId: string) {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(user);
  if (accessibleExecutiveIds.length === 0) return undefined;

  const [item] = await getDb()
    .select()
    .from(schema.hitlQueueItems)
    .where(eq(schema.hitlQueueItems.id, itemId));
  if (!item || !accessibleExecutiveIds.includes(item.executiveId)) return undefined;
  return item;
}

hitlRoute.get("/", async (c) => {
  const user = c.get("user");
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(user);
  if (accessibleExecutiveIds.length === 0) return c.json(ok([]));

  const statusFilter = c.req.query("status") ?? "pending";
  const conditions = [inArray(schema.hitlQueueItems.executiveId, accessibleExecutiveIds)];
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
  const item = await loadAccessibleItem(c.get("user"), c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  return c.json(ok(item));
});

async function finalizeItem(
  itemId: string,
  taskOutputId: string | null,
  status: "approved" | "edited" | "rejected",
  patch: { finalOutput?: string; rejectionReason?: string },
  owningExecutiveId: string,
) {
  const db = getDb();

  const [updated] = await db
    .update(schema.hitlQueueItems)
    .set({ status, actionedAt: new Date(), actionedBy: owningExecutiveId, ...patch })
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
  const user = c.get("user");
  const item = await loadAccessibleItem(user, c.req.param("itemId"));
  if (!item) return c.json(fail("NOT_FOUND", "HITL queue item not found."), 404);
  if (item.status !== "pending") {
    return c.json(fail("INVALID_STATE", `Item is already "${item.status}".`), 409);
  }

  const updated = await finalizeItem(item.id, item.taskOutputId, "approved", {}, item.executiveId);

  await logHitlEvent({
    actorId: await resolveActorId(user),
    actorRole: user.role,
    entityId: item.id,
    action: "hitl_approved",
    input: { originalOutput: item.originalOutput },
  });

  return c.json(ok(updated));
});

const EditBodySchema = z.object({ finalOutput: z.string().min(1) });

hitlRoute.post("/:itemId/edit", async (c) => {
  const user = c.get("user");
  const item = await loadAccessibleItem(user, c.req.param("itemId"));
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
    item.executiveId,
  );

  await logHitlEvent({
    actorId: await resolveActorId(user),
    actorRole: user.role,
    entityId: item.id,
    action: "hitl_edited",
    input: { originalOutput: item.originalOutput },
    output: { finalOutput: parsed.data.finalOutput },
  });

  return c.json(ok(updated));
});

const RejectBodySchema = z.object({ reason: z.string().optional() });

hitlRoute.post("/:itemId/reject", async (c) => {
  const user = c.get("user");
  const item = await loadAccessibleItem(user, c.req.param("itemId"));
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
    item.executiveId,
  );

  await logHitlEvent({
    actorId: await resolveActorId(user),
    actorRole: user.role,
    entityId: item.id,
    action: "hitl_rejected",
    input: { originalOutput: item.originalOutput },
    output: { reason: parsed.data.reason },
  });

  return c.json(ok(updated));
});
