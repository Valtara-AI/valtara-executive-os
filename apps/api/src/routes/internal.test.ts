// No DB gating needed for the auth-boundary tests (resolveRoleForEmail
// itself is DB-gated and tested separately); this focuses on
// internalSecretMiddleware actually protecting the route.

import { beforeAll, describe, expect, it } from "vitest";

interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<ApiEnvelope<T>> {
  return (await res.json()) as ApiEnvelope<T>;
}

describe("GET /api/v1/internal/resolve-role", () => {
  let createApp: typeof import("../app").createApp;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = "test-internal-secret";
    process.env.JWT_PUBLIC_KEY ??= "unused-for-this-suite";
    ({ createApp } = await import("../app"));
  });

  it("returns 401 with no X-Internal-Secret header", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/internal/resolve-role?email=a@example.com");
    expect(res.status).toBe(401);
  });

  it("returns 401 with the wrong secret", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/internal/resolve-role?email=a@example.com", {
      headers: { "X-Internal-Secret": "wrong-secret" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing or invalid email query param", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/internal/resolve-role", {
      headers: { "X-Internal-Secret": "test-internal-secret" },
    });
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).error?.code).toBe("VALIDATION_ERROR");
  });

  // The 200 + real role-resolution path is covered by
  // domains/delegates/resolve-role-for-email.test.ts (DB-gated) and
  // routes/delegates.test.ts's end-to-end flow - this file stays focused
  // on the secret-based auth boundary itself.
});
