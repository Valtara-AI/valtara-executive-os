// SRS §7 / SEC-001 §4: "Rate limiting | Per-user rate limits on all API
// endpoints; LLM inference endpoints have stricter limits; 429 responses
// include Retry-After header." Redis-backed fixed-window counter (INCR +
// conditional EXPIRE on the first hit in a window) - the standard simple
// approach for this; not perfectly atomic across the two round trips, but
// the only failure mode from that is an occasional key that outlives its
// window by a few requests, which self-heals once the window index rolls
// over. A sliding-window or token-bucket algorithm would close that gap
// but isn't justified by anything in this system's actual traffic shape.
//
// Reuses the same Redis connection BullMQ already holds
// (queue/connection.ts) rather than opening a second pool.

import type { Context, Next } from "hono";
import { fail } from "@nyxor/shared";
import { getRedisConnection } from "../queue/connection.js";
import { logger } from "../logger.js";
import type { AuthedVariables } from "./jwt.js";

export interface RateLimitOptions {
  /** Max requests allowed within one window. */
  limit: number;
  windowSeconds: number;
  /** Distinguishes independent limit buckets (e.g. "general" vs "onboarding-llm") sharing the same identifier. */
  scope: string;
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<{ Variables: AuthedVariables }>, next: Next) => {
    // Expected to run after jwtMiddleware on every route it's mounted on
    // in this app - the IP fallback is defensive, not a real code path,
    // since rate limiting isn't applied to any unauthenticated route here.
    const identifier =
      c.get("user")?.sub ??
      c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ??
      "anonymous";
    const windowIndex = Math.floor(Date.now() / 1000 / options.windowSeconds);
    const key = `ratelimit:${options.scope}:${identifier}:${windowIndex}`;

    // Fails open, not closed: rate limiting exists to protect the API from
    // abusive traffic, but its own store (Redis) being unreachable isn't a
    // reason to take the whole API down for every legitimate request too -
    // that would turn a rate limiter into a single point of failure worse
    // than the abuse it defends against. Logged so a persistently
    // unreachable Redis is still visible operationally.
    let count: number;
    try {
      const redis = getRedisConnection();
      count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, options.windowSeconds);
      }
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, scope: options.scope },
        "Rate limiter unavailable; failing open",
      );
      return next();
    }

    if (count > options.limit) {
      const retryAfterSeconds =
        options.windowSeconds - (Math.floor(Date.now() / 1000) % options.windowSeconds);
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json(
        fail("RATE_LIMITED", "Too many requests. Please slow down.", { retryAfterSeconds }),
        429,
      );
    }

    await next();
  };
}

// General tier: every JWT-authenticated route in app.ts. 120/min is
// generous for normal dashboard/API usage while still blocking a runaway
// client loop or script.
export const generalRateLimit = rateLimit({ limit: 120, windowSeconds: 60, scope: "general" });

// Stricter tier: the two onboarding endpoints that synchronously call the
// LLM within the request (respond, complete - see engine.ts). Every other
// LLM-invoking code path in this system (agent task execution, morning
// brief generation) runs in a BullMQ worker, not inline in an HTTP
// request, so it isn't gated by inbound API rate limiting at all - this is
// the one place a request directly triggers a billed inference call.
export const llmRateLimit = rateLimit({ limit: 10, windowSeconds: 60, scope: "onboarding-llm" });
