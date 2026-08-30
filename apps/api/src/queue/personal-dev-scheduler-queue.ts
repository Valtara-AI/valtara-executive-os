// A single repeatable job, weekly - mirrors brief-scheduler-queue.ts's
// shape, minus the per-executive-timezone-window nuance (a weekly cadence
// doesn't need per-minute local-time precision the way "05:30 local" does).

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const PERSONAL_DEV_SCHEDULER_QUEUE_NAME = "personal-dev-scheduler";
const SCHEDULER_JOB_NAME = "check-due-personal-dev";

let sharedQueue: Queue | undefined;

export function getPersonalDevSchedulerQueue(): Queue {
  if (sharedQueue) return sharedQueue;
  sharedQueue = new Queue(PERSONAL_DEV_SCHEDULER_QUEUE_NAME, { connection: getRedisConnection() });
  return sharedQueue;
}

/**
 * Registers the repeatable weekly "check every executive's last batch" job.
 * Idempotent to call multiple times - BullMQ dedupes repeatable jobs with
 * the same name+pattern+key.
 */
export async function startPersonalDevScheduler(): Promise<void> {
  await getPersonalDevSchedulerQueue().add(
    SCHEDULER_JOB_NAME,
    {},
    { repeat: { pattern: "0 8 * * MON" }, jobId: SCHEDULER_JOB_NAME },
  );
}
