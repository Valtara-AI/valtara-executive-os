// Exercises the routing/auth/validation layer via Hono's app.request() -
// no live server or database needed. The onboarding engine itself is
// mocked here; its real behavior is covered by
// domains/onboarding/engine.test.ts (DB-gated).

import { beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportSPKI, generateKeyPair } from "jose";
import type { JwtPayload, Role } from "@vex-os/shared";

vi.mock("./domains/onboarding/engine", () => ({
  startSession: vi
    .fn()
    .mockResolvedValue({ sessionId: "session-1", question: "What's your name?", done: false }),
  respond: vi.fn().mockResolvedValue({ question: "Next question", done: false }),
  complete: vi.fn().mockResolvedValue({
    intelligenceProfileId: "ip-1",
    voiceProfileId: "vp-1",
    proposedAgents: [],
  }),
  confirm: vi.fn().mockResolvedValue({ activatedAgents: [] }),
}));

vi.mock("./domains/onboarding/resolve-executive", () => ({
  resolveExecutive: vi.fn().mockResolvedValue({ id: "exec-1" }),
}));

interface ApiEnvelope {
  success: boolean;
  data: Record<string, unknown> | null;
  error: { code: string; message: string; details?: unknown } | null;
}

async function jsonBody(res: Response): Promise<ApiEnvelope> {
  return (await res.json()) as ApiEnvelope;
}

let signToken: (payload: Partial<JwtPayload> & { role: Role }) => Promise<string>;
let createApp: typeof import("./app").createApp;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  process.env.JWT_PUBLIC_KEY = await exportSPKI(publicKey);

  signToken = async (payload) =>
    new SignJWT({ email: "exec@example.com", ...payload })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(payload.sub ?? "user-1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  ({ createApp } = await import("./app"));
});

describe("GET /api/v1/health", () => {
  it("returns 200 with the ok envelope, unauthenticated", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ success: true, data: { status: "ok" }, error: null });
  });

  it("carries security headers on every response, including unauthenticated ones", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toBeTruthy();
  });
});

describe("unmatched routes", () => {
  it("returns a JSON envelope, not Hono's default plain text 404", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    const body = await jsonBody(res);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/v1/executive/onboarding/start", () => {
  it("returns 401 with no Authorization header", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/executive/onboarding/start", { method: "POST" });
    expect(res.status).toBe(401);
    expect((await jsonBody(res)).error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with a garbage token", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/executive/onboarding/start", {
      method: "POST",
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a validly-signed token with a non-Executive role", async () => {
    const app = createApp();
    const token = await signToken({ role: "Delegate" });
    const res = await app.request("/api/v1/executive/onboarding/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    expect((await jsonBody(res)).error?.code).toBe("FORBIDDEN");
  });

  it("returns 200 and starts a session for an Executive-role token", async () => {
    const app = createApp();
    const token = await signToken({ role: "Executive" });
    const res = await app.request("/api/v1/executive/onboarding/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.data?.sessionId).toBe("session-1");
  });
});

describe("POST /api/v1/executive/onboarding/respond", () => {
  it("returns 400 for an invalid body", async () => {
    const app = createApp();
    const token = await signToken({ role: "Executive" });
    const res = await app.request("/api/v1/executive/onboarding/respond", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 for a valid body", async () => {
    const app = createApp();
    const token = await signToken({ role: "Executive" });
    const res = await app.request("/api/v1/executive/onboarding/respond", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "123e4567-e89b-12d3-a456-426614174000",
        response: "Jordan Ellis",
      }),
    });
    expect(res.status).toBe(200);
  });
});
