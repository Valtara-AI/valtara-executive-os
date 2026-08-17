import { Worker } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { BRIEF_SCHEDULER_QUEUE_NAME } from "./brief-scheduler-queue.js";
import { scheduleDueBriefs } from "../domains/morning-brief/schedule-briefs.js";

export function createBriefSchedulerWorker(): Worker {
  return new Worker(BRIEF_SCHEDULER_QUEUE_NAME, async () => scheduleDueBriefs(), {
    connection: getRedisConnection(),
  });
}
