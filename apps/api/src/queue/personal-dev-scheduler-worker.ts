import { Worker } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { PERSONAL_DEV_SCHEDULER_QUEUE_NAME } from "./personal-dev-scheduler-queue.js";
import { scheduleDueRecommendations } from "../domains/personal-development/schedule-recommendations.js";

export function createPersonalDevSchedulerWorker(): Worker {
  return new Worker(PERSONAL_DEV_SCHEDULER_QUEUE_NAME, async () => scheduleDueRecommendations(), {
    connection: getRedisConnection(),
  });
}
