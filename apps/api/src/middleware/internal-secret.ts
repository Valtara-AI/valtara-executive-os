// Guards service-to-service endpoints (currently just /internal/resolve-role,
// called by apps/web's NextAuth server-side during sign-in - never by a
// browser, so a user JWT doesn't apply here). Timing-safe comparison since
// this is a shared secret, not a public key: a naive === leaks how many
// leading bytes matched via response-time differences.

import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { fail } from "@vex-os/shared";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function internalSecretMiddleware(c: Context, next: Next) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    throw new Error("INTERNAL_API_SECRET must be set (see .env.example).");
  }

  const provided = c.req.header("X-Internal-Secret");
  if (!provided || !safeEqual(provided, expected)) {
    return c.json(fail("UNAUTHORIZED", "Invalid internal service credentials."), 401);
  }

  await next();
}
