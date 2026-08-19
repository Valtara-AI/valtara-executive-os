// API-001 §2.4 agent endpoints, mounted at /api/v1/agents.
//
// Authorization note: SEC-001 §3.2 describes a Delegate role scoped to a
// specific executive's HITL queue, but no schema anywhere (Executive,
// or any join table) actually models a Delegate-to-Executive relationship
// - there's no way to answer "which executive is this Delegate delegated
// by" from the data model as it exists today. Rather than build an
// incomplete/unverifiable access path, agent management here is
// Executive-role-only; wiring in Delegate access is blocked on that data
// model decision, not on this route file.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@vex-os/database";
import {
  assertAgentLimit,
  assertCostBudget,
  assertTaskVolume,
  EntitlementError,
} from "@vex-os/billing";
import { HITL_MODES, fail, ok, type HitlMode } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { enqueueAgentTask } from "../queue/agent-task-queue.js";

export const agentsRoute = new Hono<{ Variables: AuthedVariables }>();

agentsRoute.use("*", requireRole("Executive"));

async function loadOwnedAgent(executiveId: string, agentId: string) {
  const [agent] = await getDb().select().from(schema.agents).where(eq(schema.agents.id, agentId));
  if (!agent || agent.executiveId !== executiveId) return undefined;
  return agent;
}

agentsRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const statusFilter = c.req.query("status");

  const rows = await getDb()
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.executiveId, executive.id));

  const filtered = statusFilter ? rows.filter((a) => a.status === statusFilter) : rows;
  return c.json(ok(filtered));
});

agentsRoute.get("/:agentId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const agent = await loadOwnedAgent(executive.id, c.req.param("agentId"));
  if (!agent) return c.json(fail("NOT_FOUND", "Agent not found."), 404);
  return c.json(ok(agent));
});

const CreateAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  responsibilities: z.array(z.string()).min(1),
  hitlMode: z.enum(HITL_MODES as [HitlMode, ...HitlMode[]]).default("auto_draft_review"),
});

agentsRoute.post("/", async (c) => {
  const parsed = CreateAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }
  const executive = await resolveExecutive(c.get("user"));

  try {
    await assertAgentLimit(executive.id);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return c.json(fail("ENTITLEMENT_LIMIT", err.message), 402);
    }
    throw err;
  }

  const [agent] = await getDb()
    .insert(schema.agents)
    .values({ executiveId: executive.id, ...parsed.data })
    .returning();
  return c.json(ok(agent), 201);
});

const UpdateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  responsibilities: z.array(z.string()).min(1).optional(),
  hitlMode: z.enum(HITL_MODES as [HitlMode, ...HitlMode[]]).optional(),
});

agentsRoute.patch("/:agentId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const agent = await loadOwnedAgent(executive.id, c.req.param("agentId"));
  if (!agent) return c.json(fail("NOT_FOUND", "Agent not found."), 404);

  const parsed = UpdateAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const [updated] = await getDb()
    .update(schema.agents)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.agents.id, agent.id))
    .returning();
  return c.json(ok(updated));
});

// Soft delete (archive) - API-001 §2.4: "tasks in progress completed before
// archival." Sprint 2's task model has no way to "complete before
// archival" mid-flight (no task cancellation-on-archive hook wired to the
// worker), so this only flips agent status; in-flight tasks for this agent
// run to their normal completion regardless.
agentsRoute.delete("/:agentId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const agent = await loadOwnedAgent(executive.id, c.req.param("agentId"));
  if (!agent) return c.json(fail("NOT_FOUND", "Agent not found."), 404);

  const [archived] = await getDb()
    .update(schema.agents)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(schema.agents.id, agent.id))
    .returning();
  return c.json(ok(archived));
});

const AssignTaskSchema = z.object({
  prompt: z.string().min(1),
});

agentsRoute.post("/:agentId/tasks", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const agent = await loadOwnedAgent(executive.id, c.req.param("agentId"));
  if (!agent) return c.json(fail("NOT_FOUND", "Agent not found."), 404);
  if (agent.status !== "active") {
    return c.json(fail("AGENT_ARCHIVED", "Cannot assign tasks to an archived agent."), 409);
  }

  const parsed = AssignTaskSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  try {
    await assertTaskVolume(executive.id);
    await assertCostBudget(executive.id);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return c.json(fail("ENTITLEMENT_LIMIT", err.message), 402);
    }
    throw err;
  }

  const [task] = await getDb()
    .insert(schema.tasks)
    .values({
      agentId: agent.id,
      executiveId: executive.id,
      prompt: parsed.data.prompt,
      status: "queued",
    })
    .returning();
  if (!task) throw new Error("Failed to persist task.");

  await enqueueAgentTask(task.id);

  return c.json(ok(task), 201);
});
