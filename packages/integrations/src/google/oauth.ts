// API-001 §3.1/§3.2: "OAuth 2.0 Authorization Code with PKCE; Google
// Identity Services." Pure REST helpers only - state/CSRF management
// belongs to the caller (apps/api/src/routes/integrations.ts), not this
// package, since that's a per-request session concern rather than
// something about *how Google's OAuth endpoints work*.

import type { OAuthTokenSet } from "../types.js";
import { generatePkcePair, type PkcePair } from "../pkce.js";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Re-exported for backward compatibility - callers (including this
// package's own google-connection.ts and existing tests) import PKCE
// generation from here. The implementation itself lives in ../pkce.ts now
// that Microsoft (Sprint 5) needs the identical RFC 7636 logic.
export { generatePkcePair, type PkcePair };

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must all be set (see .env.example).",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthorizationUrl(
  scopes: string[],
  state: string,
  codeChallenge: string,
): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // ensures a refresh_token is issued even on repeat connects
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenSet> {
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
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope.split(" "),
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
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: body.access_token,
    // Google doesn't reissue a refresh_token on refresh - the caller keeps
    // using the one it already has.
    refreshToken: undefined,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope.split(" "),
  };
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
}
