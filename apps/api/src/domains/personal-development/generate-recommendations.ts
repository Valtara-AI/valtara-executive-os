// Generates and persists a batch of personal-development recommendations
// (books/podcasts/publications) for one executive - AI-curated only, no
// external service integration (Spotify/Goodreads explicitly out of scope,
// see DL-PROD-005-adjacent scoping notes in the plan this domain came
// from). No backing `agents` row: this is a platform-level recurring
// feature, same category as morning briefs, not delegable work.

import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import {
  completeStructured,
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@nyxor/ai-orchestrator";
import { logTaskEvent } from "@nyxor/audit";
import {
  PersonalDevRecommendationSchema,
  MIN_PERSONAL_DEV_RECOMMENDATIONS,
  MAX_PERSONAL_DEV_RECOMMENDATIONS,
} from "./schemas.js";

export class ExecutiveNotFoundError extends Error {
  constructor(executiveId: string) {
    super(`Executive ${executiveId} not found.`);
    this.name = "ExecutiveNotFoundError";
  }
}

/**
 * Generates a fresh batch of recommendations and inserts them as
 * `status: "suggested"` rows. Not idempotent by date the way generateBrief
 * is - callers (the weekly scheduler, or a manual "refresh" action) decide
 * when a new batch is warranted; this function always produces one.
 */
export async function generateRecommendations(
  executiveId: string,
  provider: InferenceProvider = getInferenceProvider("default"),
) {
  const db = getDb();

  const [executive] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.id, executiveId));
  if (!executive) throw new ExecutiveNotFoundError(executiveId);

  const [latestProfile] = await db
    .select()
    .from(schema.executiveIntelligenceProfiles)
    .where(eq(schema.executiveIntelligenceProfiles.executiveId, executiveId))
    .orderBy(desc(schema.executiveIntelligenceProfiles.version))
    .limit(1);

  const previousRecommendations = await db
    .select()
    .from(schema.personalDevelopmentRecommendations)
    .where(eq(schema.personalDevelopmentRecommendations.executiveId, executiveId));

  const systemPrompt = await renderPrompt("personal-development/generate-recommendations.v1.hbs", {
    executiveName: executive.name,
    title: executive.title ?? "an executive",
    industry: executive.domain,
    timeDrains: (latestProfile?.timeDrains as string[] | undefined) ?? [],
    topicsOfInterest: (latestProfile?.topicsOfInterest as string[] | undefined) ?? [],
    alreadyRecommended: previousRecommendations.map((r) => r.title),
    minCount: MIN_PERSONAL_DEV_RECOMMENDATIONS,
    maxCount: MAX_PERSONAL_DEV_RECOMMENDATIONS,
  });

  const result = await completeStructured(
    provider,
    {
      systemPrompt,
      messages: [{ role: "user", content: "Generate the recommendations now." }],
      maxOutputTokens: 1024,
    },
    PersonalDevRecommendationSchema,
  );

  const inserted = await db
    .insert(schema.personalDevelopmentRecommendations)
    .values(
      result.recommendations.map((r) => ({
        executiveId,
        type: r.type,
        title: r.title,
        creator: r.creator,
        rationale: r.rationale,
      })),
    )
    .returning();

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "personal_development_recommendations",
    entityId: executive.id,
    action: "personal_development_recommendations_generated",
    output: { count: inserted.length },
  });

  return inserted;
}
