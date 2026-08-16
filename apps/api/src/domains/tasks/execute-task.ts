// TASK-01 through TASK-06 / SAD §4.3 (AI Orchestration Layer): assembles
// context, calls the LLM through the provider-agnostic adapter, and
// persists the result. Invoked by the BullMQ worker (queue/agent-task-worker.ts),
// not directly by any route handler - task creation only enqueues; this is
// where the work actually happens.
//
// Context assembly here is a deliberately partial implementation of SAD's
// ContextAssembler: executive identity + agent persona + Voice Profile.
// "Recent task outputs" and "integration data" context (the rest of
// ContextAssembler's stated scope) are deferred - the former needs a
// context-window budgeting strategy this Sprint doesn't build, and the
// latter doesn't exist until Sprint 4+'s integration adapters.

import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@vex-os/ai-orchestrator";
import { logTaskEvent } from "@vex-os/audit";
import type { HitlMode } from "@vex-os/shared";

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} not found.`);
    this.name = "TaskNotFoundError";
  }
}

export async function executeTask(
  taskId: string,
  provider: InferenceProvider = getInferenceProvider("default"),
): Promise<void> {
  const db = getDb();

  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  if (!task) throw new TaskNotFoundError(taskId);

  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, task.agentId));
  if (!agent)
    throw new Error(`Task ${taskId} references agent ${task.agentId}, which no longer exists.`);

  const [executive] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.id, task.executiveId));
  if (!executive) {
    throw new Error(
      `Task ${taskId} references executive ${task.executiveId}, which no longer exists.`,
    );
  }

  const voiceProfile = executive.voiceProfileId
    ? (
        await db
          .select()
          .from(schema.voiceProfiles)
          .where(eq(schema.voiceProfiles.id, executive.voiceProfileId))
      )[0]
    : undefined;

  await db.update(schema.tasks).set({ status: "in_progress" }).where(eq(schema.tasks.id, taskId));

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "task",
    entityId: taskId,
    action: "task_started",
    input: { agentId: agent.id, prompt: task.prompt },
  });

  const systemPrompt = await renderPrompt("agent-task/system.v1.hbs", {
    agent: {
      name: agent.name,
      description: agent.description,
      responsibilities: agent.responsibilities,
    },
    executiveName: executive.name,
    voiceProfile: voiceProfile
      ? {
          tone: voiceProfile.tone,
          formality: voiceProfile.formality,
          sentenceLength: voiceProfile.sentenceLength,
          vocabularyLevel: voiceProfile.vocabularyLevel,
          structuralPreferences: voiceProfile.structuralPreferences,
        }
      : undefined,
  });

  const result = await provider.complete({
    systemPrompt,
    messages: [{ role: "user", content: task.prompt }],
    maxOutputTokens: 2048,
  });

  const [taskOutput] = await db
    .insert(schema.taskOutputs)
    .values({
      taskId,
      modelProvider: result.provider,
      modelId: result.model,
      promptVersion: "agent-task/system.v1",
      outputText: result.content,
      tokensInput: result.inputTokens,
      tokensOutput: result.outputTokens,
      durationMs: result.latencyMs,
      // AW-06 (checkpoint) still needs review; autonomous_report bypasses
      // the queue entirely (HITL-06), so its output is auto-approved -
      // there's nothing left pending once the executive already chose that
      // HITL mode for this agent.
      hitlStatus: agent.hitlMode === "autonomous_report" ? "approved" : "pending",
    })
    .returning();
  if (!taskOutput) throw new Error("Failed to persist TaskOutput.");

  if (agent.hitlMode !== "autonomous_report") {
    await db.insert(schema.hitlQueueItems).values({
      taskOutputId: taskOutput.id,
      executiveId: executive.id,
      status: "pending",
      originalOutput: result.content,
    });
  }

  await db
    .update(schema.tasks)
    .set({
      status: resolveCompletionStatus(agent.hitlMode),
      completedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId));

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "task",
    entityId: taskId,
    action: "task_completed",
    output: {
      taskOutputId: taskOutput.id,
      tokensInput: result.inputTokens,
      tokensOutput: result.outputTokens,
    },
  });
}

// HITL-05: checkpoint mode leaves the task paused pending executive action
// rather than marking it fully complete. Sprint 2 executes agent tasks as a
// single LLM call (no multi-step orchestration yet), so "resuming" a
// checkpointed task isn't implemented - this status distinction is honest
// about that pause, not a claim that resumption exists.
function resolveCompletionStatus(hitlMode: HitlMode): "complete" | "at_checkpoint" {
  return hitlMode === "checkpoint" ? "at_checkpoint" : "complete";
}
