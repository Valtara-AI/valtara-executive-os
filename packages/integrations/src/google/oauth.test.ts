import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGoogleAuthorizationUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  refreshAccessToken,
  revokeToken,
} from "./oauth.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/v1/integrations/google/callback";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("generatePkcePair", () => {
  it("produces a verifier and its correct S256 challenge", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThan(20);
    const expectedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("produces a different pair on each call", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("buildGoogleAuthorizationUrl", () => {
  it("includes PKCE, state, and the requested scopes", () => {
    const url = new URL(
      buildGoogleAuthorizationUrl(["scope-a", "scope-b"], "test-state", "test-challenge"),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/v1/integrations/google/callback",
    );
    expect(url.searchParams.get("scope")).toBe("scope-a scope-b");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("throws a clear error when Google credentials aren't configured", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => buildGoogleAuthorizationUrl(["s"], "state", "challenge")).toThrow(
      /GOOGLE_CLIENT_ID/,
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
  it("parses a refreshed token and omits refresh_token (Google doesn't reissue one)", async () => {
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
    expect(tokens.accessToken).toBe("new-at");
    expect(tokens.refreshToken).toBeUndefined();
  });
});

describe("revokeToken", () => {
  it("posts to the revoke endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await revokeToken("some-token");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://oauth2.googleapis.com/revoke?token=some-token"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
