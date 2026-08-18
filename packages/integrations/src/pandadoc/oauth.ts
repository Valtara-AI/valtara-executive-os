// PandaDoc's OAuth 2.0 Authorization Code flow - no PKCE (confirmed against
// developers.pandadoc.com's own auth reference, same as Slack's oauth.ts
// header explains for that provider). Unlike Slack, PandaDoc's token
// endpoint is a standard OAuth2 JSON response with no body-level "ok"
// quirk, so this mirrors google/oauth.ts's shape instead.

import type { OAuthTokenSet } from "../types.js";

const AUTHORIZATION_ENDPOINT = "https://app.pandadoc.com/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.pandadoc.com/oauth2/access_token";

function getClientCredentials() {
  const clientId = process.env.PANDADOC_CLIENT_ID;
  const clientSecret = process.env.PANDADOC_CLIENT_SECRET;
  const redirectUri = process.env.PANDADOC_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "PANDADOC_CLIENT_ID, PANDADOC_CLIENT_SECRET, and PANDADOC_REDIRECT_URI must all be set (see .env.example).",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildPandaDocAuthorizationUrl(scopes: string[], state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

interface PandaDocTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
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
    throw new Error(`PandaDoc token exchange failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as PandaDocTokenResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope ? body.scope.split(" ") : [],
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
    throw new Error(`PandaDoc token refresh failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as PandaDocTokenResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    scopes: body.scope ? body.scope.split(" ") : [],
  };
}

// PandaDoc's API has no documented token-revocation endpoint (unlike
// Google/Slack) - disconnect() just deletes the stored tokens locally, the
// same gap noted in microsoft-connection.ts's disconnect for the same
// reason (Microsoft Graph has no revoke endpoint either).
