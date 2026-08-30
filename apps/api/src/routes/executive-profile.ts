// API-001 §2.3: "GET /executive/profile | Retrieve executive profile and
// Intelligence Profile | Returns current version; includes agent workforce
// summary." Mounted at /api/v1/executive/profile. Executive-only - a
// Delegate has no executives row of their own to retrieve.
//
// The concrete reason this exists now rather than staying deferred: apps/web's
// root page needs *some* way to tell "onboarded, go to /dashboard" from
// "not onboarded, go to /onboarding" without guessing from unrelated data.

import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@nyxor/database";
import { MAX_TOPICS_OF_INTEREST, fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const executiveProfileRoute = new Hono<{ Variables: AuthedVariables }>();

executiveProfileRoute.use("*", requireRole("Executive"));

executiveProfileRoute.get("/", async (c) => {
  const { id } = await resolveExecutive(c.get("user"));
  const db = getDb();

  const [executive] = await db.select().from(schema.executives).where(eq(schema.executives.id, id));
  if (!executive) throw new Error(`Executive ${id} vanished between resolve and read.`);

  const [intelligenceProfile] = await db
    .select()
    .from(schema.executiveIntelligenceProfiles)
    .where(eq(schema.executiveIntelligenceProfiles.executiveId, id))
    .orderBy(desc(schema.executiveIntelligenceProfiles.version))
    .limit(1);

  const [voiceProfile] = executive.voiceProfileId
    ? await db
        .select()
        .from(schema.voiceProfiles)
        .where(eq(schema.voiceProfiles.id, executive.voiceProfileId))
    : [undefined];

  const agents = await db.select().from(schema.agents).where(eq(schema.agents.executiveId, id));

  return c.json(
    ok({
      executive,
      intelligenceProfile: intelligenceProfile ?? null,
      voiceProfile: voiceProfile ?? null,
      agentWorkforceSummary: {
        total: agents.length,
        active: agents.filter((a) => a.status === "active").length,
      },
    }),
  );
});

const UpdateProfileSchema = z.object({
  topicsOfInterest: z.array(z.string()).max(MAX_TOPICS_OF_INTEREST),
});

// Inserts a new *version* row rather than updating in place, consistent with
// executiveIntelligenceProfiles.version and the orderBy(desc(version)).limit(1)
// read convention used here and in generate-brief.ts. Unlike the other
// profile fields (set once at onboarding, never re-edited), topicsOfInterest
// is expected to drift over time - this is the only writer of it post-onboarding.
executiveProfileRoute.patch("/", async (c) => {
  const { id } = await resolveExecutive(c.get("user"));
  const db = getDb();

  const parsed = UpdateProfileSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const [latest] = await db
    .select()
    .from(schema.executiveIntelligenceProfiles)
    .where(eq(schema.executiveIntelligenceProfiles.executiveId, id))
    .orderBy(desc(schema.executiveIntelligenceProfiles.version))
    .limit(1);
  if (!latest) {
    return c.json(
      fail("NOT_FOUND", "No intelligence profile exists yet - complete onboarding first."),
      404,
    );
  }

  const [updated] = await db
    .insert(schema.executiveIntelligenceProfiles)
    .values({
      executiveId: id,
      version: latest.version + 1,
      timeDrains: latest.timeDrains,
      delegationCandidates: latest.delegationCandidates,
      communicationStyle: latest.communicationStyle,
      tools: latest.tools,
      topicsOfInterest: parsed.data.topicsOfInterest,
    })
    .returning();
  return c.json(ok(updated));
});
