import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { isInGenerationWindow, scheduleDueBriefs } from "./schedule-briefs.js";
import { getBriefGenerationQueue } from "../../queue/brief-generation-queue.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);

describe("isInGenerationWindow", () => {
  // Saskatchewan doesn't observe DST - America/Regina is UTC-6 year-round,
  // not UTC-7. Local 05:30 is UTC 11:30.
  it("is true at 05:30 local time", () => {
    expect(isInGenerationWindow("America/Regina", new Date("2026-03-15T11:30:00Z"))).toBe(true);
  });

  it("is true just before 06:00 local time", () => {
    expect(isInGenerationWindow("America/Regina", new Date("2026-03-15T11:59:00Z"))).toBe(true);
  });

  it("is false at exactly 06:00 local time (window is [05:30, 06:00))", () => {
    expect(isInGenerationWindow("America/Regina", new Date("2026-03-15T12:00:00Z"))).toBe(false);
  });

  it("is false at 05:29 local time", () => {
    expect(isInGenerationWindow("America/Regina", new Date("2026-03-15T11:29:00Z"))).toBe(false);
  });

  it("is false at midday", () => {
    expect(isInGenerationWindow("America/Regina", new Date("2026-03-15T19:00:00Z"))).toBe(false);
  });
});

describe.skipIf(!hasDb || !hasRedis)("scheduleDueBriefs", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  afterAll(async () => {
    await getBriefGenerationQueue().close();
  });

  it("enqueues generation only for executives currently in their window", async () => {
    const db = getDb();
    const [inWindow] = await db
      .insert(schema.executives)
      .values({
        name: "In Window",
        email: `in-window-${Date.now()}@example.com`,
        timezone: "America/Regina",
      })
      .returning();
    const [outOfWindow] = await db
      .insert(schema.executives)
      .values({
        // Deliberately a different timezone from inWindow: at the single
        // instant this test checks, 11:45 UTC is 05:45 in America/Regina
        // (in window) but 20:45 in Asia/Tokyo (nowhere close) - same
        // timezone for both would make them identical, defeating the point.
        name: "Out Of Window",
        email: `out-of-window-${Date.now()}@example.com`,
        timezone: "Asia/Tokyo",
      })
      .returning();
    cleanupExecutiveIds.push(inWindow!.id, outOfWindow!.id);

    const queue = getBriefGenerationQueue();
    await queue.drain();

    // try/finally, not a trailing drain(): an assertion failure here must
    // not leave a stray job in this shared queue for whichever test file
    // runs next against the same Redis (fileParallelism is off, but the
    // queue itself persists across files within a run).
    try {
      // 11:45 UTC = 05:45 America/Regina (UTC-6, no DST) - in window.
      const enqueuedCount = await scheduleDueBriefs(new Date("2026-03-15T11:45:00Z"));
      expect(enqueuedCount).toBeGreaterThanOrEqual(1);

      const waitingJobs = await queue.getJobs(["waiting"]);
      const enqueuedExecutiveIds = waitingJobs.map((j) => j.data.executiveId as string);
      expect(enqueuedExecutiveIds).toContain(inWindow!.id);
      expect(enqueuedExecutiveIds).not.toContain(outOfWindow!.id);
    } finally {
      await queue.drain();
    }
  });

  it("does not enqueue a second time if a brief already exists for today", async () => {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Already Briefed",
        email: `already-briefed-${Date.now()}@example.com`,
        timezone: "UTC",
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);

    const at = new Date("2026-03-15T05:45:00Z"); // in UTC's own window
    await db.insert(schema.morningBriefs).values({
      executiveId: executive!.id,
      date: "2026-03-15",
      content: "Already generated.",
    });

    const queue = getBriefGenerationQueue();
    await queue.drain();

    await scheduleDueBriefs(at);

    const waitingJobs = await queue.getJobs(["waiting"]);
    const enqueuedExecutiveIds = waitingJobs.map((j) => j.data.executiveId as string);
    expect(enqueuedExecutiveIds).not.toContain(executive!.id);
  });
});
