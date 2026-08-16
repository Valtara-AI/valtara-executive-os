// Standalone process, separate from the HTTP server (index.ts) - SAD §4.2's
// "Background jobs" are their own deployable unit (Railway: a second
// service pointed at `npm run start:worker`, docker-compose: a second
// container from the same image with a different CMD).

import { createAgentTaskWorker } from "./queue/agent-task-worker.js";
import { logger } from "./logger.js";

const worker = createAgentTaskWorker();

worker.on("ready", () => {
  logger.info("VEX-OS agent-task worker ready");
});

worker.on("error", (err) => {
  logger.error({ err: err.message }, "Worker error");
});

async function shutdown() {
  logger.info("Worker shutting down");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
