// DB-gated. Seeds a Task/TaskOutput/HITLQueueItem chain directly so this
// stays focused on routes/hitl.ts's own behavior: the approve/edit/reject
// state machine and its ownership boundary.

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

describe.skipIf(!hasDb)("hitl queue routes", () => {
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

  async function seedPendingHitlItem(label: string) {
    const db = getDb();
    const email = `hitl-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);

    const [executive] = await db.insert(schema.executives).values({ name: "T", email }).returning();
    const [agent] = await db
      .insert(schema.agents)
      .values({ executiveId: executive!.id, name: "A", description: "d", responsibilities: ["r"] })
      .returning();
    const [task] = await db
      .insert(schema.tasks)
      .values({ agentId: agent!.id, executiveId: executive!.id, prompt: "Draft X." })
      .returning();
    const [output] = await db
      .insert(schema.taskOutputs)
      .values({
        taskId: task!.id,
        modelProvider: "mock",
        modelId: "mock-model",
        promptVersion: "v1",
        outputText: "Draft output text",
        tokensInput: 1,
        tokensOutput: 1,
        durationMs: 1,
      })
      .returning();
    const [item] = await db
      .insert(schema.hitlQueueItems)
      .values({
        taskOutputId: output!.id,
        executiveId: executive!.id,
        status: "pending",
        originalOutput: "Draft output text",
      })
      .returning();

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, output: output!, item: item!, token };
  }

  it("approves a pending item and marks the linked TaskOutput approved", async () => {
    const app = createApp();
    const { item, output, token } = await seedPendingHitlItem("approve");

    const res = await app.request(`/api/v1/hitl/queue/${item.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<{ status: string }>(res)).data?.status).toBe("approved");

    const [updatedOutput] = await getDb()
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.id, output.id));
    expect(updatedOutput?.hitlStatus).toBe("approved");
  });

  it("edits a pending item, recording both original and final output", async () => {
    const app = createApp();
    const { item, output, token } = await seedPendingHitlItem("edit");

    const res = await app.request(`/api/v1/hitl/queue/${item.id}/edit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ finalOutput: "Edited output text" }),
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ status: string; originalOutput: string; finalOutput: string }>(
      res,
    );
    expect(body.data?.status).toBe("edited");
    expect(body.data?.originalOutput).toBe("Draft output text");
    expect(body.data?.finalOutput).toBe("Edited output text");

    const [updatedOutput] = await getDb()
      .select()
      .from(schema.taskOutputs)
      .where(eq(schema.taskOutputs.id, output.id));
    expect(updatedOutput?.hitlStatus).toBe("edited");
  });

  it("rejects a pending item with a reason", async () => {
    const app = createApp();
    const { item, token } = await seedPendingHitlItem("reject");

    const res = await app.request(`/api/v1/hitl/queue/${item.id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Not accurate." }),
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ status: string; rejectionReason: string }>(res);
    expect(body.data?.status).toBe("rejected");
    expect(body.data?.rejectionReason).toBe("Not accurate.");
  });

  it("returns 409 when approving an item that's already been actioned", async () => {
    const app = createApp();
    const { item, token } = await seedPendingHitlItem("double-action");

    await app.request(`/api/v1/hitl/queue/${item.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const secondRes = await app.request(`/api/v1/hitl/queue/${item.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(secondRes.status).toBe(409);
    expect((await jsonBody(secondRes)).error?.code).toBe("INVALID_STATE");
  });

  it("defaults GET / to pending items only, and supports status=all", async () => {
    const app = createApp();
    const { item, token } = await seedPendingHitlItem("list-default");
    await app.request(`/api/v1/hitl/queue/${item.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const pendingRes = await app.request("/api/v1/hitl/queue", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pending = await jsonBody<{ id: string }[]>(pendingRes);
    expect(pending.data?.some((i) => i.id === item.id)).toBe(false);

    const allRes = await app.request("/api/v1/hitl/queue?status=all", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const all = await jsonBody<{ id: string }[]>(allRes);
    expect(all.data?.some((i) => i.id === item.id)).toBe(true);
  });

  it("returns 404 for a HITL item belonging to a different executive", async () => {
    const app = createApp();
    const { item } = await seedPendingHitlItem("owner-a");
    const { token: tokenB } = await seedPendingHitlItem("owner-b");

    const res = await app.request(`/api/v1/hitl/queue/${item.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(404);
  });
});
