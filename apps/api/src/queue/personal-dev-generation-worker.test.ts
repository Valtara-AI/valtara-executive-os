// True end-to-end: real BullMQ Queue + Redis + Worker + Postgres, only the
// LLM call mocked. Mirrors brief-generation-worker.test.ts's pattern.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { MockProvider } from "@nyxor/ai-orchestrator";
import {
  enqueuePersonalDevGeneration,
  getPersonalDevGenerationQueue,
} from "./personal-dev-generation-queue.js";
import { createPersonalDevGenerationWorker } from "./personal-dev-generation-worker.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);

const VALID_RECOMMENDATIONS = JSON.stringify({
  recommendations: [
    { type: "book", title: "Worker Book", creator: "An Author", rationale: "r1" },
    { type: "podcast", title: "Worker Podcast", creator: null, rationale: "r2" },
    { type: "publication", title: "Worker Pub", creator: "A Publisher", rationale: "r3" },
  ],
});

function waitFor(condition: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = async () => {
      if (await condition()) return resolve();
      if (Date.now() - start > timeoutMs)
        return reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      setTimeout(poll, 100);
    };
    void poll();
  });
}

describe.skipIf(!hasDb || !hasRedis)("personal-dev generation worker (end-to-end)", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  afterAll(async () => {
    await getPersonalDevGenerationQueue().close();
  });

  it("processes an enqueued executive through a real worker and persists recommendations", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Worker PD Exec", email: `worker-pd-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const provider = new MockProvider();
    provider.enqueue(VALID_RECOMMENDATIONS);

    await getPersonalDevGenerationQueue().drain();
    const worker = createPersonalDevGenerationWorker(provider);

    try {
      await enqueuePersonalDevGeneration(executive!.id);

      await waitFor(async () => {
        const rows = await db
          .select()
          .from(schema.personalDevelopmentRecommendations)
          .where(eq(schema.personalDevelopmentRecommendations.executiveId, executive!.id));
        return rows.length > 0;
      });

      const rows = await db
        .select()
        .from(schema.personalDevelopmentRecommendations)
        .where(eq(schema.personalDevelopmentRecommendations.executiveId, executive!.id));
      expect(rows).toHaveLength(3);
    } finally {
      await worker.close();
    }
  }, 15000);
});
