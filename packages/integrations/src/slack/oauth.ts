// API-001 §3.5: "OAuth 2.0 with Slack; workspace-level authorization."
// Unlike Google/Microsoft, Slack's OAuth v2 endpoints don't support PKCE -
// so unlike oauth.ts in google/ and microsoft/, there is no
// generatePkcePair() use here. The codeVerifier parameter still appears on
// exchangeCodeForTokens (IntegrationAdapter's shared contract) but is
// unused - see slack-connection.ts for how the caller is kept honest about
// that (it passes an empty string, not a real PKCE verifier).

import type { OAuthTokenSet } from "../types.js";

const AUTHORIZATION_ENDPOINT = "https://slack.com/oauth/v2/authorize";
const TOKEN_ENDPOINT = "https://slack.com/api/oauth.v2.access";
const REVOKE_ENDPOINT = "https://slack.com/api/auth.revoke";

function getClientCredentials() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI must all be set (see .env.example).",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildSlackAuthorizationUrl(scopes: string[], state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    // "scope" is bot-token scopes (what chat:write/channels:read actually
    // are); Slack's v2 authorize endpoint also accepts "user_scope" for
    // user-token scopes, which NYXOR doesn't request.
    scope: scopes.join(","),
    state,
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  team?: { id: string; name: string };
}

// A century out: the common case is a classic Slack bot token, which does
// not expire and has no refresh_token at all. needsRefresh() (token-store)
// treats a *missing* expiresAt as "always needs refresh," so a real,
// far-future expiry is what correctly signals "this token doesn't need
// refreshing" for that common case, distinct from "we don't know."
function nonExpiringExpiresAt(): Date {
  return new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack token exchange failed (${res.status}): ${await res.text()}`);
  }

  // Slack's Web API returns HTTP 200 even for application-level failures
  // (invalid code, revoked app, etc.) - the real success/failure signal is
  // the "ok" field in the body, not the HTTP status. See
  // authenticated-fetch.ts's header for why this matters throughout the
  // Slack adapter, not just here.
  const body = (await res.json()) as SlackTokenResponse;
  if (!body.ok || !body.access_token) {
    throw new Error(`Slack token exchange failed: ${body.error ?? "unknown error"}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    // Only apps with token rotation enabled get expires_in/refresh_token
    // at all - the common case (classic bot tokens) gets neither, and a
    // non-expiring token is the accurate representation of that.
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : nonExpiringExpiresAt(),
    scopes: body.scope ? body.scope.split(",") : [],
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack token refresh failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as SlackTokenResponse;
  if (!body.ok || !body.access_token) {
    throw new Error(`Slack token refresh failed: ${body.error ?? "unknown error"}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : nonExpiringExpiresAt(),
    scopes: body.scope ? body.scope.split(",") : [],
  };
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}
