// Mirrors agent-task-queue.ts's shape: one job per executive, generation
// itself (the LLM call + persistence) happens in the worker.

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const BRIEF_GENERATION_QUEUE_NAME = "brief-generation";

export interface BriefGenerationJobData {
  executiveId: string;
}

let sharedQueue: Queue<BriefGenerationJobData> | undefined;

export function getBriefGenerationQueue(): Queue<BriefGenerationJobData> {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue<BriefGenerationJobData>(BRIEF_GENERATION_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  });
  return sharedQueue;
}

export async function enqueueBriefGeneration(executiveId: string): Promise<void> {
  await getBriefGenerationQueue().add("generate", { executiveId });
}
