// The one file in this package permitted to import the `stripe` SDK
// directly - enforced by eslint.config.js's no-restricted-imports carve-out,
// mirroring how packages/ai-orchestrator/src/providers/*.ts is the only
// place allowed to import an LLM provider SDK (CLAUDE.md non-negotiable
// #1's pattern, applied to the one other third-party SDK this codebase
// depends on for a core business function).

import Stripe from "stripe";

let cachedClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY must be set (see .env.example).");
  }
  cachedClient = new Stripe(secretKey);
  return cachedClient;
}
