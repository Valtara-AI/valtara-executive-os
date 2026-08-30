// TASK-05: transient failures get exponential backoff + retry (configured
// as job options in agent-task-queue.ts); this only marks the task row
// "failed" once BullMQ has exhausted all attempts, and keeps retryCount in
// sync with what BullMQ actually did along the way.

import { eq } from "drizzle-orm";
import { Worker, type Job } from "bullmq";
import { getDb, schema } from "@nyxor/database";
import { logTaskEvent } from "@nyxor/audit";
import type { InferenceProvider } from "@nyxor/ai-orchestrator";
import { getRedisConnection } from "./connection.js";
import { AGENT_TASK_QUEUE_NAME, type AgentTaskJobData } from "./agent-task-queue.js";
import { executeTask } from "../domains/tasks/execute-task.js";

// Optional provider override exists for tests (a real worker process never
// passes one, so executeTask falls back to its default - the real
// Anthropic provider via LLM_PROVIDER) - same pattern as the onboarding
// engine's startSession/complete.
export function createAgentTaskWorker(provider?: InferenceProvider): Worker<AgentTaskJobData> {
  const worker = new Worker<AgentTaskJobData>(
    AGENT_TASK_QUEUE_NAME,
    async (job: Job<AgentTaskJobData>) => {
      await executeTask(job.data.taskId, provider);
    },
    { connection: getRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    void handleJobFailed(job, err);
  });

  return worker;
}

async function handleJobFailed(job: Job<AgentTaskJobData> | undefined, err: Error): Promise<void> {
  if (!job) return;

  const db = getDb();
  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;
  const exhausted = attemptsMade >= maxAttempts;

  await db
    .update(schema.tasks)
    .set({
      retryCount: attemptsMade,
      ...(exhausted ? { status: "failed" as const, completedAt: new Date() } : {}),
    })
    .where(eq(schema.tasks.id, job.data.taskId));

  if (exhausted) {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, job.data.taskId));
    if (task) {
      await logTaskEvent({
        actorId: task.executiveId,
        actorRole: "Executive",
        entityType: "task",
        entityId: job.data.taskId,
        action: "task_failed",
        output: { error: err.message, attemptsMade },
      });
    }
  }
}
