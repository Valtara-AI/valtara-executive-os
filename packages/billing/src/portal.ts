// Stripe's hosted Customer Portal - self-serve plan changes, payment method
// updates, and cancellation, without NYXOR needing to build any of that
// UI itself.

import { getStripeClient } from "./stripe-client.js";

export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
  return { url: session.url };
}
