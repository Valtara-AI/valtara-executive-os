// DL-ARCH-010: the one inbound-webhook receiver in this codebase - every
// other integration (Gmail, Calendar, Teams, Slack, PandaDoc) is
// pull/polling-based. Signature verification (stripe.webhooks.constructEvent)
// requires the RAW request body, not JSON-parsed - the caller (routes/
// webhooks.ts) must pass the exact bytes Stripe signed, or verification
// fails even for a genuine event.
//
// current_period_end lives on the subscription's first item
// (items.data[0].current_period_end), not top-level on the Subscription
// object - confirmed against Stripe's own object reference rather than
// assumed, since this moved off the top-level Subscription shape in a
// past API version and an easy mistake to get wrong silently.

import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import type Stripe from "stripe";
import { getStripeClient } from "./stripe-client.js";
import { tierForPriceId } from "./tiers.js";

function toDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000) : null;
}

// Stripe's own status enum has two values ("unpaid", "paused") this
// product doesn't distinguish for gating purposes - both fold to
// "past_due" since the entitlement outcome (no active paid access) is the
// same either way. "incomplete_expired" folds to "canceled" for the same
// reason.
function toVexStatus(
  stripeStatus: Stripe.Subscription.Status,
): (typeof schema.subscriptions.$inferInsert)["status"] {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  executiveId?: string,
): Promise<void> {
  const db = getDb();
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error(`Stripe subscription ${subscription.id} has no line items.`);
  }

  const values = {
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    tier: tierForPriceId(priceId),
    status: toVexStatus(subscription.status),
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodEnd: toDate(subscription.items.data[0]?.current_period_end),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id));

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set(values)
      .where(eq(schema.subscriptions.id, existing.id));
    return;
  }

  const resolvedExecutiveId = executiveId ?? subscription.metadata.executiveId;
  if (!resolvedExecutiveId) {
    throw new Error(
      `Cannot create a subscription row for ${subscription.id}: no executiveId in client_reference_id or subscription metadata.`,
    );
  }

  await db.insert(schema.subscriptions).values({ executiveId: resolvedExecutiveId, ...values });
}

/**
 * Verifies and dispatches one Stripe webhook event. Throws on signature
 * failure (the caller turns that into a 400) or on an event this handler
 * can't process; returns silently for event types it doesn't act on -
 * Stripe's own best practice is to ignore, not error on, event types you
 * didn't subscribe to.
 */
export async function handleStripeWebhook(rawBody: string, signatureHeader: string): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be set (see .env.example).");
  }
  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string" ? session.subscription : session.subscription.id,
      );
      await upsertFromSubscription(subscription, session.client_reference_id ?? undefined);
      return;
    }
    case "customer.subscription.updated": {
      await upsertFromSubscription(event.data.object);
      return;
    }
    case "customer.subscription.deleted": {
      const db = getDb();
      await db
        .update(schema.subscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(schema.subscriptions.stripeSubscriptionId, event.data.object.id));
      return;
    }
    default:
      return;
  }
}
