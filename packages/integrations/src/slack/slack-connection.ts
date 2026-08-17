// Shared connection lifecycle - mirrors google-connection.ts/
// microsoft-connection.ts in shape, but simpler: no PKCE (see oauth.ts's
// header), so there's no real two-step codeVerifier/codeChallenge
// dependency to split apart. beginSlackAuthorization exists anyway so
// routes/integrations.ts can treat all three providers the same way.

import { deleteTokens, getTokens, saveTokens } from "../token-store.js";
import {
  buildSlackAuthorizationUrl as buildSlackOAuthAuthorizationUrl,
  exchangeCodeForTokens,
  revokeToken,
} from "./oauth.js";
import { SLACK_PROVIDER, SLACK_SCOPES } from "./scopes.js";
import type { AuthorizationRequest, OAuthTokenSet } from "../types.js";

export async function isSlackConnected(executiveId: string): Promise<boolean> {
  return Boolean(await getTokens(executiveId, SLACK_PROVIDER));
}

// No PKCE pair to generate - codeVerifier is always "" for Slack, carried
// through the signed OAuth state token purely so oauth-state.ts's payload
// shape (shared across all three providers) doesn't need a Slack-specific
// exception.
export function beginSlackAuthorization(): { codeVerifier: string } {
  return { codeVerifier: "" };
}

export function buildSlackAuthorizationUrl(state: string): string {
  return buildSlackOAuthAuthorizationUrl(SLACK_SCOPES, state);
}

export function getSlackAuthorizationUrlLegacy(state: string): AuthorizationRequest {
  return { url: buildSlackOAuthAuthorizationUrl(SLACK_SCOPES, state), codeVerifier: "" };
}

export async function completeSlackConnection(
  executiveId: string,
  code: string,
): Promise<OAuthTokenSet> {
  const tokens = await exchangeCodeForTokens(code);
  await saveTokens(executiveId, SLACK_PROVIDER, tokens);
  return tokens;
}

export async function disconnectSlack(executiveId: string): Promise<void> {
  const tokens = await getTokens(executiveId, SLACK_PROVIDER);
  if (tokens) {
    await revokeToken(tokens.accessToken);
  }
  await deleteTokens(executiveId, SLACK_PROVIDER);
}
