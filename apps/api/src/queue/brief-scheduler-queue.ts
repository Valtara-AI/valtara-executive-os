// A single repeatable job, not one job per executive - the scheduler
// itself runs every 15 minutes and fans out to per-executive
// brief-generation jobs (see brief-generation-queue.ts) for whoever's
// actually in their generation window right now.

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const BRIEF_SCHEDULER_QUEUE_NAME = "brief-scheduler";
const SCHEDULER_JOB_NAME = "check-due-briefs";

let sharedQueue: Queue | undefined;

export function getBriefSchedulerQueue(): Queue {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue(BRIEF_SCHEDULER_QUEUE_NAME, { connection: getRedisConnection() });
  return sharedQueue;
}

/**
 * Registers the repeatable "check every executive's local time" job.
 * Idempotent to call multiple times (e.g. on every worker process start) -
 * BullMQ dedupes repeatable jobs with the same name+pattern+key.
 */
export async function startBriefScheduler(): Promise<void> {
  await getBriefSchedulerQueue().add(
    SCHEDULER_JOB_NAME,
    {},
    { repeat: { pattern: "*/15 * * * *" }, jobId: SCHEDULER_JOB_NAME },
  );
}
