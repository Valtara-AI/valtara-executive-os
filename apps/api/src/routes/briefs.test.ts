// DB-gated. Seeds morning_briefs rows directly (generation itself is
// covered by domains/morning-brief/generate-brief.test.ts and
// queue/brief-generation-worker.test.ts).

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

describe.skipIf(!hasDb)("briefs routes", () => {
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

  async function seedExecutiveWithTodaysBrief(label: string) {
    const db = getDb();
    const email = `briefs-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "T", email, timezone: "UTC" })
      .returning();

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
    const [brief] = await db
      .insert(schema.morningBriefs)
      .values({ executiveId: executive!.id, date: today, content: "Today's brief content." })
      .returning();

    const token = await signToken({ email, role: "Executive" });
    return { executive: executive!, brief: brief!, token };
  }

  it("GET /today returns today's brief for the authenticated executive", async () => {
    const app = createApp();
    const { brief, token } = await seedExecutiveWithTodaysBrief("today");

    const res = await app.request("/api/v1/briefs/today", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<{ id: string }>(res)).data?.id).toBe(brief.id);
  });

  it("GET /today returns null when no brief exists yet today", async () => {
    const app = createApp();
    const email = `briefs-test-none-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    const res = await app.request("/api/v1/briefs/today", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await jsonBody(res)).data).toBeNull();
  });

  it("GET / lists briefs within the 30-day window", async () => {
    const app = createApp();
    const { brief, token } = await seedExecutiveWithTodaysBrief("list");

    const res = await app.request("/api/v1/briefs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await jsonBody<{ id: string }[]>(res);
    expect(body.data?.some((b) => b.id === brief.id)).toBe(true);
  });

  it("GET /:briefId returns 404 for a brief belonging to a different executive", async () => {
    const app = createApp();
    const { brief } = await seedExecutiveWithTodaysBrief("owner-a");
    const { token: tokenB } = await seedExecutiveWithTodaysBrief("owner-b");

    const res = await app.request(`/api/v1/briefs/${brief.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.status).toBe(404);
  });

  it("an accepted Delegate can view an executive's brief via ?executiveId=", async () => {
    const app = createApp();
    const { executive, brief } = await seedExecutiveWithTodaysBrief("delegate-target");
    const delegateEmail = `briefs-delegate-${Date.now()}@example.com`;
    await getDb()
      .insert(schema.delegateLinks)
      .values({ executiveId: executive.id, delegateEmail, status: "accepted" });
    const delegateToken = await signToken({ email: delegateEmail, role: "Delegate" });

    const res = await app.request(`/api/v1/briefs/today?executiveId=${executive.id}`, {
      headers: { Authorization: `Bearer ${delegateToken}` },
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<{ id: string }>(res)).data?.id).toBe(brief.id);
  });

  it("rejects an Administrator", async () => {
    const app = createApp();
    const adminToken = await signToken({
      email: `admin-briefs-${Date.now()}@example.com`,
      role: "Administrator",
    });
    const res = await app.request("/api/v1/briefs", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });
});
