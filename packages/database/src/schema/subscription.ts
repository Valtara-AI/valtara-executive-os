import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { subscriptionStatusEnum, subscriptionTierEnum } from "./enums.js";
import { executives } from "./executive.js";

// DL-ARCH-010: one subscription per executive (each Executive is its own
// billing tenant - VEX-OS has no separate Organization entity today). Not
// created until the executive completes Stripe Checkout; see
// packages/billing/src/entitlements.ts for what "no row yet" means for
// gating.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executiveId: uuid("executive_id")
      .notNull()
      .references(() => executives.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    tier: subscriptionTierEnum("tier").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.executiveId)],
);
