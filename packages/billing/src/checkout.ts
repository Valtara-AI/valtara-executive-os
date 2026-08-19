// Stripe Checkout Session creation (subscription mode). Card is collected
// upfront (Checkout's default payment_method_collection: "always") even
// though the trial means nothing is charged for TRIAL_PERIOD_DAYS - the
// simpler, Stripe-recommended default over a no-card trial, which would
// need its own follow-up "add a payment method before your trial ends"
// flow this product doesn't have yet.

import { getStripeClient } from "./stripe-client.js";
import { getTierPriceId, TRIAL_PERIOD_DAYS, type SubscriptionTier } from "./tiers.js";

export async function createCheckoutSession(params: {
  executiveId: string;
  email: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getTierPriceId(params.tier), quantity: 1 }],
    customer_email: params.email,
    // Ties the completed Checkout Session (and the webhook event it fires)
    // back to the Executive row - see webhook-handler.ts's use of this on
    // checkout.session.completed.
    client_reference_id: params.executiveId,
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { executiveId: params.executiveId },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session was created without a redirect URL.");
  }
  return { url: session.url };
}
