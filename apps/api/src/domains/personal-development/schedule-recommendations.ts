// Weekly refresh so an executive who exhausts their initial batch keeps
// getting new suggestions without an explicit "regenerate" action - matches
// how the brief itself treats "regenerate periodically" as the default
// expectation. Simpler than schedule-briefs.ts's per-timezone window logic:
// a weekly cadence doesn't need per-minute local-time precision the way
// "05:30 local" does, so this just checks "has it been >=7 days since this
// executive's last batch" against a single fixed weekly tick.

import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { enqueuePersonalDevGeneration } from "../../queue/personal-dev-generation-queue.js";

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks every executive's most recent recommendation batch and enqueues a
 * new one for whoever's overdue (never generated, or >=7 days since the
 * last batch). Safe to call frequently - the idempotency check here is the
 * only guard (generateRecommendations itself isn't idempotent by date the
 * way generateBrief is).
 */
export async function scheduleDueRecommendations(at: Date = new Date()): Promise<number> {
  const db = getDb();
  const executives = await db.select().from(schema.executives);

  let enqueuedCount = 0;
  for (const executive of executives) {
    const [latest] = await db
      .select({ recommendedAt: schema.personalDevelopmentRecommendations.recommendedAt })
      .from(schema.personalDevelopmentRecommendations)
      .where(eq(schema.personalDevelopmentRecommendations.executiveId, executive.id))
      .orderBy(desc(schema.personalDevelopmentRecommendations.recommendedAt))
      .limit(1);

    const isDue = !latest || at.getTime() - latest.recommendedAt.getTime() >= REFRESH_INTERVAL_MS;
    if (!isDue) continue;

    await enqueuePersonalDevGeneration(executive.id);
    enqueuedCount++;
  }

  return enqueuedCount;
}
