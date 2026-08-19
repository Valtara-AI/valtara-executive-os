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

import { and, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@vex-os/ai-orchestrator";
import { logTaskEvent } from "@vex-os/audit";
import { sendHitlReviewNotification, sendTaskCompleteNotification } from "@vex-os/notifications";
import type { HitlMode } from "@vex-os/shared";
import { logger } from "../../logger.js";

// Fire-and-forget by design: a failed notification (missing RESEND_API_KEY,
// Resend rejecting the recipient, a transient network error) must never
// fail the task itself - the task's real work (the LLM call, the
// TaskOutput/HITLQueueItem rows) is already durably persisted by the time
// either of these is called. Logged, not re-thrown.
async function notifySafely(send: () => Promise<{ error: string | null }>): Promise<void> {
  try {
    const { error } = await send();
    if (error) logger.warn({ err: error }, "Notification email failed to send");
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Notification email failed to send");
  }
}

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

  // Guarded transition, not a plain write: closes the race where
  // DELETE /tasks/:taskId cancels a task after enqueueing but before a
  // worker picks it up. `ne(status, "cancelled")` rather than requiring
  // exactly "queued" so a BullMQ retry (still "in_progress" from the first
  // attempt) is allowed to proceed - only an explicit cancellation blocks
  // it. Zero rows updated means it was cancelled first; skip execution
  // entirely rather than spending an LLM call on it.
  const [claimed] = await db
    .update(schema.tasks)
    .set({ status: "in_progress" })
    .where(and(eq(schema.tasks.id, taskId), ne(schema.tasks.status, "cancelled")))
    .returning();
  if (!claimed) return;

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
    await notifySafely(() =>
      sendHitlReviewNotification({
        to: executive.email,
        executiveName: executive.name,
        agentName: agent.name,
        taskPrompt: task.prompt,
      }),
    );
  }

  // Same guard as the initial transition, for the window where cancellation
  // happens *during* the LLM call. The TaskOutput/HITLQueueItem above are
  // already written by this point regardless - cancellation is best-effort
  // (it stops the task's status from being clobbered back to "complete"),
  // not a hard interrupt of work already in flight. The executive can still
  // see and reject the HITL item if they don't want it.
  const [finalized] = await db
    .update(schema.tasks)
    .set({
      status: resolveCompletionStatus(agent.hitlMode),
      completedAt: new Date(),
    })
    .where(and(eq(schema.tasks.id, taskId), ne(schema.tasks.status, "cancelled")))
    .returning();
  if (!finalized) return;

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

  // autonomous_report is the one mode with no HITL queue item and
  // therefore no other signal the executive would ever see without
  // opening the dashboard - this is that mode's "completion report
  // delivered" (CLAUDE.md's own description of it).
  if (agent.hitlMode === "autonomous_report") {
    await notifySafely(() =>
      sendTaskCompleteNotification({
        to: executive.email,
        executiveName: executive.name,
        agentName: agent.name,
        taskPrompt: task.prompt,
        outputText: result.content,
      }),
    );
  }
}

// HITL-05: checkpoint mode leaves the task paused pending executive action
// rather than marking it fully complete. Sprint 2 executes agent tasks as a
// single LLM call (no multi-step orchestration yet), so "resuming" a
// checkpointed task isn't implemented - this status distinction is honest
// about that pause, not a claim that resumption exists.
function resolveCompletionStatus(hitlMode: HitlMode): "complete" | "at_checkpoint" {
  return hitlMode === "checkpoint" ? "at_checkpoint" : "complete";
}
