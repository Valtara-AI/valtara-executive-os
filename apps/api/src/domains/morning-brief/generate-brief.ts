// MB-01/MB-02: composes and persists one executive's morning brief. See
// prompts/morning-brief/system.v1.hbs for which sections are implemented.
// Calendar/email were deferred in Sprint 3 (no integration existed to
// source them from honestly); now real when Google and/or Microsoft is
// connected - an executive could have either, both, or neither, so
// calendar/email context is gathered from whichever providers are
// connected and merged into one list rather than the brief having a
// separate section per provider.

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { getInferenceProvider, renderPrompt, type InferenceProvider } from "@nyxor/ai-orchestrator";
import { logTaskEvent } from "@nyxor/audit";
import {
  GoogleCalendarAdapter,
  GoogleMailAdapter,
  isGoogleConnected,
  OutlookCalendarAdapter,
  OutlookMailAdapter,
  isMicrosoftConnected,
  getQuotes,
  getHeadlines,
} from "@nyxor/integrations";

export class ExecutiveNotFoundError extends Error {
  constructor(executiveId: string) {
    super(`Executive ${executiveId} not found.`);
    this.name = "ExecutiveNotFoundError";
  }
}

/** YYYY-MM-DD in the given IANA timezone, for a real Date (default: now). */
export function localDateString(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

function summarizeTask(task: { status: string; prompt: string }, agentName: string): string {
  const truncatedPrompt = task.prompt.length > 80 ? `${task.prompt.slice(0, 80)}…` : task.prompt;
  return `${agentName} (${task.status}): ${truncatedPrompt}`;
}

interface ProviderContext {
  connected: boolean;
  calendarEvents: string[];
  emailDigest: string[];
}

const googleCalendarAdapter = new GoogleCalendarAdapter();
const googleMailAdapter = new GoogleMailAdapter();
const outlookCalendarAdapter = new OutlookCalendarAdapter();
const outlookMailAdapter = new OutlookMailAdapter();

// MB-04: "freshness ≤ 30 minutes" is satisfied by construction here - this
// runs at generation time, not from a cache. A fetch failure (expired
// token needing re-auth, a transient Google outage) degrades to an empty
// section rather than failing the whole brief - the executive still gets
// HITL/task status even if calendar/email couldn't be reached right now.
async function gatherGoogleContext(executiveId: string): Promise<ProviderContext> {
  const connected = await isGoogleConnected(executiveId);
  if (!connected) return { connected: false, calendarEvents: [], emailDigest: [] };

  const now = new Date();
  const twoDaysOut = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [calendarEvents, emailDigest] = await Promise.all([
    googleCalendarAdapter
      .listEvents(executiveId, now, twoDaysOut)
      .then((events) =>
        events.map((e) => {
          const when = e.start?.dateTime ?? e.start?.date ?? "unknown time";
          return `${e.summary ?? "(no title)"} — ${when}`;
        }),
      )
      .catch(() => []),
    googleMailAdapter
      .listThreads(executiveId, "is:unread", 5)
      .then((threads) => threads.map((t) => t.snippet))
      .catch(() => []),
  ]);

  return { connected: true, calendarEvents, emailDigest };
}

// Same freshness/degrade-gracefully rationale as gatherGoogleContext above.
async function gatherMicrosoftContext(executiveId: string): Promise<ProviderContext> {
  const connected = await isMicrosoftConnected(executiveId);
  if (!connected) return { connected: false, calendarEvents: [], emailDigest: [] };

  const now = new Date();
  const twoDaysOut = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [calendarEvents, emailDigest] = await Promise.all([
    outlookCalendarAdapter
      .listEvents(executiveId, now, twoDaysOut)
      .then((events) =>
        events.map((e) => {
          const when = e.start?.dateTime ?? "unknown time";
          return `${e.subject ?? "(no title)"} — ${when}`;
        }),
      )
      .catch(() => []),
    outlookMailAdapter
      .listUnreadMessages(executiveId, 5)
      .then((messages) => messages.map((m) => m.bodyPreview ?? m.subject ?? "(no preview)"))
      .catch(() => []),
  ]);

  return { connected: true, calendarEvents, emailDigest };
}

// v2: Portfolio and Breaking News. Same "gather narrowly, degrade to empty
// on failure, let the template decide whether to mention it at all" shape
// as gatherGoogleContext/gatherMicrosoftContext above - a market-data or
// news API outage should read exactly like an executive with no watchlist/
// interests, not surface an error into the brief.
async function gatherPortfolioContext(executiveId: string): Promise<string[]> {
  const db = getDb();
  const watchlist = await db
    .select()
    .from(schema.portfolioWatchlistItems)
    .where(eq(schema.portfolioWatchlistItems.executiveId, executiveId));
  if (watchlist.length === 0) return [];

  const quotes = await getQuotes(watchlist.map((item) => item.ticker)).catch(() => []);
  return quotes.map((q) => {
    const direction = q.changePercent >= 0 ? "+" : "";
    return `${q.ticker}: $${q.price.toFixed(2)} (${direction}${q.changePercent.toFixed(2)}%)`;
  });
}

async function gatherNewsContext(topicsOfInterest: string[]): Promise<string[]> {
  const headlines = await getHeadlines({ topics: topicsOfInterest, limit: 5 }).catch(() => []);
  return headlines.map((h) => `${h.title} (${h.source})`);
}

/**
 * Generates and persists today's (in the executive's own timezone) morning
 * brief. Idempotent: if one already exists for today, returns it unchanged
 * rather than regenerating - MB-01 is "once per day," not "once per call."
 */
export async function generateBrief(
  executiveId: string,
  provider: InferenceProvider = getInferenceProvider("default"),
) {
  const db = getDb();

  const [executive] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.id, executiveId));
  if (!executive) throw new ExecutiveNotFoundError(executiveId);

  const today = localDateString(executive.timezone);

  const [existing] = await db
    .select()
    .from(schema.morningBriefs)
    .where(
      and(eq(schema.morningBriefs.executiveId, executiveId), eq(schema.morningBriefs.date, today)),
    );
  if (existing) return existing;

  const pendingHitlItems = await db
    .select()
    .from(schema.hitlQueueItems)
    .where(
      and(
        eq(schema.hitlQueueItems.executiveId, executiveId),
        eq(schema.hitlQueueItems.status, "pending"),
      ),
    );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTasks = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.executiveId, executiveId), gte(schema.tasks.createdAt, since)))
    .orderBy(desc(schema.tasks.createdAt))
    .limit(20);

  const agentIds = [...new Set(recentTasks.map((t) => t.agentId))];
  const agents = agentIds.length
    ? await db.select().from(schema.agents).where(inArray(schema.agents.id, agentIds))
    : [];
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  const [latestProfile] = await db
    .select()
    .from(schema.executiveIntelligenceProfiles)
    .where(eq(schema.executiveIntelligenceProfiles.executiveId, executiveId))
    .orderBy(desc(schema.executiveIntelligenceProfiles.version))
    .limit(1);

  // topicsOfInterest is untyped jsonb at the schema level (same as
  // timeDrains/tools elsewhere in this profile) - cast here rather than
  // introducing a schema-level $type<string[]>() convention nothing else
  // in this table uses yet.
  const topicsOfInterest = (latestProfile?.topicsOfInterest as string[] | undefined) ?? [];

  const [googleContext, microsoftContext, portfolioSummary, breakingNews] = await Promise.all([
    gatherGoogleContext(executiveId),
    gatherMicrosoftContext(executiveId),
    gatherPortfolioContext(executiveId),
    gatherNewsContext(topicsOfInterest),
  ]);
  // Merged rather than sectioned per-provider: the brief cares about "what's
  // on the calendar / in the inbox," not which provider it came from, and
  // an executive connecting both would otherwise see duplicated headers for
  // no benefit.
  const calendarEmailConnected = googleContext.connected || microsoftContext.connected;
  const calendarEvents = [...googleContext.calendarEvents, ...microsoftContext.calendarEvents];
  const emailDigest = [...googleContext.emailDigest, ...microsoftContext.emailDigest];

  const systemPrompt = await renderPrompt("morning-brief/system.v2.hbs", {
    executiveName: executive.name,
    date: today,
    hitlQueueCount: pendingHitlItems.length,
    hitlItems: pendingHitlItems.slice(0, 10).map((item) => item.originalOutput.slice(0, 100)),
    taskSummaries: recentTasks.map((t) =>
      summarizeTask(t, agentNameById.get(t.agentId) ?? "Unknown agent"),
    ),
    timeDrains: latestProfile?.timeDrains ?? [],
    calendarEmailConnected,
    calendarEvents,
    emailDigest,
    portfolioSummary,
    breakingNews,
  });

  const result = await provider.complete({
    systemPrompt,
    messages: [{ role: "user", content: "Write the brief now." }],
    maxOutputTokens: 512,
  });

  const sectionsJson = {
    hitlQueueCount: pendingHitlItems.length,
    taskActivityCount: recentTasks.length,
    timeDrains: latestProfile?.timeDrains ?? [],
    googleConnected: googleContext.connected,
    microsoftConnected: microsoftContext.connected,
    calendarEventCount: calendarEvents.length,
    unreadEmailCount: emailDigest.length,
    portfolioTickerCount: portfolioSummary.length,
    newsHeadlineCount: breakingNews.length,
  };

  const [brief] = await db
    .insert(schema.morningBriefs)
    .values({ executiveId, date: today, content: result.content, sectionsJson })
    .returning();
  if (!brief) throw new Error("Failed to persist morning brief.");

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "morning_brief",
    entityId: brief.id,
    action: "morning_brief_generated",
    output: sectionsJson,
  });

  return brief;
}
