// True end-to-end: real BullMQ Queue + Redis + Worker + Postgres, only the
// LLM call mocked. Mirrors agent-task-worker.test.ts's pattern.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { MockProvider } from "@vex-os/ai-orchestrator";
import { enqueueBriefGeneration, getBriefGenerationQueue } from "./brief-generation-queue.js";
import { createBriefGenerationWorker } from "./brief-generation-worker.js";
import { localDateString } from "../domains/morning-brief/generate-brief.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);

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

describe.skipIf(!hasDb || !hasRedis)("brief generation worker (end-to-end)", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  afterAll(async () => {
    await getBriefGenerationQueue().close();
  });

  it("processes an enqueued executive through a real worker and persists a brief", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Worker Brief Exec", email: `worker-brief-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const provider = new MockProvider();
    provider.enqueue("Your worker-generated brief.");
    const worker = createBriefGenerationWorker(provider);

    try {
      await enqueueBriefGeneration(executive!.id);

      await waitFor(async () => {
        const [brief] = await db
          .select()
          .from(schema.morningBriefs)
          .where(eq(schema.morningBriefs.executiveId, executive!.id));
        return Boolean(brief);
      });

      const [brief] = await db
        .select()
        .from(schema.morningBriefs)
        .where(eq(schema.morningBriefs.executiveId, executive!.id));
      expect(brief?.content).toBe("Your worker-generated brief.");
      expect(brief?.date).toBe(localDateString(executive!.timezone));
    } finally {
      await worker.close();
    }
  }, 15000);
});
