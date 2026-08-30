import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { scheduleDueRecommendations } from "./schedule-recommendations.js";
import { getPersonalDevGenerationQueue } from "../../queue/personal-dev-generation-queue.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);

describe.skipIf(!hasDb || !hasRedis)("scheduleDueRecommendations", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  afterAll(async () => {
    await getPersonalDevGenerationQueue().close();
  });

  it("enqueues an executive who has never received a batch", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Never Recommended", email: `never-rec-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const queue = getPersonalDevGenerationQueue();
    await queue.drain();

    try {
      const enqueuedCount = await scheduleDueRecommendations();
      expect(enqueuedCount).toBeGreaterThanOrEqual(1);

      const waitingJobs = await queue.getJobs(["waiting"]);
      const enqueuedExecutiveIds = waitingJobs.map((j) => j.data.executiveId as string);
      expect(enqueuedExecutiveIds).toContain(executive!.id);
    } finally {
      await queue.drain();
    }
  });

  it("skips an executive whose last batch was less than 7 days ago", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Recently Recommended", email: `recent-rec-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const now = new Date("2026-03-15T12:00:00Z");
    await db.insert(schema.personalDevelopmentRecommendations).values({
      executiveId: executive!.id,
      type: "book",
      title: "Recent",
      rationale: "r",
      recommendedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });

    const queue = getPersonalDevGenerationQueue();
    await queue.drain();

    await scheduleDueRecommendations(now);

    const waitingJobs = await queue.getJobs(["waiting"]);
    const enqueuedExecutiveIds = waitingJobs.map((j) => j.data.executiveId as string);
    expect(enqueuedExecutiveIds).not.toContain(executive!.id);
  });

  it("re-enqueues an executive whose last batch was >=7 days ago", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Overdue Recommended", email: `overdue-rec-${Date.now()}@example.com` })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const now = new Date("2026-03-15T12:00:00Z");
    await db.insert(schema.personalDevelopmentRecommendations).values({
      executiveId: executive!.id,
      type: "book",
      title: "Old",
      rationale: "r",
      recommendedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    });

    const queue = getPersonalDevGenerationQueue();
    await queue.drain();

    try {
      await scheduleDueRecommendations(now);
      const waitingJobs = await queue.getJobs(["waiting"]);
      const enqueuedExecutiveIds = waitingJobs.map((j) => j.data.executiveId as string);
      expect(enqueuedExecutiveIds).toContain(executive!.id);
    } finally {
      await queue.drain();
    }
  });
});
