// Shared Redis connection for BullMQ (DL-PROD-002: "Job queue | BullMQ +
// Redis"). BullMQ requires maxRetriesPerRequest: null on the connection it's
// given - it manages its own retry/backoff semantics for blocking commands
// and throws at construction time otherwise.

import IORedis from "ioredis";

let sharedConnection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (sharedConnection) return sharedConnection;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL must be set (see .env.example).");
  }

  sharedConnection = new IORedis(url, { maxRetriesPerRequest: null });
  return sharedConnection;
}
