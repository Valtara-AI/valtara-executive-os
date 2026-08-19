// Signature verification is pure local HMAC (no network call), so this
// doesn't need `hasDb` gating or a real Stripe account - only a dummy
// STRIPE_SECRET_KEY (to construct the client) and a real
// STRIPE_WEBHOOK_SECRET to compute a matching signature against, per
// Stripe's own documented v1 scheme (docs.stripe.com/webhooks#verify-manually).

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { handleStripeWebhook } from "../webhook-handler.js";

const WEBHOOK_SECRET = "whsec_test_secret";

function signPayload(payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  // Stripe's own docs: "Use the endpoint's signing secret as the key" - the
  // whole whsec_... string, not stripped, confirmed by matching the real
  // SDK's constructEvent() behavior (it rejected a stripped-prefix key).
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("handleStripeWebhook", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("throws on an invalid signature rather than processing the event", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1" } },
    });
    await expect(handleStripeWebhook(payload, "t=1,v1=not-a-real-signature")).rejects.toThrow();
  });

  it("throws when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1" } },
    });
    await expect(handleStripeWebhook(payload, signPayload(payload))).rejects.toThrow(
      /STRIPE_WEBHOOK_SECRET/,
    );
  });

  it("resolves without throwing for an event type it doesn't act on, given a valid signature", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      api_version: "2025-01-01",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      type: "invoice.payment_failed",
      data: { object: { id: "in_1" } },
    });
    await expect(handleStripeWebhook(payload, signPayload(payload))).resolves.toBeUndefined();
  });
});
