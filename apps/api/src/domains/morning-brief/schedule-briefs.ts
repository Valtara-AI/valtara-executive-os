// MB-01: "Cron job triggers at 05:30 executive local time; brief delivered
// by 06:00." A single server-wide cron can't satisfy "executive local
// time" across many timezones at once, so instead this runs frequently
// (every 15 minutes - see queue/brief-scheduler-worker.ts) and checks each
// executive's *current* local time against the generation window,
// enqueueing generation only for whoever's actually in it right now.
//
// executives.timezone defaults to "UTC" for every executive today, because
// onboarding's question bank never asks for it (a real, documented gap -
// see the schema comment on executives.timezone). Every executive who
// hasn't had that field set some other way effectively gets a UTC brief
// window regardless of where they actually are, which is likely wrong for
// most of them. Fixing that means adding an onboarding question (or a
// profile-settings field) to actually capture it - out of scope here,
// this only makes correct use of the field once it *is* set.

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { enqueueBriefGeneration } from "../../queue/brief-generation-queue.js";
import { localDateString } from "./generate-brief.js";

const WINDOW_START_MINUTES = 5 * 60 + 30; // 05:30
const WINDOW_END_MINUTES = 6 * 60; // 06:00

function minutesSinceMidnight(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isInGenerationWindow(timezone: string, at: Date = new Date()): boolean {
  const minutes = minutesSinceMidnight(timezone, at);
  return minutes >= WINDOW_START_MINUTES && minutes < WINDOW_END_MINUTES;
}

/**
 * Checks every executive's local time and enqueues brief generation for
 * whoever is currently in the 05:30-06:00 window and doesn't already have
 * a brief for today. Safe to call frequently - both the window check and
 * generateBrief's own idempotency guard prevent duplicates.
 */
export async function scheduleDueBriefs(at: Date = new Date()): Promise<number> {
  const db = getDb();
  const executives = await db.select().from(schema.executives);

  let enqueuedCount = 0;
  for (const executive of executives) {
    if (!isInGenerationWindow(executive.timezone, at)) continue;

    const today = localDateString(executive.timezone, at);
    const [existing] = await db
      .select({ id: schema.morningBriefs.id })
      .from(schema.morningBriefs)
      .where(
        and(
          eq(schema.morningBriefs.executiveId, executive.id),
          eq(schema.morningBriefs.date, today),
        ),
      );
    if (existing) continue;

    await enqueueBriefGeneration(executive.id);
    enqueuedCount++;
  }

  return enqueuedCount;
}
