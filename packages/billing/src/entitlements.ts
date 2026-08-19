// DL-ARCH-010's enforcement layer. Every gated action (create agent,
// connect an integration, invite a delegate, assign a task) calls one of
// the assert* functions here before doing the real work, and the route
// catches EntitlementError and turns it into a 402 response - the same
// "insert/check before the real side effect" shape DL-ARCH-005's HITL gate
// uses, just app-layer rather than a database trigger, since this isn't a
// security boundary the way HITL is - a bypassed entitlement check costs
// VEX-OS revenue, not an unapproved external action.

import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { TIER_LIMITS, type SubscriptionTier, type TierLimits } from "./tiers.js";
import { computeCostCents } from "./model-pricing.js";

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

const ZERO_LIMITS: TierLimits = {
  maxAgents: 0,
  allowedIntegrations: [],
  maxDelegateSeats: 0,
  maxMonthlyTasks: 0,
  maxMonthlyCostCents: 0,
};

function startOfCurrentMonthUtc(): Date {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  return startOfMonth;
}

export interface EntitlementState {
  tier: SubscriptionTier | null;
  status: (typeof schema.subscriptions.$inferSelect)["status"] | "none";
  limits: TierLimits;
}

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

export async function getEntitlements(executiveId: string): Promise<EntitlementState> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.executiveId, executiveId));

  if (!row) return { tier: null, status: "none", limits: ZERO_LIMITS };

  const hasAccess = ACTIVE_STATUSES.has(row.status);
  return {
    tier: row.tier,
    status: row.status,
    limits: hasAccess ? TIER_LIMITS[row.tier] : ZERO_LIMITS,
  };
}

export async function assertAgentLimit(executiveId: string): Promise<void> {
  const { limits } = await getEntitlements(executiveId);
  const db = getDb();
  const activeAgents = await db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(and(eq(schema.agents.executiveId, executiveId), eq(schema.agents.status, "active")));

  if (activeAgents.length >= limits.maxAgents) {
    throw new EntitlementError(
      `Agent limit reached (${limits.maxAgents} on your current plan). Upgrade to add more agents.`,
    );
  }
}

export async function assertIntegrationAllowed(
  executiveId: string,
  provider: string,
): Promise<void> {
  const { limits } = await getEntitlements(executiveId);
  if (!limits.allowedIntegrations.includes(provider)) {
    throw new EntitlementError(`"${provider}" is not available on your current plan.`);
  }
}

export async function assertSeatLimit(executiveId: string): Promise<void> {
  const { limits } = await getEntitlements(executiveId);
  const db = getDb();
  const activeSeats = await db
    .select({ id: schema.delegateLinks.id })
    .from(schema.delegateLinks)
    .where(
      and(
        eq(schema.delegateLinks.executiveId, executiveId),
        inArray(schema.delegateLinks.status, ["pending", "accepted"]),
      ),
    );

  if (activeSeats.length >= limits.maxDelegateSeats) {
    throw new EntitlementError(
      `Delegate seat limit reached (${limits.maxDelegateSeats} on your current plan). Upgrade to invite more delegates.`,
    );
  }
}

export async function assertTaskVolume(executiveId: string): Promise<void> {
  const { limits } = await getEntitlements(executiveId);
  const db = getDb();

  const tasksThisMonth = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.executiveId, executiveId),
        gte(schema.tasks.createdAt, startOfCurrentMonthUtc()),
      ),
    );

  if (tasksThisMonth.length >= limits.maxMonthlyTasks) {
    throw new EntitlementError(
      `Monthly task limit reached (${limits.maxMonthlyTasks} on your current plan). Upgrade or wait until next month.`,
    );
  }
}

/**
 * Hard cap on LLM spend (DL-ARCH-014) - distinct from assertTaskVolume's
 * task *count* cap, since a handful of expensive tasks can burn far more
 * than a per-task-count limit implies. Sums real cost from taskOutputs
 * (which already records modelId/tokensInput/tokensOutput per task) for
 * the current calendar month, computed via model-pricing.ts's published
 * rates. Same enforcement point as the other assert* functions - called
 * before a new task is created, not re-checked mid-execution.
 */
export async function assertCostBudget(executiveId: string): Promise<void> {
  const { limits } = await getEntitlements(executiveId);
  if (limits.maxMonthlyCostCents === Infinity) return;

  const db = getDb();
  const outputsThisMonth = await db
    .select({
      modelId: schema.taskOutputs.modelId,
      tokensInput: schema.taskOutputs.tokensInput,
      tokensOutput: schema.taskOutputs.tokensOutput,
    })
    .from(schema.taskOutputs)
    .innerJoin(schema.tasks, eq(schema.taskOutputs.taskId, schema.tasks.id))
    .where(
      and(
        eq(schema.tasks.executiveId, executiveId),
        gte(schema.taskOutputs.createdAt, startOfCurrentMonthUtc()),
      ),
    );

  const spentCents = outputsThisMonth.reduce(
    (total, row) => total + computeCostCents(row.modelId, row.tokensInput, row.tokensOutput),
    0,
  );

  if (spentCents >= limits.maxMonthlyCostCents) {
    throw new EntitlementError(
      `Monthly usage budget reached ($${(limits.maxMonthlyCostCents / 100).toFixed(2)} on your current plan). Upgrade or wait until next month.`,
    );
  }
}
