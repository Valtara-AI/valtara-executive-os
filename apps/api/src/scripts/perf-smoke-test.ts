// SRS §6 performance smoke test - NYXOR-ETP-001 TC-PERF-01/02 scoped down
// to what's honestly checkable on a laptop against the local dev stack:
// real HTTP round trips (not in-process app.request() calls) at a modest
// concurrency, against a real Postgres with one seeded executive.
//
// What this does NOT validate: SRS §6's literal "1,000 concurrent
// authenticated sessions" target, or morning brief generation across 100
// executives (TC-PERF-03) - those need a real deployment with realistic
// infrastructure sizing, not a single laptop process. This script exists
// to catch gross regressions (a new middleware adding seconds of latency,
// an N+1 query) before that, not to sign off the SRS targets themselves.
//
// Usage: DATABASE_URL=... REDIS_URL=... npm run perf:smoke --workspace=apps/api
// -- [concurrency] [requestsPerEndpoint]

import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { createApp } from "../app.js";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const CONCURRENCY = Number(process.argv[2] ?? 20);
const REQUESTS_PER_ENDPOINT = Number(process.argv[3] ?? 200);
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

// SRS §6's own targets, so pass/fail is read off the same table it defines.
const TARGETS_MS: Record<string, number> = {
  "GET /api/v1/health (unauthenticated)": 300,
  "GET /api/v1/dashboard/summary (authenticated)": 300,
  "GET /api/v1/hitl/queue (authenticated)": 1000,
};

interface Timing {
  label: string;
  durations: number[];
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
}

async function measure(
  label: string,
  url: string,
  headers: Record<string, string>,
): Promise<Timing> {
  const durations: number[] = [];
  let inFlight = 0;
  let completed = 0;

  await new Promise<void>((resolve, reject) => {
    function launchNext() {
      if (completed >= REQUESTS_PER_ENDPOINT) return;
      inFlight++;
      const start = performance.now();
      fetch(url, { headers })
        .then((res) => res.arrayBuffer().then(() => res.status))
        .then((status) => {
          durations.push(performance.now() - start);
          completed++;
          inFlight--;
          if (status >= 500) console.warn(`  [warn] ${label} returned ${status}`);
          if (completed >= REQUESTS_PER_ENDPOINT && inFlight === 0) resolve();
          else launchNext();
        })
        .catch(reject);
    }
    for (let i = 0; i < Math.min(CONCURRENCY, REQUESTS_PER_ENDPOINT); i++) launchNext();
  });

  return { label, durations };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL must be set - this needs a real Postgres, same as the test suite.");
    process.exit(1);
  }

  const signer = await createTestJwtSigner();
  process.env.JWT_PUBLIC_KEY = signer.publicKeyPem;

  const db = getDb();
  const [executive] = await db
    .insert(schema.executives)
    .values({ name: "Perf Smoke Test", email: `perf-smoke-${Date.now()}@example.com` })
    .returning();
  const token = await signer.signToken({ email: executive!.email, role: "Executive" });
  const authHeaders = { Authorization: `Bearer ${token}` };

  const server = serve({ fetch: createApp().fetch, port: PORT });
  console.log(
    `Server up on :${PORT}. Concurrency=${CONCURRENCY}, requests/endpoint=${REQUESTS_PER_ENDPOINT}\n`,
  );

  try {
    const results: Timing[] = [];
    results.push(
      await measure("GET /api/v1/health (unauthenticated)", `${BASE_URL}/api/v1/health`, {}),
    );
    results.push(
      await measure(
        "GET /api/v1/dashboard/summary (authenticated)",
        `${BASE_URL}/api/v1/dashboard/summary`,
        authHeaders,
      ),
    );
    results.push(
      await measure(
        "GET /api/v1/hitl/queue (authenticated)",
        `${BASE_URL}/api/v1/hitl/queue`,
        authHeaders,
      ),
    );

    console.log(
      "Endpoint".padEnd(48) +
        "p50".padStart(8) +
        "p95".padStart(8) +
        "p99".padStart(8) +
        "  target(p95)  status",
    );
    let anyFailed = false;
    for (const { label, durations } of results) {
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = percentile(sorted, 50);
      const p95 = percentile(sorted, 95);
      const p99 = percentile(sorted, 99);
      const target = TARGETS_MS[label] ?? Infinity;
      const pass = p95 <= target;
      anyFailed ||= !pass;
      console.log(
        label.padEnd(48) +
          `${p50.toFixed(0)}ms`.padStart(8) +
          `${p95.toFixed(0)}ms`.padStart(8) +
          `${p99.toFixed(0)}ms`.padStart(8) +
          `  ${target}ms`.padStart(12) +
          `  ${pass ? "PASS" : "FAIL"}`,
      );
    }

    if (anyFailed) process.exitCode = 1;
  } finally {
    await db.delete(schema.executives).where(eq(schema.executives.id, executive!.id));
    server.close();
    // postgres.js and ioredis both hold open sockets that keep the event
    // loop alive indefinitely - this is a one-shot script, not a long-lived
    // server, so an explicit exit is correct here rather than waiting for
    // handles this script doesn't own a clean way to close (getDb()/
    // getRedisConnection() are shared singletons with no exposed
    // teardown).
    process.exit(process.exitCode ?? 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
