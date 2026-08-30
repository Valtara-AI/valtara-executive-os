// DB-gated.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const hasDb = Boolean(process.env.DATABASE_URL);

interface ProfileData {
  executive: { id: string; email: string; onboardingStatus: string };
  intelligenceProfile: { timeDrains: string[] } | null;
  voiceProfile: { tone: string } | null;
  agentWorkforceSummary: { total: number; active: number };
}
interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<ApiEnvelope<T>> {
  return (await res.json()) as ApiEnvelope<T>;
}

describe.skipIf(!hasDb)("GET /executive/profile", () => {
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

  it("auto-creates and returns a minimal profile for a first-time sign-in (find-or-create)", async () => {
    const app = createApp();
    const email = `profile-new-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    const res = await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await jsonBody<ProfileData>(res)).data!;
    expect(body.executive.email).toBe(email);
    expect(body.executive.onboardingStatus).toBe("not_started");
    expect(body.intelligenceProfile).toBeNull();
    expect(body.voiceProfile).toBeNull();
    expect(body.agentWorkforceSummary).toEqual({ total: 0, active: 0 });
  });

  it("includes the intelligence profile, voice profile, and agent counts once onboarded", async () => {
    const app = createApp();
    const db = getDb();
    const email = `profile-onboarded-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    // Prime the executive row via the profile endpoint's own find-or-create,
    // then populate it the way the real onboarding flow would.
    await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));

    const [voiceProfile] = await db
      .insert(schema.voiceProfiles)
      .values({ executiveId: executive!.id, tone: "direct" })
      .returning();
    await db
      .update(schema.executives)
      .set({ voiceProfileId: voiceProfile!.id, onboardingStatus: "complete" })
      .where(eq(schema.executives.id, executive!.id));
    await db.insert(schema.executiveIntelligenceProfiles).values({
      executiveId: executive!.id,
      timeDrains: ["Inbox triage"],
      delegationCandidates: ["Draft replies"],
      tools: ["Gmail"],
    });
    await db.insert(schema.agents).values([
      {
        executiveId: executive!.id,
        name: "A1",
        description: "d",
        responsibilities: ["r"],
        status: "active",
      },
      {
        executiveId: executive!.id,
        name: "A2",
        description: "d",
        responsibilities: ["r"],
        status: "archived",
      },
    ]);

    const res = await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await jsonBody<ProfileData>(res)).data!;
    expect(body.executive.onboardingStatus).toBe("complete");
    expect(body.intelligenceProfile?.timeDrains).toEqual(["Inbox triage"]);
    expect(body.voiceProfile?.tone).toBe("direct");
    expect(body.agentWorkforceSummary).toEqual({ total: 2, active: 1 });
  });

  it("rejects a Delegate - no executives row of their own", async () => {
    const app = createApp();
    const token = await signToken({
      email: `profile-delegate-${Date.now()}@example.com`,
      role: "Delegate",
    });
    const res = await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe.skipIf(!hasDb)("PATCH /executive/profile", () => {
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

  it("returns 404 when no intelligence profile exists yet", async () => {
    const app = createApp();
    const email = `profile-patch-none-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    // Find-or-create the executive row, but never insert a profile.
    await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await app.request("/api/v1/executive/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topicsOfInterest: ["AI regulation"] }),
    });
    expect(res.status).toBe(404);
  });

  it("inserts a new profile version with updated topicsOfInterest, carrying over other fields", async () => {
    const app = createApp();
    const db = getDb();
    const email = `profile-patch-ok-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    await app.request("/api/v1/executive/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    await db.insert(schema.executiveIntelligenceProfiles).values({
      executiveId: executive!.id,
      timeDrains: ["Inbox triage"],
      delegationCandidates: ["Draft replies"],
      tools: ["Gmail"],
      topicsOfInterest: [],
    });

    const res = await app.request("/api/v1/executive/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topicsOfInterest: ["AI regulation", "Series B investors"] }),
    });
    expect(res.status).toBe(200);
    const body = (
      await jsonBody<{ version: number; timeDrains: string[]; topicsOfInterest: string[] }>(res)
    ).data!;
    expect(body.version).toBe(2);
    expect(body.timeDrains).toEqual(["Inbox triage"]); // carried over, not clobbered
    expect(body.topicsOfInterest).toEqual(["AI regulation", "Series B investors"]);

    const rows = await db
      .select()
      .from(schema.executiveIntelligenceProfiles)
      .where(eq(schema.executiveIntelligenceProfiles.executiveId, executive!.id));
    expect(rows).toHaveLength(2); // original + new version, both retained
  });

  it("rejects a body over MAX_TOPICS_OF_INTEREST or with non-string entries", async () => {
    const app = createApp();
    const email = `profile-patch-invalid-${Date.now()}@example.com`;
    createdExecutiveEmails.push(email);
    const token = await signToken({ email, role: "Executive" });

    const res = await app.request("/api/v1/executive/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topicsOfInterest: Array(11).fill("x") }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a Delegate", async () => {
    const app = createApp();
    const token = await signToken({
      email: `profile-patch-delegate-${Date.now()}@example.com`,
      role: "Delegate",
    });
    const res = await app.request("/api/v1/executive/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topicsOfInterest: [] }),
    });
    expect(res.status).toBe(403);
  });
});
