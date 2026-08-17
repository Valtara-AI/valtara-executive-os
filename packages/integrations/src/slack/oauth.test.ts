import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSlackAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken } from "./oauth.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SLACK_CLIENT_ID = "test-client-id";
  process.env.SLACK_CLIENT_SECRET = "test-client-secret";
  process.env.SLACK_REDIRECT_URI = "http://localhost:3001/api/v1/integrations/slack/callback";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("buildSlackAuthorizationUrl", () => {
  it("includes state and comma-joined scopes, no PKCE params", () => {
    const url = new URL(buildSlackAuthorizationUrl(["channels:read", "chat:write"], "test-state"));
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/v1/integrations/slack/callback",
    );
    expect(url.searchParams.get("scope")).toBe("channels:read,chat:write");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("code_challenge")).toBeNull();
  });

  it("throws a clear error when Slack credentials aren't configured", () => {
    delete process.env.SLACK_CLIENT_ID;
    expect(() => buildSlackAuthorizationUrl(["channels:read"], "state")).toThrow(/SLACK_CLIENT_ID/);
  });
});

describe("exchangeCodeForTokens", () => {
  it("parses a successful token response for a non-expiring bot token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            access_token: "xoxb-123",
            scope: "channels:read,chat:write",
            team: { id: "T123", name: "Test Team" },
          }),
      }),
    );

    const tokens = await exchangeCodeForTokens("auth-code");
    expect(tokens.accessToken).toBe("xoxb-123");
    expect(tokens.refreshToken).toBeUndefined();
    expect(tokens.scopes).toEqual(["channels:read", "chat:write"]);
    // Non-expiring token: far enough out that it will never trigger needsRefresh.
    expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now() + 365 * 24 * 60 * 60 * 1000);
  });

  it("parses expires_in/refresh_token when token rotation is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            access_token: "xoxb-rotating",
            refresh_token: "xoxe-refresh",
            expires_in: 3600,
            scope: "channels:read,chat:write",
          }),
      }),
    );

    const tokens = await exchangeCodeForTokens("auth-code");
    expect(tokens.refreshToken).toBe("xoxe-refresh");
    expect(tokens.expiresAt.getTime()).toBeLessThan(Date.now() + 2 * 3600 * 1000);
  });

  it("throws using the Slack body-level error when ok is false, even with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "invalid_code" }),
      }),
    );
    await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(/invalid_code/);
  });
});

describe("refreshAccessToken", () => {
  it("parses a refreshed token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            access_token: "xoxb-new",
            refresh_token: "xoxe-new",
            expires_in: 3600,
            scope: "channels:read,chat:write",
          }),
      }),
    );
    const tokens = await refreshAccessToken("xoxe-refresh");
    expect(tokens.accessToken).toBe("xoxb-new");
    expect(tokens.refreshToken).toBe("xoxe-new");
  });
});
