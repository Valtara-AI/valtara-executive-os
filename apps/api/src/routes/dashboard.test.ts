// DB-gated.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const hasDb = Boolean(process.env.DATABASE_URL);

interface SummaryData {
  hitlQueueCount: number;
  activeTaskCount: number;
  pendingDecisionCount: number;
  integrations: unknown[];
}
interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<ApiEnvelope<T>> {
  return (await res.json()) as ApiEnvelope<T>;
}

describe.skipIf(!hasDb)("dashboard routes", () => {
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

  async function seedExecutiveWithActivity(label: string) {
    const db = getDb();
    const email = `dash-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    const [executive] = await db.insert(schema.executives).values({ name: "T", email }).returning();
    const [agent] = await db
      .insert(schema.agents)
      .values({ executiveId: executive!.id, name: "A", description: "d", responsibilities: ["r"] })
      .returning();

    await db.insert(schema.tasks).values([
      { agentId: agent!.id, executiveId: executive!.id, prompt: "p1", status: "queued" },
      { agentId: agent!.id, executiveId: executive!.id, prompt: "p2", status: "in_progress" },
      { agentId: agent!.id, executiveId: executive!.id, prompt: "p3", status: "complete" },
    ]);
    await db.insert(schema.hitlQueueItems).values([
      { executiveId: executive!.id, status: "pending", originalOutput: "o1" },
      { executiveId: executive!.id, status: "approved", originalOutput: "o2" },
    ]);

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, token };
  }

  it("counts only active tasks and only pending HITL items", async () => {
    const app = createApp();
    const { token } = await seedExecutiveWithActivity("counts");

    const res = await app.request("/api/v1/dashboard/summary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const summary = (await jsonBody<SummaryData>(res)).data!;
    expect(summary.activeTaskCount).toBe(2); // queued + in_progress, not complete
    expect(summary.hitlQueueCount).toBe(1); // pending only, not approved
    expect(summary.pendingDecisionCount).toBe(1);
    expect(summary.integrations).toEqual([]);
  });

  it("returns zeros for an executive with no activity", async () => {
    const app = createApp();
    const email = `dash-test-empty-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    const res = await app.request("/api/v1/dashboard/summary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const summary = (await jsonBody<SummaryData>(res)).data!;
    expect(summary).toEqual({
      hitlQueueCount: 0,
      activeTaskCount: 0,
      pendingDecisionCount: 0,
      integrations: [],
    });
  });

  it("aggregates across multiple executives for a Delegate serving more than one", async () => {
    const app = createApp();
    const { executive: execA } = await seedExecutiveWithActivity("multi-a");
    const { executive: execB } = await seedExecutiveWithActivity("multi-b");
    const delegateEmail = `dash-delegate-${Date.now()}@example.com`;
    await getDb()
      .insert(schema.delegateLinks)
      .values([
        { executiveId: execA.id, delegateEmail, status: "accepted" },
        { executiveId: execB.id, delegateEmail, status: "accepted" },
      ]);
    const delegateToken = await signToken({ email: delegateEmail, role: "Delegate" });

    const res = await app.request("/api/v1/dashboard/summary", {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    const summary = (await jsonBody<SummaryData>(res)).data!;
    expect(summary.activeTaskCount).toBe(4); // 2 per executive
    expect(summary.hitlQueueCount).toBe(2); // 1 per executive
  });

  it("rejects an Administrator", async () => {
    const app = createApp();
    const adminToken = await signToken({
      email: `admin-dash-${Date.now()}@example.com`,
      role: "Administrator",
    });
    const res = await app.request("/api/v1/dashboard/summary", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });
});
