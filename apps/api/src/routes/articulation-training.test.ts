// DB-gated. Seeds articulation_sessions rows and a subscription directly
// (generation itself is covered by
// domains/articulation-training/analyze-speech.test.ts). The text-submit
// path (POST /) isn't exercised end-to-end here since it makes a real LLM
// call through the default provider - covered instead by
// analyze-speech.test.ts with a MockProvider. This file focuses on what's
// route-specific: entitlement gating, ownership, and RBAC.

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

describe.skipIf(!hasDb)("articulation-training routes", () => {
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

  async function seedExecutiveWithSession(
    label: string,
    tier: "starter" | "pro" | "enterprise" = "pro",
  ) {
    const db = getDb();
    const email = `at-route-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    const [executive] = await db.insert(schema.executives).values({ name: "T", email }).returning();
    await db.insert(schema.subscriptions).values({
      executiveId: executive!.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}_${Math.random()}`,
      tier,
      status: "active",
    });

    const [sessionRow] = await db
      .insert(schema.articulationSessions)
      .values({
        executiveId: executive!.id,
        sessionType: "pitch",
        inputMode: "text",
        inputText: "x",
        feedbackJson: {},
        clarityScore: 50,
        structureScore: 50,
        persuasivenessScore: 50,
        toneScore: 50,
      })
      .returning();

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, session: sessionRow!, token };
  }

  it("GET / lists sessions for the authenticated executive", async () => {
    const app = createApp();
    const { session, token } = await seedExecutiveWithSession("list");

    const res = await app.request("/api/v1/articulation-training", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await jsonBody<{ id: string }[]>(res);
    expect(body.data?.some((s) => s.id === session.id)).toBe(true);
  });

  it("GET /:id returns 404 for a session belonging to a different executive", async () => {
    const app = createApp();
    const { session } = await seedExecutiveWithSession("owner-a");
    const { token: tokenB } = await seedExecutiveWithSession("owner-b");

    const res = await app.request(`/api/v1/articulation-training/${session.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(404);
  });

  it("is forbidden for a Delegate", async () => {
    const app = createApp();
    const delegateToken = await signToken({
      email: `at-delegate-${Date.now()}@example.com`,
      role: "Delegate",
    });

    const res = await app.request("/api/v1/articulation-training", {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("POST / returns 402 once the tier's monthly session cap is reached", async () => {
    const app = createApp();
    const { executive, token } = await seedExecutiveWithSession("capped", "starter");
    const db = getDb();
    // seedExecutiveWithSession already inserted 1; starter's cap is 3 -
    // insert 2 more to reach it.
    for (let i = 0; i < 2; i++) {
      await db.insert(schema.articulationSessions).values({
        executiveId: executive.id,
        sessionType: "pitch",
        inputMode: "text",
        inputText: "x",
        feedbackJson: {},
        clarityScore: 50,
        structureScore: 50,
        persuasivenessScore: 50,
        toneScore: 50,
      });
    }

    const res = await app.request("/api/v1/articulation-training", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionType: "pitch", inputText: "Won't get this far." }),
    });
    expect(res.status).toBe(402);
  });
});
