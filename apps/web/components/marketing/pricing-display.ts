// Hand-maintained: display names, list prices, and marketing copy, grounded
// in competitor research (Lindy.ai and Clara both price at $49.99/$99.99/
// $199.99 - the closest architectural comp, an AI agent workforce with
// human-in-the-loop oversight - see the plan and DL-PROD-004 for the full
// reasoning). `name` is the CAO-chosen display title (Plus/Pro/Enterprise)
// - the object's own keys stay "starter"/"pro"/"enterprise" to match
// SubscriptionTier and the existing STRIPE_PRICE_ID_STARTER env var, so
// this is a label change only, not a tier-identifier rename. Feature
// LIMITS must stay imported from @vex-os/billing/tiers, never re-typed
// here, to avoid the exact drift VEX-OS-DMP-001's sub-processor table
// had before this session fixed it.

import type { SubscriptionTier } from "@vex-os/billing/tiers";

export interface TierDisplay {
  name: string;
  priceLabel: string;
  tagline: string;
  features: readonly string[];
  highlighted?: boolean;
  ctaLabel: string;
}

export const PRICING_DISPLAY: Record<SubscriptionTier, TierDisplay> = {
  starter: {
    name: "Plus",
    priceLabel: "$59/mo",
    tagline: "For individual executives getting started.",
    features: [
      "3 AI agents",
      "Gmail + Outlook (Mail & Calendar)",
      "1 Delegate seat",
      "200 agent tasks/mo",
      "$20/mo AI usage included",
      "Human-in-the-loop approval on every action",
    ],
    ctaLabel: "Start free trial",
  },
  pro: {
    name: "Pro",
    priceLabel: "$149/mo",
    tagline: "For executives running a full agent workforce.",
    highlighted: true,
    features: [
      "10 AI agents",
      "+ Slack + PandaDoc",
      "5 Delegate seats",
      "2,000 agent tasks/mo",
      "$200/mo AI usage included",
      "Priority support",
    ],
    ctaLabel: "Start free trial",
  },
  enterprise: {
    name: "Enterprise",
    priceLabel: "Contact us",
    tagline: "Custom limits, SLA, and onboarding.",
    features: [
      "Unlimited agents, seats, tasks",
      "Custom AI usage budget",
      "All integrations",
      "Dedicated onboarding",
      "Custom SLA",
    ],
    ctaLabel: "Contact us",
  },
};

export const TRIAL_LABEL = "14-day free trial · No hidden credit meters";
