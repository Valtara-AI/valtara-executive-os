// DL-ARCH-010's inbound webhook receiver - unauthenticated (no
// jwtMiddleware) like routes/integrations.ts's OAuth callback, for the
// same structural reason: this is Stripe calling us, not a browser or SPA
// carrying a Bearer token. Trust here comes entirely from
// handleStripeWebhook's signature verification, not from anything this
// route itself checks.

import { Hono } from "hono";
import { handleStripeWebhook } from "@nyxor/billing";
import { fail, ok } from "@nyxor/shared";
import { logger } from "../logger.js";

export const webhooksRoute = new Hono();

webhooksRoute.post("/stripe", async (c) => {
  const signature = c.req.header("Stripe-Signature");
  if (!signature) {
    return c.json(fail("MISSING_SIGNATURE", "Stripe-Signature header is required."), 400);
  }

  // Stripe signature verification needs the exact raw bytes it signed -
  // c.req.text() reads the body without JSON-parsing it, unlike c.req.json()
  // elsewhere in this codebase (see webhook-handler.ts's header).
  const rawBody = await c.req.text();

  try {
    await handleStripeWebhook(rawBody, signature);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Stripe webhook processing failed");
    return c.json(fail("WEBHOOK_ERROR", "Failed to process webhook."), 400);
  }

  return c.json(ok({ received: true }));
});
