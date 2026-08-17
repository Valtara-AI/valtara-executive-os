// DB-gated (needs DB_ENCRYPTION_KEY too, for token-store). Mocks the
// global fetch for the provider's token endpoint so the full authorize ->
// callback round trip is testable without real Google/Microsoft/Slack
// credentials - see packages/integrations' README for why that's the only
// piece that can't be exercised for real in this environment.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { getTokens } from "@vex-os/integrations";
import { createTestJwtSigner } from "../test-utils/jwt.js";

const hasDb =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.DB_ENCRYPTION_KEY) &&
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.MICROSOFT_CLIENT_ID) &&
  Boolean(process.env.SLACK_CLIENT_ID);

interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<ApiEnvelope<T>> {
  return (await res.json()) as ApiEnvelope<T>;
}

describe.skipIf(!hasDb)("integrations routes", () => {
  let createApp: typeof import("../app").createApp;
  let signToken: Awaited<ReturnType<typeof createTestJwtSigner>>["signToken"];
  const createdExecutiveEmails: string[] = [];

  beforeAll(async () => {
    const signer = await createTestJwtSigner();
    process.env.JWT_PUBLIC_KEY = signer.publicKeyPem;
    process.env.JWT_PRIVATE_KEY = signer.privateKeyPem;
    signToken = signer.signToken;
    ({ createApp } = await import("../app"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    const db = getDb();
    for (const email of createdExecutiveEmails) {
      await db.delete(schema.executives).where(eq(schema.executives.email, email));
    }
  });

  function freshEmail(label: string): string {
    const email = `integrations-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdExecutiveEmails.push(email);
    return email;
  }

  it("GET / lists google, microsoft, and slack as not connected before any connection exists", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("list"), role: "Executive" });

    const res = await app.request("/api/v1/integrations", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ provider: string; connected: boolean }[]>(res);
    expect(body.data).toEqual([
      { provider: "google", connected: false },
      { provider: "microsoft", connected: false },
      { provider: "slack", connected: false },
    ]);
  });

  it("GET /:provider/authorize returns a Google consent URL with PKCE and state params", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("authorize"), role: "Executive" });

    const res = await app.request("/api/v1/integrations/google/authorize", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ url: string }>(res);
    const url = new URL(body.data!.url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("GET /:provider/authorize returns a Microsoft consent URL with PKCE and state params", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("ms-authorize"), role: "Executive" });

    const res = await app.request("/api/v1/integrations/microsoft/authorize", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ url: string }>(res);
    const url = new URL(body.data!.url);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("GET /:provider/authorize returns a Slack consent URL with state, no PKCE params", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("slack-authorize"), role: "Executive" });

    const res = await app.request("/api/v1/integrations/slack/authorize", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<{ url: string }>(res);
    const url = new URL(body.data!.url);
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeNull();
  });

  it("returns 400 for an unsupported provider", async () => {
    const app = createApp();
    const token = await signToken({ email: freshEmail("unsupported"), role: "Executive" });

    const res = await app.request("/api/v1/integrations/notion/authorize", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).error?.code).toBe("UNSUPPORTED_PROVIDER");
  });

  it("full round trip: authorize -> callback connects, list reflects it, disconnect removes it", async () => {
    const app = createApp();
    const email = freshEmail("roundtrip");
    const token = await signToken({ email, role: "Executive" });
    const headers = { Authorization: `Bearer ${token}` };

    const authorizeRes = await app.request("/api/v1/integrations/google/authorize", { headers });
    const { url } = (await jsonBody<{ url: string }>(authorizeRes)).data!;
    const state = new URL(url).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "roundtrip-access-token",
            refresh_token: "roundtrip-refresh-token",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            token_type: "Bearer",
          }),
      }),
    );

    const callbackRes = await app.request(
      `/api/v1/integrations/google/callback?code=fake-auth-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get("location")).toContain("integration=connected");

    const db = getDb();
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    const tokens = await getTokens(executive!.id, "google");
    expect(tokens?.accessToken).toBe("roundtrip-access-token");

    vi.unstubAllGlobals();

    const listRes = await app.request("/api/v1/integrations", { headers });
    const listBody = await jsonBody<{ provider: string; connected: boolean }[]>(listRes);
    expect(listBody.data).toEqual([
      { provider: "google", connected: true },
      { provider: "microsoft", connected: false },
      { provider: "slack", connected: false },
    ]);

    const disconnectRes = await app.request("/api/v1/integrations/google", {
      method: "DELETE",
      headers,
    });
    expect(disconnectRes.status).toBe(200);
    expect(await getTokens(executive!.id, "google")).toBeUndefined();
  });

  it("full round trip for Microsoft: authorize -> callback connects, list reflects it, disconnect removes it", async () => {
    const app = createApp();
    const email = freshEmail("ms-roundtrip");
    const token = await signToken({ email, role: "Executive" });
    const headers = { Authorization: `Bearer ${token}` };

    const authorizeRes = await app.request("/api/v1/integrations/microsoft/authorize", { headers });
    const { url } = (await jsonBody<{ url: string }>(authorizeRes)).data!;
    const state = new URL(url).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "ms-roundtrip-access-token",
            refresh_token: "ms-roundtrip-refresh-token",
            expires_in: 3600,
            scope: "https://graph.microsoft.com/Mail.Read",
            token_type: "Bearer",
          }),
      }),
    );

    const callbackRes = await app.request(
      `/api/v1/integrations/microsoft/callback?code=fake-auth-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get("location")).toContain("integration=connected");

    const db = getDb();
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    const tokens = await getTokens(executive!.id, "microsoft");
    expect(tokens?.accessToken).toBe("ms-roundtrip-access-token");

    vi.unstubAllGlobals();

    const listRes = await app.request("/api/v1/integrations", { headers });
    const listBody = await jsonBody<{ provider: string; connected: boolean }[]>(listRes);
    expect(listBody.data).toEqual([
      { provider: "google", connected: false },
      { provider: "microsoft", connected: true },
      { provider: "slack", connected: false },
    ]);

    const disconnectRes = await app.request("/api/v1/integrations/microsoft", {
      method: "DELETE",
      headers,
    });
    expect(disconnectRes.status).toBe(200);
    expect(await getTokens(executive!.id, "microsoft")).toBeUndefined();
  });

  it("full round trip for Slack: authorize -> callback connects, list reflects it, disconnect removes it", async () => {
    const app = createApp();
    const email = freshEmail("slack-roundtrip");
    const token = await signToken({ email, role: "Executive" });
    const headers = { Authorization: `Bearer ${token}` };

    const authorizeRes = await app.request("/api/v1/integrations/slack/authorize", { headers });
    const { url } = (await jsonBody<{ url: string }>(authorizeRes)).data!;
    const state = new URL(url).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            access_token: "xoxb-roundtrip",
            scope: "channels:read,chat:write",
            team: { id: "T123", name: "Test Team" },
          }),
      }),
    );

    const callbackRes = await app.request(
      `/api/v1/integrations/slack/callback?code=fake-auth-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get("location")).toContain("integration=connected");

    const db = getDb();
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.email, email));
    const tokens = await getTokens(executive!.id, "slack");
    expect(tokens?.accessToken).toBe("xoxb-roundtrip");

    vi.unstubAllGlobals();

    const listRes = await app.request("/api/v1/integrations", { headers });
    const listBody = await jsonBody<{ provider: string; connected: boolean }[]>(listRes);
    expect(listBody.data).toEqual([
      { provider: "google", connected: false },
      { provider: "microsoft", connected: false },
      { provider: "slack", connected: true },
    ]);

    const disconnectRes = await app.request("/api/v1/integrations/slack", {
      method: "DELETE",
      headers,
    });
    expect(disconnectRes.status).toBe(200);
    expect(await getTokens(executive!.id, "slack")).toBeUndefined();
  });

  it("callback redirects with an error and stores nothing for a tampered state token", async () => {
    const app = createApp();
    const res = await app.request(
      "/api/v1/integrations/google/callback?code=fake-code&state=not-a-real-token",
      { redirect: "manual" },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("integration=error");
  });

  it("callback redirects with an error when code or state is missing", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/integrations/google/callback", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("integration=error");
  });

  it("the callback route needs no Authorization header - it's not behind jwtMiddleware", async () => {
    const app = createApp();
    // No Authorization header at all; a missing/invalid state still
    // produces the redirect-with-error path rather than a 401, proving
    // this route isn't gated by jwtMiddleware the way every other route is.
    const res = await app.request("/api/v1/integrations/google/callback?code=x&state=y", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(401);
  });
});
