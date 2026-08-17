// Requires a live Redis. Uses tiny limits/windows so the suite stays fast
// rather than exercising the real 120/min and 10/min production tiers.

import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { getRedisConnection } from "../queue/connection.js";
import { rateLimit } from "./rate-limit.js";

const hasRedis = Boolean(process.env.REDIS_URL);

describe.skipIf(!hasRedis)("rateLimit", () => {
  const cleanupKeyPrefixes: string[] = [];

  afterEach(async () => {
    const redis = getRedisConnection();
    for (const prefix of cleanupKeyPrefixes.splice(0)) {
      const keys = await redis.keys(`ratelimit:${prefix}:*`);
      if (keys.length) await redis.del(...keys);
    }
  });

  function buildApp(scope: string, limit: number, windowSeconds = 60) {
    cleanupKeyPrefixes.push(scope);
    const app = new Hono();
    app.use("*", rateLimit({ limit, windowSeconds, scope }));
    app.get("/", (c) => c.json({ ok: true }));
    return app;
  }

  it("allows requests under the limit", async () => {
    const app = buildApp(`under-${Date.now()}`, 3);
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/", { headers: { "x-forwarded-for": "1.1.1.1" } });
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 with a Retry-After header once the limit is exceeded", async () => {
    const app = buildApp(`over-${Date.now()}`, 2);
    const ip = { headers: { "x-forwarded-for": "2.2.2.2" } };
    expect((await app.request("/", ip)).status).toBe(200);
    expect((await app.request("/", ip)).status).toBe(200);

    const blocked = await app.request("/", ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const body = (await blocked.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("tracks separate identifiers independently", async () => {
    const app = buildApp(`separate-${Date.now()}`, 1);
    expect((await app.request("/", { headers: { "x-forwarded-for": "3.3.3.3" } })).status).toBe(
      200,
    );
    // A different identifier gets its own budget, not blocked by the first's.
    expect((await app.request("/", { headers: { "x-forwarded-for": "4.4.4.4" } })).status).toBe(
      200,
    );
  });

  it("resets after the window elapses", async () => {
    const app = buildApp(`reset-${Date.now()}`, 1, 1);
    const ip = { headers: { "x-forwarded-for": "5.5.5.5" } };
    expect((await app.request("/", ip)).status).toBe(200);
    expect((await app.request("/", ip)).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await app.request("/", ip)).status).toBe(200);
  }, 5000);
});
