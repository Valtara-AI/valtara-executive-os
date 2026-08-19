// DB-gated. Exercises the full invite -> accept flow over real HTTP
// requests against the real app, not the domain functions directly (those
// have their own focused unit tests in domains/delegates/).

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

describe.skipIf(!hasDb)("delegate invitation routes", () => {
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
    const email = `delegates-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    return email;
  }

  // DL-ARCH-010: POST /executive/delegates is now entitlement-gated
  // (assertSeatLimit) - see integrations.test.ts's identical helper.
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

  it("full flow: Executive invites, Delegate sees it pending, accepts, gains HITL access", async () => {
    const app = createApp();
    const execEmail = freshEmail("owner");
    await seedActiveSubscription(execEmail);
    const delegateEmail = `delegate-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const execToken = await signToken({ email: execEmail, role: "Executive" });
    const execHeaders = {
      Authorization: `Bearer ${execToken}`,
      "Content-Type": "application/json",
    };

    const inviteRes = await app.request("/api/v1/executive/delegates", {
      method: "POST",
      headers: execHeaders,
      body: JSON.stringify({ email: delegateEmail }),
    });
    expect(inviteRes.status).toBe(201);
    const invite = await jsonBody<{ id: string; status: string }>(inviteRes);
    expect(invite.data?.status).toBe("pending");
    const linkId = invite.data!.id;

    // Delegate's own JWT: role doesn't matter for this endpoint (it's
    // scoped by email, not role - a brand-new user has no role-defining
    // data yet, which is exactly this scenario).
    const delegateToken = await signToken({ email: delegateEmail, role: "Executive" });
    const delegateHeaders = {
      Authorization: `Bearer ${delegateToken}`,
      "Content-Type": "application/json",
    };

    const pendingRes = await app.request("/api/v1/delegate/invitations", {
      headers: delegateHeaders,
    });
    const pending = await jsonBody<{ id: string }[]>(pendingRes);
    expect(pending.data?.some((i) => i.id === linkId)).toBe(true);

    const acceptRes = await app.request(`/api/v1/delegate/invitations/${linkId}/accept`, {
      method: "POST",
      headers: delegateHeaders,
    });
    expect(acceptRes.status).toBe(200);
    expect((await jsonBody<{ status: string }>(acceptRes)).data?.status).toBe("accepted");

    // Now signed in as an actual Delegate (role reflects what
    // resolve-role-for-email would now return), they should see the
    // executive's HITL queue.
    const acceptedDelegateToken = await signToken({ email: delegateEmail, role: "Delegate" });
    const hitlRes = await app.request("/api/v1/hitl/queue?status=all", {
      headers: { Authorization: `Bearer ${acceptedDelegateToken}` },
    });
    expect(hitlRes.status).toBe(200);
  });

  it("Executive can list and revoke a delegate link", async () => {
    const app = createApp();
    const revokeOwnerEmail = freshEmail("revoke-owner");
    await seedActiveSubscription(revokeOwnerEmail);
    const execToken = await signToken({ email: revokeOwnerEmail, role: "Executive" });
    const headers = { Authorization: `Bearer ${execToken}`, "Content-Type": "application/json" };
    const delegateEmail = `revoke-target-${Date.now()}@example.com`;

    const inviteRes = await app.request("/api/v1/executive/delegates", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: delegateEmail }),
    });
    const linkId = (await jsonBody<{ id: string }>(inviteRes)).data!.id;

    const listRes = await app.request("/api/v1/executive/delegates", { headers });
    expect((await jsonBody<{ id: string }[]>(listRes)).data?.some((l) => l.id === linkId)).toBe(
      true,
    );

    const revokeRes = await app.request(`/api/v1/executive/delegates/${linkId}`, {
      method: "DELETE",
      headers,
    });
    expect(revokeRes.status).toBe(200);
    expect((await jsonBody<{ status: string }>(revokeRes)).data?.status).toBe("revoked");
  });

  it("a Delegate can decline an invitation", async () => {
    const app = createApp();
    const declineOwnerEmail = freshEmail("decline-owner");
    await seedActiveSubscription(declineOwnerEmail);
    const execToken = await signToken({ email: declineOwnerEmail, role: "Executive" });
    const execHeaders = {
      Authorization: `Bearer ${execToken}`,
      "Content-Type": "application/json",
    };
    const delegateEmail = `decline-target-${Date.now()}@example.com`;

    const inviteRes = await app.request("/api/v1/executive/delegates", {
      method: "POST",
      headers: execHeaders,
      body: JSON.stringify({ email: delegateEmail }),
    });
    const linkId = (await jsonBody<{ id: string }>(inviteRes)).data!.id;

    const delegateToken = await signToken({ email: delegateEmail, role: "Executive" });
    const declineRes = await app.request(`/api/v1/delegate/invitations/${linkId}/decline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    expect(declineRes.status).toBe(200);
    expect((await jsonBody<{ status: string }>(declineRes)).data?.status).toBe("declined");
  });

  it("a Delegate cannot accept an invitation addressed to a different email", async () => {
    const app = createApp();
    const mismatchOwnerEmail = freshEmail("mismatch-owner");
    await seedActiveSubscription(mismatchOwnerEmail);
    const execToken = await signToken({ email: mismatchOwnerEmail, role: "Executive" });
    const execHeaders = {
      Authorization: `Bearer ${execToken}`,
      "Content-Type": "application/json",
    };

    const inviteRes = await app.request("/api/v1/executive/delegates", {
      method: "POST",
      headers: execHeaders,
      body: JSON.stringify({ email: `real-delegate-${Date.now()}@example.com` }),
    });
    const linkId = (await jsonBody<{ id: string }>(inviteRes)).data!.id;

    const impostorToken = await signToken({
      email: `impostor-${Date.now()}@example.com`,
      role: "Executive",
    });
    const res = await app.request(`/api/v1/delegate/invitations/${linkId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${impostorToken}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 402 when inviting a delegate with no active subscription", async () => {
    const app = createApp();
    const execToken = await signToken({
      email: freshEmail("no-subscription-owner"),
      role: "Executive",
    });
    const res = await app.request("/api/v1/executive/delegates", {
      method: "POST",
      headers: { Authorization: `Bearer ${execToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `some-delegate-${Date.now()}@example.com` }),
    });
    expect(res.status).toBe(402);
    expect((await jsonBody(res)).error?.code).toBe("ENTITLEMENT_LIMIT");
  });

  it("rejects invite/list/revoke from a non-Executive role", async () => {
    const app = createApp();
    const delegateToken = await signToken({ email: freshEmail("wrong-role"), role: "Delegate" });
    const res = await app.request("/api/v1/executive/delegates", {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    expect(res.status).toBe(403);
  });
});
