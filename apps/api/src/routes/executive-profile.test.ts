// DB-gated.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
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
