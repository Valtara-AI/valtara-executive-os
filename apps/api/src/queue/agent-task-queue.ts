// TASK-01 / SAD §4.2: "agent task execution dispatched via queue." The job
// payload is intentionally just the task id - the task row (inserted
// before enqueuing, status "queued") is the single source of truth for
// what to execute; the worker reads everything else from the DB rather
// than trusting a potentially-stale copy carried in the job payload.

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const AGENT_TASK_QUEUE_NAME = "agent-tasks";

export interface AgentTaskJobData {
  taskId: string;
}

let sharedQueue: Queue<AgentTaskJobData> | undefined;

export function getAgentTaskQueue(): Queue<AgentTaskJobData> {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue<AgentTaskJobData>(AGENT_TASK_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      // TASK-05: exponential backoff, max 3 retries for transient failures.
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      // Job records aren't the audit trail (packages/audit is); no need to
      // keep them in Redis indefinitely once they've completed.
      removeOnComplete: { age: 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  });
  return sharedQueue;
}

export async function enqueueAgentTask(taskId: string): Promise<void> {
  await getAgentTaskQueue().add("execute", { taskId });
}
