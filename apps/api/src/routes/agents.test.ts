// DB-gated (unlike app.test.ts, which mocks the onboarding engine entirely
// - these routes talk to Drizzle directly, so there's no domain module to
// mock without re-implementing the query logic in the mock). Exercises
// real ownership isolation between two distinct executives, which is the
// part of this route file most worth getting right and easiest to get
// wrong silently.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
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

describe.skipIf(!hasDb)("agents routes", () => {
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

  function freshEmail(label: string): string {
    const email = `agents-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    return email;
  }

  // DL-ARCH-010: POST /agents and POST /agents/:id/tasks are now
  // entitlement-gated (assertAgentLimit / assertTaskVolume) - see
  // integrations.test.ts's identical helper for why this seeds a
  // subscription directly rather than going through real Stripe checkout.
  async function seedActiveSubscription(email: string): Promise<void> {
    const db = getDb();
    let [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    if (!executive) {
      [executive] = await db
        .insert(schema.executives)
        .values({ name: email, email, onboardingStatus: "not_started" })
        .returning();
    }
    await db.insert(schema.subscriptions).values({
      executiveId: executive!.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tier: "pro",
      status: "active",
    });
  }

  it("creates, lists, gets, updates, and archives an agent for the authenticated executive", async () => {
    const app = createApp();
    const email = freshEmail("crud");
    await seedActiveSubscription(email);
    const token = await signToken({ email, role: "Executive" });
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const createRes = await app.request("/api/v1/agents", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Inbox Agent",
        description: "Triages inbox.",
        responsibilities: ["Summarize threads"],
        hitlMode: "auto_draft_review",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await jsonBody<{ id: string; name: string; status: string }>(createRes);
    expect(created.data?.name).toBe("Inbox Agent");
    expect(created.data?.status).toBe("active");
    const agentId = created.data!.id;

    const listRes = await app.request("/api/v1/agents", { headers });
    const list = await jsonBody<{ id: string }[]>(listRes);
    expect(list.data?.some((a) => a.id === agentId)).toBe(true);

    const getRes = await app.request(`/api/v1/agents/${agentId}`, { headers });
    expect(getRes.status).toBe(200);

    const patchRes = await app.request(`/api/v1/agents/${agentId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Renamed Agent" }),
    });
    expect(patchRes.status).toBe(200);
    expect((await jsonBody<{ name: string }>(patchRes)).data?.name).toBe("Renamed Agent");

    const archiveRes = await app.request(`/api/v1/agents/${agentId}`, {
      method: "DELETE",
      headers,
    });
    expect(archiveRes.status).toBe(200);
    expect((await jsonBody<{ status: string }>(archiveRes)).data?.status).toBe("archived");
  });

  it("returns 409 when assigning a task to an archived agent", async () => {
    const app = createApp();
    const email = freshEmail("archived-task");
    await seedActiveSubscription(email);
    const token = await signToken({ email, role: "Executive" });
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const createRes = await app.request("/api/v1/agents", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "A", description: "d", responsibilities: ["r"] }),
    });
    const agentId = (await jsonBody<{ id: string }>(createRes)).data!.id;
    await app.request(`/api/v1/agents/${agentId}`, { method: "DELETE", headers });

    const taskRes = await app.request(`/api/v1/agents/${agentId}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "Do something." }),
    });
    expect(taskRes.status).toBe(409);
    expect((await jsonBody(taskRes)).error?.code).toBe("AGENT_ARCHIVED");
  });

  it("isolates agents between two different executives - cross-access returns 404, not the other executive's data", async () => {
    const app = createApp();
    const emailA = freshEmail("owner-a");
    await seedActiveSubscription(emailA);
    const tokenA = await signToken({ email: emailA, role: "Executive" });
    const tokenB = await signToken({ email: freshEmail("owner-b"), role: "Executive" });
    const headersA = { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" };
    const headersB = { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" };

    const createRes = await app.request("/api/v1/agents", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ name: "A's Agent", description: "d", responsibilities: ["r"] }),
    });
    const agentId = (await jsonBody<{ id: string }>(createRes)).data!.id;

    const getAsB = await app.request(`/api/v1/agents/${agentId}`, { headers: headersB });
    expect(getAsB.status).toBe(404);

    const patchAsB = await app.request(`/api/v1/agents/${agentId}`, {
      method: "PATCH",
      headers: headersB,
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(patchAsB.status).toBe(404);

    const listAsB = await app.request("/api/v1/agents", { headers: headersB });
    const listB = await jsonBody<{ id: string }[]>(listAsB);
    expect(listB.data?.some((a) => a.id === agentId)).toBe(false);

    // A can still see their own agent, confirming this was an isolation
    // check and not just a broken route.
    const getAsA = await app.request(`/api/v1/agents/${agentId}`, { headers: headersA });
    expect(getAsA.status).toBe(200);
  });

  it("returns 402 when creating an agent with no active subscription", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("no-subscription"), role: "Executive" });
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const res = await app.request("/api/v1/agents", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "A", description: "d", responsibilities: ["r"] }),
    });
    expect(res.status).toBe(402);
    expect((await jsonBody(res)).error?.code).toBe("ENTITLEMENT_LIMIT");
  });

  it("rejects unauthenticated and non-Executive-role requests", async () => {
    const app = createApp();
    const noAuthRes = await app.request("/api/v1/agents");
    expect(noAuthRes.status).toBe(401);

    const delegateToken = await signToken({ email: freshEmail("delegate"), role: "Delegate" });
    const forbiddenRes = await app.request("/api/v1/agents", {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    expect(forbiddenRes.status).toBe(403);
  });
});
