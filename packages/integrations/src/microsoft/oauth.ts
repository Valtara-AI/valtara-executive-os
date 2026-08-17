// API-001 §3.3 specifies "OAuth 2.0 via MSAL (Microsoft Authentication
// Library)". This implements the same Authorization Code + PKCE flow
// directly against the Microsoft identity platform v2.0 REST endpoints
// instead of pulling in @azure/msal-node, mirroring the Sprint 4 Google
// adapter's choice to call Google's OAuth endpoints directly rather than
// the googleapis client library. MSAL's value is mainly token-cache
// management for native/SPA clients; a server-side confidential client
// doing plain Authorization Code + PKCE gets no material benefit from it
// here, and skipping it keeps the dependency surface and the two
// adapters' code shape consistent. See DL-ARCH-008.

import type { OAuthTokenSet } from "../types.js";
import { generatePkcePair, type PkcePair } from "../pkce.js";

export { generatePkcePair, type PkcePair };

function getTenant(): string {
  return process.env.MICROSOFT_TENANT_ID ?? "common";
}

function authorizationEndpoint(): string {
  return `https://login.microsoftonline.com/${getTenant()}/oauth2/v2.0/authorize`;
}

function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${getTenant()}/oauth2/v2.0/token`;
}

function getClientCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI must all be set (see .env.example).",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildMicrosoftAuthorizationUrl(
  scopes: string[],
  state: string,
  codeChallenge: string,
): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${authorizationEndpoint()}?${params.toString()}`;
}

interface MicrosoftTokenResponse {
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
  const res = await fetch(tokenEndpoint(), {
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
    throw new Error(`Microsoft token exchange failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as MicrosoftTokenResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope.split(" "),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(tokenEndpoint(), {
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
    throw new Error(`Microsoft token refresh failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as MicrosoftTokenResponse;
  return {
    accessToken: body.access_token,
    // Unlike Google, Microsoft's v2.0 endpoint does reissue a
    // refresh_token on refresh (rolling refresh tokens) - pass it through
    // when present, but don't assume it always is.
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope.split(" "),
  };
}

// Microsoft identity platform has no token revocation endpoint equivalent
// to Google's /revoke - the documented pattern is simply to stop using the
// refresh token and let it expire. disconnectMicrosoft() (below, in
// microsoft-connection.ts) reflects that: it deletes our stored copy
// without attempting a revoke call.
