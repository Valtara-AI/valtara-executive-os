import { Worker, type Job } from "bullmq";
import type { InferenceProvider } from "@nyxor/ai-orchestrator";
import { getRedisConnection } from "./connection.js";
import {
  BRIEF_GENERATION_QUEUE_NAME,
  type BriefGenerationJobData,
} from "./brief-generation-queue.js";
import { generateBrief } from "../domains/morning-brief/generate-brief.js";

// Optional provider override for tests - same pattern as
// createAgentTaskWorker; a real worker process never passes one.
export function createBriefGenerationWorker(
  provider?: InferenceProvider,
): Worker<BriefGenerationJobData> {
  return new Worker<BriefGenerationJobData>(
    BRIEF_GENERATION_QUEUE_NAME,
    async (job: Job<BriefGenerationJobData>) => {
      await generateBrief(job.data.executiveId, provider);
    },
    { connection: getRedisConnection() },
  );
}
