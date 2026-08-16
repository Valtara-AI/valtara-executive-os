// Requires a live Postgres (same DB-gating pattern used throughout Sprint
// 1/2). Uses MockProvider so this is deterministic and needs no LLM API key.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { MockProvider, type InferenceProvider } from "@vex-os/ai-orchestrator";
import { executeTask, TaskNotFoundError } from "./execute-task.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("executeTask", () => {
  const createdExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of createdExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  async function makeExecutiveAndAgent(
    hitlMode: "auto_draft_review" | "checkpoint" | "autonomous_report",
  ) {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Task Test Exec",
        email: `task-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    createdExecutiveIds.push(executive!.id);

    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "Test Agent",
        description: "Drafts things for testing.",
        responsibilities: ["Draft test content"],
        hitlMode,
      })
      .returning();

    const [task] = await db
      .insert(schema.tasks)
      .values({ agentId: agent!.id, executiveId: executive!.id, prompt: "Draft a test message." })
      .returning();

    return { executive: executive!, agent: agent!, task: task! };
  }

  it("auto_draft_review: creates a pending HITL queue item and marks the task complete", async () => {
    const { task } = await makeExecutiveAndAgent("auto_draft_review");
    const provider = new MockProvider();
    provider.enqueue("Here is the drafted content.");

    await executeTask(task.id, provider);

    const db = getDb();
    const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(updatedTask?.status).toBe("complete");
    expect(updatedTask?.completedAt).not.toBeNull();

    const [output] = await db
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.taskId, task.id));
    expect(output?.outputText).toBe("Here is the drafted content.");
    expect(output?.hitlStatus).toBe("pending");

    const [hitlItem] = await db
      .select()
      .from(schema.hitlQueueItems)
      .where(eq(schema.hitlQueueItems.taskOutputId, output!.id));
    expect(hitlItem?.status).toBe("pending");
    expect(hitlItem?.originalOutput).toBe("Here is the drafted content.");
  });

  it("checkpoint: creates a pending HITL queue item and marks the task at_checkpoint, not complete", async () => {
    const { task } = await makeExecutiveAndAgent("checkpoint");
    const provider = new MockProvider();
    provider.enqueue("Checkpoint output.");

    await executeTask(task.id, provider);

    const db = getDb();
    const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(updatedTask?.status).toBe("at_checkpoint");

    const [output] = await db
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.taskId, task.id));
    const [hitlItem] = await db
      .select()
      .from(schema.hitlQueueItems)
      .where(eq(schema.hitlQueueItems.taskOutputId, output!.id));
    expect(hitlItem?.status).toBe("pending");
  });

  it("autonomous_report: no HITL queue item; output is auto-approved; task complete", async () => {
    const { task } = await makeExecutiveAndAgent("autonomous_report");
    const provider = new MockProvider();
    provider.enqueue("Autonomous output.");

    await executeTask(task.id, provider);

    const db = getDb();
    const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(updatedTask?.status).toBe("complete");

    const [output] = await db
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.taskId, task.id));
    expect(output?.hitlStatus).toBe("approved");

    const hitlItems = await db
      .select()
      .from(schema.hitlQueueItems)
      .where(eq(schema.hitlQueueItems.taskOutputId, output!.id));
    expect(hitlItems).toHaveLength(0);
  });

  it("applies the Voice Profile into the rendered system prompt when one exists", async () => {
    const db = getDb();
    const { executive, task } = await makeExecutiveAndAgent("auto_draft_review");

    const [voiceProfile] = await db
      .insert(schema.voiceProfiles)
      .values({
        executiveId: executive.id,
        tone: "direct",
        formality: "low",
        sentenceLength: "short",
        vocabularyLevel: "plain",
      })
      .returning();
    await db
      .update(schema.executives)
      .set({ voiceProfileId: voiceProfile!.id })
      .where(eq(schema.executives.id, executive.id));

    const provider = new MockProvider();
    provider.enqueue("output");
    await executeTask(task.id, provider);

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.systemPrompt).toContain("Tone: direct");
    expect(provider.calls[0]?.systemPrompt).toContain("Sentence length: short");
  });

  it("throws TaskNotFoundError for a nonexistent task", async () => {
    await expect(
      executeTask("00000000-0000-0000-0000-000000000000", new MockProvider()),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it("cancelled before pickup: does not call the LLM, does not overwrite the cancelled status", async () => {
    const db = getDb();
    const { task } = await makeExecutiveAndAgent("auto_draft_review");
    await db.update(schema.tasks).set({ status: "cancelled" }).where(eq(schema.tasks.id, task.id));

    const provider = new MockProvider();
    provider.enqueue("Should never be produced.");
    await executeTask(task.id, provider);

    expect(provider.calls).toHaveLength(0);

    const [finalTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(finalTask?.status).toBe("cancelled");

    const outputs = await db
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.taskId, task.id));
    expect(outputs).toHaveLength(0);
  });

  it("cancelled mid-flight (during the LLM call): does not overwrite the cancelled status, but the output already produced is kept", async () => {
    const db = getDb();
    const { task } = await makeExecutiveAndAgent("auto_draft_review");

    // Simulates DELETE /tasks/:taskId racing with an in-flight worker: the
    // cancellation lands *during* what would be the LLM call.
    const realProvider = new MockProvider();
    realProvider.enqueue("Produced despite mid-flight cancellation.");
    const provider: InferenceProvider = {
      async complete(request) {
        await db
          .update(schema.tasks)
          .set({ status: "cancelled" })
          .where(eq(schema.tasks.id, task.id));
        return realProvider.complete(request);
      },
      isAvailable: () => Promise.resolve(true),
      getProviderName: () => "mock",
    };

    await executeTask(task.id, provider);

    const [finalTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    // Cancellation wins on status - the guarded final update refuses to
    // clobber it back to "complete".
    expect(finalTask?.status).toBe("cancelled");

    // But the work already done before the guard caught it is kept, not
    // silently dropped - cancellation is best-effort, not a hard interrupt.
    const [output] = await db
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.taskId, task.id));
    expect(output?.outputText).toBe("Produced despite mid-flight cancellation.");
  });
});
