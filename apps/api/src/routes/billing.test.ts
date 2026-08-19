// DB-gated. Only covers GET /subscription (pure read, no Stripe network
// call) - /checkout and /portal both call the real Stripe API and aren't
// exercised here for the same reason live OAuth isn't: no real credentials
// in this environment. packages/billing's own test suite covers the
// signature-verification and entitlement logic those routes depend on.

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

describe.skipIf(!hasDb)("billing routes", () => {
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
    const email = `billing-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    return email;
  }

  it("GET /subscription returns null and zero entitlements before checkout", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("none"), role: "Executive" });

    const res = await app.request("/api/v1/billing/subscription", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{
      subscription: unknown;
      entitlements: { tier: string | null; status: string };
    }>(res);
    expect(body.data?.subscription).toBeNull();
    expect(body.data?.entitlements).toEqual({
      tier: null,
      status: "none",
      limits: { maxAgents: 0, allowedIntegrations: [], maxDelegateSeats: 0, maxMonthlyTasks: 0 },
    });
  });

  it("GET /subscription reflects an active subscription's tier and limits", async () => {
    const app = createApp();
    const email = freshEmail("active");
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: email, email, onboardingStatus: "not_started" })
      .returning();
    await db.insert(schema.subscriptions).values({
      executiveId: executive!.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      tier: "starter",
      status: "trialing",
    });
    const token = await signToken({ email, role: "Executive" });

    const res = await app.request("/api/v1/billing/subscription", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await jsonBody<{
      entitlements: { tier: string; status: string; limits: { maxAgents: number } };
    }>(res);
    expect(body.data?.entitlements.tier).toBe("starter");
    expect(body.data?.entitlements.status).toBe("trialing");
    expect(body.data?.entitlements.limits.maxAgents).toBe(3);
  });

  it("rejects unauthenticated requests", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/billing/subscription");
    expect(res.status).toBe(401);
  });
});
