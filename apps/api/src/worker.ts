// Standalone process, separate from the HTTP server (index.ts) - SAD §4.2's
// "Background jobs" are their own deployable unit (Railway: a second
// service pointed at `npm run start:worker`, docker-compose: a second
// container from the same image with a different CMD). Runs all three
// worker types in one process for now (agent tasks, brief generation, the
// brief scheduler) - splitting them into separate deployable units is
// straightforward later if load ever justifies it, but there's no reason
// to pay that operational cost yet.

import { createAgentTaskWorker } from "./queue/agent-task-worker.js";
import { createBriefGenerationWorker } from "./queue/brief-generation-worker.js";
import { createBriefSchedulerWorker } from "./queue/brief-scheduler-worker.js";
import { startBriefScheduler } from "./queue/brief-scheduler-queue.js";
import { logger } from "./logger.js";

const agentTaskWorker = createAgentTaskWorker();
const briefGenerationWorker = createBriefGenerationWorker();
const briefSchedulerWorker = createBriefSchedulerWorker();
const workers = [agentTaskWorker, briefGenerationWorker, briefSchedulerWorker];

for (const worker of workers) {
  worker.on("error", (err) => {
    logger.error({ err: err.message, worker: worker.name }, "Worker error");
  });
}

await startBriefScheduler();
logger.info("VEX-OS worker ready (agent-tasks, brief-generation, brief-scheduler)");

async function shutdown() {
  logger.info("Worker shutting down");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
