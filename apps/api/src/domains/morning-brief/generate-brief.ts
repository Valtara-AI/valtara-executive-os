// MB-01/MB-02: composes and persists one executive's morning brief. See
// prompts/morning-brief/system.v1.hbs for which sections are actually
// implemented (HITL queue + task activity + known time drains) versus
// deferred (calendar, email - no integrations exist until Sprint 4+).

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@vex-os/ai-orchestrator";
import { logTaskEvent } from "@vex-os/audit";

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

  const systemPrompt = await renderPrompt("morning-brief/system.v1.hbs", {
    executiveName: executive.name,
    date: today,
    hitlQueueCount: pendingHitlItems.length,
    hitlItems: pendingHitlItems.slice(0, 10).map((item) => item.originalOutput.slice(0, 100)),
    taskSummaries: recentTasks.map((t) =>
      summarizeTask(t, agentNameById.get(t.agentId) ?? "Unknown agent"),
    ),
    timeDrains: latestProfile?.timeDrains ?? [],
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
