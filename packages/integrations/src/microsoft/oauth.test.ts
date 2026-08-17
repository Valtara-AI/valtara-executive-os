import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMicrosoftAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "./oauth.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.MICROSOFT_CLIENT_ID = "test-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
  process.env.MICROSOFT_REDIRECT_URI =
    "http://localhost:3001/api/v1/integrations/microsoft/callback";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("buildMicrosoftAuthorizationUrl", () => {
  it("includes PKCE, state, and the requested scopes, against the default 'common' tenant", () => {
    delete process.env.MICROSOFT_TENANT_ID;
    const url = new URL(
      buildMicrosoftAuthorizationUrl(["scope-a", "scope-b"], "test-state", "test-challenge"),
    );
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/v1/integrations/microsoft/callback",
    );
    expect(url.searchParams.get("scope")).toBe("scope-a scope-b");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("uses MICROSOFT_TENANT_ID when set, instead of 'common'", () => {
    process.env.MICROSOFT_TENANT_ID = "my-tenant-id";
    const url = new URL(buildMicrosoftAuthorizationUrl(["s"], "state", "challenge"));
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/my-tenant-id/oauth2/v2.0/authorize",
    );
  });

  it("throws a clear error when Microsoft credentials aren't configured", () => {
    delete process.env.MICROSOFT_CLIENT_ID;
    expect(() => buildMicrosoftAuthorizationUrl(["s"], "state", "challenge")).toThrow(
      /MICROSOFT_CLIENT_ID/,
    );
  });
});

describe("exchangeCodeForTokens", () => {
  it("parses a successful token response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "at-123",
            refresh_token: "rt-456",
            expires_in: 3600,
            scope: "scope-a scope-b",
            token_type: "Bearer",
          }),
      }),
    );

    const tokens = await exchangeCodeForTokens("auth-code", "verifier");
    expect(tokens.accessToken).toBe("at-123");
    expect(tokens.refreshToken).toBe("rt-456");
    expect(tokens.scopes).toEqual(["scope-a", "scope-b"]);
    expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws with the response body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve("invalid_grant"),
        }),
    );
    await expect(exchangeCodeForTokens("bad-code", "verifier")).rejects.toThrow(/invalid_grant/);
  });
});

describe("refreshAccessToken", () => {
  it("parses a refreshed token, passing through the rotated refresh_token when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-at",
            refresh_token: "new-rt",
            expires_in: 3600,
            scope: "scope-a",
            token_type: "Bearer",
          }),
      }),
    );
    const tokens = await refreshAccessToken("existing-refresh-token");
    expect(tokens.accessToken).toBe("new-at");
    expect(tokens.refreshToken).toBe("new-rt");
  });

  it("omits refreshToken when Microsoft doesn't reissue one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-at",
            expires_in: 3600,
            scope: "scope-a",
            token_type: "Bearer",
          }),
      }),
    );
    const tokens = await refreshAccessToken("existing-refresh-token");
    expect(tokens.refreshToken).toBeUndefined();
  });
});
