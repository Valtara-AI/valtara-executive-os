// DL-ARCH-010: tier structure is 3 tiers (starter/pro/enterprise) + a
// 14-day trial, gating on all four axes the CAO named - agent count,
// integration access, delegate seats, and monthly task volume. Actual
// prices live in Stripe (via STRIPE_PRICE_ID_* env vars, not here) - this
// file only defines what each tier unlocks, not what it costs.

export type SubscriptionTier = "starter" | "pro" | "enterprise";

export interface TierLimits {
  maxAgents: number;
  allowedIntegrations: readonly string[];
  maxDelegateSeats: number;
  maxMonthlyTasks: number;
  /**
   * USD cents of LLM spend included per month (DL-ARCH-014). Hard cap, not
   * metered overage - once reached, new tasks are rejected until the next
   * calendar month. Starting figures, not a finalized pricing decision -
   * tune against real usage once live traffic exists.
   */
  maxMonthlyCostCents: number;
}

// `Infinity` is a real, intentional value here (not a placeholder) -
// entitlements.ts compares counts against it with plain `<`, which works
// correctly for "unlimited" without a separate null-means-unlimited branch.
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  starter: {
    maxAgents: 3,
    allowedIntegrations: ["google", "microsoft"],
    maxDelegateSeats: 1,
    maxMonthlyTasks: 200,
    maxMonthlyCostCents: 2000, // $20.00
  },
  pro: {
    maxAgents: 10,
    allowedIntegrations: ["google", "microsoft", "slack", "pandadoc"],
    maxDelegateSeats: 5,
    maxMonthlyTasks: 2000,
    maxMonthlyCostCents: 20000, // $200.00
  },
  enterprise: {
    maxAgents: Infinity,
    allowedIntegrations: ["google", "microsoft", "slack", "pandadoc"],
    maxDelegateSeats: Infinity,
    maxMonthlyTasks: Infinity,
    maxMonthlyCostCents: Infinity,
  },
};

export const TRIAL_PERIOD_DAYS = 14;

export function getTierPriceId(tier: SubscriptionTier): string {
  const envVar = `STRIPE_PRICE_ID_${tier.toUpperCase()}`;
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(
      `${envVar} must be set (see .env.example) to check out for the "${tier}" tier.`,
    );
  }
  return priceId;
}

export function tierForPriceId(priceId: string): SubscriptionTier {
  const match = (Object.keys(TIER_LIMITS) as SubscriptionTier[]).find(
    (tier) => process.env[`STRIPE_PRICE_ID_${tier.toUpperCase()}`] === priceId,
  );
  if (!match) {
    throw new Error(
      `Stripe price "${priceId}" does not match any configured STRIPE_PRICE_ID_* tier.`,
    );
  }
  return match;
}
