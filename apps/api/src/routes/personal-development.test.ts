// DB-gated. Seeds personal_development_recommendations rows directly
// (generation itself is covered by
// domains/personal-development/generate-recommendations.test.ts).

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

describe.skipIf(!hasDb)("personal-development routes", () => {
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

  async function seedExecutiveWithRecommendation(label: string) {
    const db = getDb();
    const email = `pd-route-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    const [executive] = await db.insert(schema.executives).values({ name: "T", email }).returning();

    const [rec] = await db
      .insert(schema.personalDevelopmentRecommendations)
      .values({
        executiveId: executive!.id,
        type: "book",
        title: "Test Book",
        rationale: "r",
      })
      .returning();

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, recommendation: rec!, token };
  }

  it("GET / lists recommendations for the authenticated executive", async () => {
    const app = createApp();
    const { recommendation, token } = await seedExecutiveWithRecommendation("list");

    const res = await app.request("/api/v1/personal-development", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await jsonBody<{ id: string }[]>(res);
    expect(body.data?.some((r) => r.id === recommendation.id)).toBe(true);
  });

  it("PATCH /:id updates status for the owning executive", async () => {
    const app = createApp();
    const { recommendation, token } = await seedExecutiveWithRecommendation("patch");

    const res = await app.request(`/api/v1/personal-development/${recommendation.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<{ status: string }>(res)).data?.status).toBe("completed");
  });

  it("PATCH /:id returns 404 for a recommendation belonging to a different executive", async () => {
    const app = createApp();
    const { recommendation } = await seedExecutiveWithRecommendation("owner-a");
    const { token: tokenB } = await seedExecutiveWithRecommendation("owner-b");

    const res = await app.request(`/api/v1/personal-development/${recommendation.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /:id is forbidden for a Delegate", async () => {
    const app = createApp();
    const { recommendation } = await seedExecutiveWithRecommendation("delegate");
    const delegateToken = await signToken({
      email: `pd-delegate-${Date.now()}@example.com`,
      role: "Delegate",
    });

    const res = await app.request(`/api/v1/personal-development/${recommendation.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${delegateToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(res.status).toBe(403);
  });
});
