// API-001 §2.5 task endpoints, mounted at /api/v1/tasks. Read access
// (list/detail) is Executive+Delegate via resolveAccessibleExecutiveIds
// (PRD §3.2: a Delegate needs visibility into task status alongside the
// HITL queue); cancel stays Executive-only - the PRD doesn't hand task
// cancellation to a Delegate anywhere, and it's the kind of judgment call
// that shouldn't default to "yes" without that being explicit.

import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { resolveAccessibleExecutiveIds } from "../domains/delegates/resolve-accessible-executive-ids.js";

export const tasksRoute = new Hono<{ Variables: AuthedVariables }>();

tasksRoute.get("/", requireRole("Executive", "Delegate"), async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  if (accessibleExecutiveIds.length === 0) return c.json(ok([]));

  const agentId = c.req.query("agentId");
  const statusFilter = c.req.query("status");

  const conditions = [inArray(schema.tasks.executiveId, accessibleExecutiveIds)];
  if (agentId) conditions.push(eq(schema.tasks.agentId, agentId));
  if (statusFilter) {
    conditions.push(
      eq(schema.tasks.status, statusFilter as (typeof schema.tasks.status.enumValues)[number]),
    );
  }

  const rows = await getDb()
    .select()
    .from(schema.tasks)
    .where(and(...conditions))
    .orderBy(desc(schema.tasks.createdAt));

  return c.json(ok(rows));
});

tasksRoute.get("/:taskId", requireRole("Executive", "Delegate"), async (c) => {
  const accessibleExecutiveIds = await resolveAccessibleExecutiveIds(c.get("user"));
  const [task] = await getDb()
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, c.req.param("taskId")!));
  if (!task || !accessibleExecutiveIds.includes(task.executiveId)) {
    return c.json(fail("NOT_FOUND", "Task not found."), 404);
  }

  const [output] = await getDb()
    .select()
    .from(schema.taskOutputs)
    .where(eq(schema.taskOutputs.taskId, task.id))
    .orderBy(desc(schema.taskOutputs.createdAt))
    .limit(1);

  return c.json(ok({ ...task, output: output ?? null }));
});

tasksRoute.delete("/:taskId", requireRole("Executive"), async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const [task] = await getDb()
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, c.req.param("taskId")!));
  if (!task || task.executiveId !== executive.id) {
    return c.json(fail("NOT_FOUND", "Task not found."), 404);
  }
  if (task.status !== "queued" && task.status !== "in_progress") {
    return c.json(
      fail("INVALID_STATE", `Task is "${task.status}" and can no longer be cancelled.`),
      409,
    );
  }

  // The BullMQ job itself isn't removed from the queue (removing an
  // in-flight job mid-execution isn't a clean operation in BullMQ). If it's
  // already been picked up by a worker, executeTask's guarded updates
  // (WHERE status != 'cancelled') stop it from clobbering this status back
  // to "complete" - but any TaskOutput/HITLQueueItem it had already
  // produced before noticing the cancellation stay as-is; cancellation is
  // best-effort, not a hard interrupt of work already in flight.
  const [cancelled] = await getDb()
    .update(schema.tasks)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(schema.tasks.id, task.id))
    .returning();

  return c.json(ok(cancelled));
});
