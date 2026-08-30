import { Worker, type Job } from "bullmq";
import type { InferenceProvider } from "@nyxor/ai-orchestrator";
import { getRedisConnection } from "./connection.js";
import {
  PERSONAL_DEV_GENERATION_QUEUE_NAME,
  type PersonalDevGenerationJobData,
} from "./personal-dev-generation-queue.js";
import { generateRecommendations } from "../domains/personal-development/generate-recommendations.js";

// Optional provider override for tests - same pattern as
// createBriefGenerationWorker; a real worker process never passes one.
export function createPersonalDevGenerationWorker(
  provider?: InferenceProvider,
): Worker<PersonalDevGenerationJobData> {
  return new Worker<PersonalDevGenerationJobData>(
    PERSONAL_DEV_GENERATION_QUEUE_NAME,
    async (job: Job<PersonalDevGenerationJobData>) => {
      await generateRecommendations(job.data.executiveId, provider);
    },
    { connection: getRedisConnection() },
  );
}
