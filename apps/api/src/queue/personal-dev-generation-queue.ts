// Mirrors brief-generation-queue.ts's shape exactly: one job per executive,
// generation itself happens in the worker.

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const PERSONAL_DEV_GENERATION_QUEUE_NAME = "personal-dev-generation";

export interface PersonalDevGenerationJobData {
  executiveId: string;
}

let sharedQueue: Queue<PersonalDevGenerationJobData> | undefined;

export function getPersonalDevGenerationQueue(): Queue<PersonalDevGenerationJobData> {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue<PersonalDevGenerationJobData>(PERSONAL_DEV_GENERATION_QUEUE_NAME, {
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

export async function enqueuePersonalDevGeneration(executiveId: string): Promise<void> {
  await getPersonalDevGenerationQueue().add("generate", { executiveId });
}
