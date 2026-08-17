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
import { getDb, schema } from "@vex-os/database";
import { ok } from "@vex-os/shared";
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
