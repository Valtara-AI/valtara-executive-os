// True end-to-end: a real BullMQ Queue backed by a real Redis, a real
// Worker consuming from it, executing against a real Postgres - only the
// LLM call itself is mocked. Requires both DATABASE_URL and REDIS_URL.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { MockProvider } from "@nyxor/ai-orchestrator";
import { enqueueAgentTask, getAgentTaskQueue } from "./agent-task-queue.js";
import { createAgentTaskWorker } from "./agent-task-worker.js";

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

describe.skipIf(!hasDb || !hasRedis)("agent task worker (end-to-end)", () => {
  const createdExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of createdExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  afterAll(async () => {
    await getAgentTaskQueue().close();
  });

  it("processes an enqueued task through a real worker and produces a HITL queue item", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Worker Test Exec", email: `worker-test-${Date.now()}@example.com` })
      .returning();
    createdExecutiveIds.push(executive!.id);

    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "Worker Test Agent",
        description: "Drafts things.",
        responsibilities: ["Draft content"],
        hitlMode: "auto_draft_review",
      })
      .returning();

    const [task] = await db
      .insert(schema.tasks)
      .values({ agentId: agent!.id, executiveId: executive!.id, prompt: "Draft something." })
      .returning();

    const provider = new MockProvider();
    provider.enqueue("Worker-produced output.");

    // Defensive: see brief-generation-worker.test.ts's identical comment -
    // a stray waiting job from anywhere else consuming this test's one
    // queued MockProvider response would produce a flaky failure unrelated
    // to this test's own logic.
    await getAgentTaskQueue().drain();
    const worker = createAgentTaskWorker(provider);

    try {
      await enqueueAgentTask(task!.id);

      await waitFor(async () => {
        const [current] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task!.id));
        return current?.status === "complete";
      });

      const [output] = await db
        .select()
        .from(schema.taskOutputs)
        .where(eq(schema.taskOutputs.taskId, task!.id));
      expect(output?.outputText).toBe("Worker-produced output.");

      const [hitlItem] = await db
        .select()
        .from(schema.hitlQueueItems)
        .where(eq(schema.hitlQueueItems.taskOutputId, output!.id));
      expect(hitlItem?.status).toBe("pending");
    } finally {
      await worker.close();
    }
  }, 15000);
});
