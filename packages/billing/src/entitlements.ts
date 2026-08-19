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
};

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
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const tasksThisMonth = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(
      and(eq(schema.tasks.executiveId, executiveId), gte(schema.tasks.createdAt, startOfMonth)),
    );

  if (tasksThisMonth.length >= limits.maxMonthlyTasks) {
    throw new EntitlementError(
      `Monthly task limit reached (${limits.maxMonthlyTasks} on your current plan). Upgrade or wait until next month.`,
    );
  }
}
