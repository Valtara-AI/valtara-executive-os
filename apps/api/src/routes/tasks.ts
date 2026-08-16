// API-001 §2.5 task endpoints, mounted at /api/v1/tasks.

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const tasksRoute = new Hono<{ Variables: AuthedVariables }>();

tasksRoute.use("*", requireRole("Executive"));

tasksRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const agentId = c.req.query("agentId");
  const statusFilter = c.req.query("status");

  const conditions = [eq(schema.tasks.executiveId, executive.id)];
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

tasksRoute.get("/:taskId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const [task] = await getDb()
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, c.req.param("taskId")));
  if (!task || task.executiveId !== executive.id) {
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

tasksRoute.delete("/:taskId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const [task] = await getDb()
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, c.req.param("taskId")));
  if (!task || task.executiveId !== executive.id) {
    return c.json(fail("NOT_FOUND", "Task not found."), 404);
  }
  if (task.status !== "queued" && task.status !== "in_progress") {
    return c.json(
      fail("INVALID_STATE", `Task is "${task.status}" and can no longer be cancelled.`),
      409,
    );
  }

  // Cancels the task record; the BullMQ job itself isn't removed from the
  // queue (removing an in-flight job mid-execution isn't a clean operation
  // in BullMQ). If it's already been picked up by a worker, executeTask
  // will still run to completion and overwrite this "cancelled" status
  // with its real result - a genuine gap, since nothing checks task.status
  // before executeTask writes its outcome.
  const [cancelled] = await getDb()
    .update(schema.tasks)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(schema.tasks.id, task.id))
    .returning();

  return c.json(ok(cancelled));
});
