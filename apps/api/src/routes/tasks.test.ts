// DB-gated. Seeds task rows directly (bypassing the enqueue pipeline,
// already covered by execute-task.test.ts and agent-task-worker.test.ts)
// so this stays focused on routes/tasks.ts's own behavior: listing,
// filtering, ownership, and cancel's status-transition rules.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const hasDb = Boolean(process.env.DATABASE_URL);

interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<ApiEnvelope<T>> {
  return (await res.json()) as ApiEnvelope<T>;
}

describe.skipIf(!hasDb)("tasks routes", () => {
  let createApp: typeof import("../app").createApp;
  let signToken: Awaited<ReturnType<typeof createTestJwtSigner>>["signToken"];
  const createdExecutiveEmails: string[] = [];

  beforeAll(async () => {
    const signer = await createTestJwtSigner();
    process.env.JWT_PUBLIC_KEY = signer.publicKeyPem;
    signToken = signer.signToken;
    ({ createApp } = await import("../app"));
  });

  afterAll(async () => {
    const db = getDb();
    for (const email of createdExecutiveEmails) {
      await db.delete(schema.executives).where(eq(schema.executives.email, email));
    }
  });

  async function seedExecutiveAgentAndTask(
    label: string,
    taskStatus:
      "queued" | "in_progress" | "complete" | "failed" | "cancelled" | "at_checkpoint" = "queued",
  ) {
    const db = getDb();
    const email = `tasks-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);

    const [executive] = await db.insert(schema.executives).values({ name: "T", email }).returning();
    const [agent] = await db
      .insert(schema.agents)
      .values({ executiveId: executive!.id, name: "A", description: "d", responsibilities: ["r"] })
      .returning();
    const [task] = await db
      .insert(schema.tasks)
      .values({
        agentId: agent!.id,
        executiveId: executive!.id,
        prompt: "Do X.",
        status: taskStatus,
      })
      .returning();

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, agent: agent!, task: task!, token };
  }

  it("lists only the authenticated executive's tasks, filterable by agentId and status", async () => {
    const app = createApp();
    const { agent, task, token } = await seedExecutiveAgentAndTask("list", "complete");
    const headers = { Authorization: `Bearer ${token}` };

    const allRes = await app.request("/api/v1/tasks", { headers });
    const all = await jsonBody<{ id: string }[]>(allRes);
    expect(all.data?.some((t) => t.id === task.id)).toBe(true);

    const byAgentRes = await app.request(`/api/v1/tasks?agentId=${agent.id}`, { headers });
    expect((await jsonBody<{ id: string }[]>(byAgentRes)).data).toHaveLength(1);

    const wrongStatusRes = await app.request("/api/v1/tasks?status=queued", { headers });
    expect(
      (await jsonBody<{ id: string }[]>(wrongStatusRes)).data?.some((t) => t.id === task.id),
    ).toBe(false);
  });

  it("gets a task with its latest output embedded", async () => {
    const app = createApp();
    const { task, token } = await seedExecutiveAgentAndTask("detail");
    const db = getDb();
    await db.insert(schema.taskOutputs).values({
      taskId: task.id,
      modelProvider: "mock",
      modelId: "mock-model",
      promptVersion: "v1",
      outputText: "Result text",
      tokensInput: 1,
      tokensOutput: 1,
      durationMs: 1,
    });

    const res = await app.request(`/api/v1/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ output: { outputText: string } | null }>(res);
    expect(body.data?.output?.outputText).toBe("Result text");
  });

  it("cancels a queued task", async () => {
    const app = createApp();
    const { task, token } = await seedExecutiveAgentAndTask("cancel", "queued");
    const res = await app.request(`/api/v1/tasks/${task.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<{ status: string }>(res)).data?.status).toBe("cancelled");
  });

  it("returns 409 when cancelling a task that's already complete", async () => {
    const app = createApp();
    const { task, token } = await seedExecutiveAgentAndTask("cancel-complete", "complete");
    const res = await app.request(`/api/v1/tasks/${task.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(409);
    expect((await jsonBody(res)).error?.code).toBe("INVALID_STATE");
  });

  it("returns 404 for a task belonging to a different executive", async () => {
    const app = createApp();
    const { task } = await seedExecutiveAgentAndTask("owner-a");
    const { token: tokenB } = await seedExecutiveAgentAndTask("owner-b");

    const res = await app.request(`/api/v1/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(404);
  });
});
