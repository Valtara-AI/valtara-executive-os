// Shared connection lifecycle for both Google adapters - see scopes.ts for
// why they're one connection rather than two.

import { deleteTokens, getTokens, saveTokens } from "../token-store.js";
import {
  buildGoogleAuthorizationUrl as buildGoogleOAuthAuthorizationUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  revokeToken,
} from "./oauth.js";
import { ALL_GOOGLE_SCOPES, GOOGLE_PROVIDER } from "./scopes.js";
import type { AuthorizationRequest, OAuthTokenSet } from "../types.js";

export async function isGoogleConnected(executiveId: string): Promise<boolean> {
  return Boolean(await getTokens(executiveId, GOOGLE_PROVIDER));
}

// Split into two steps (not one getAuthorizationUrl(state) call) because
// PKCE has a real data dependency the single-call shape can't express
// cleanly: the caller (routes/integrations.ts) needs codeVerifier *before*
// it can sign a state token to embed it in, but codeChallenge (needed to
// build the URL) is derived from that same codeVerifier. So: generate the
// pair first, let the caller build state from codeVerifier, then build the
// URL from codeChallenge + that state.
export function beginGoogleAuthorization(): { codeVerifier: string; codeChallenge: string } {
  return generatePkcePair();
}

export function buildGoogleAuthorizationUrl(codeChallenge: string, state: string): string {
  return buildGoogleOAuthAuthorizationUrl(ALL_GOOGLE_SCOPES, state, codeChallenge);
}

// IntegrationAdapter's generic getAuthorizationUrl(state): AuthorizationRequest
// contract (types.ts) assumes state is known upfront, which doesn't hold
// for PKCE - kept here only so GoogleMailAdapter/GoogleCalendarAdapter can
// still satisfy that interface for callers that don't care about PKCE
// correctness (none do today; routes/integrations.ts uses the two-step
// functions above instead). Marked legacy rather than removed since the
// interface itself may need revisiting once Outlook/Slack adapters (which
// don't use PKCE) show whether the shape actually fits them either.
export function getGoogleAuthorizationUrlLegacy(state: string): AuthorizationRequest {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  return {
    url: buildGoogleOAuthAuthorizationUrl(ALL_GOOGLE_SCOPES, state, codeChallenge),
    codeVerifier,
  };
}

export async function completeGoogleConnection(
  executiveId: string,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenSet> {
  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  await saveTokens(executiveId, GOOGLE_PROVIDER, tokens);
  return tokens;
}

export async function disconnectGoogle(executiveId: string): Promise<void> {
  const tokens = await getTokens(executiveId, GOOGLE_PROVIDER);
  if (tokens) {
    // Best-effort revocation - a failed revoke call shouldn't block
    // deleting our own copy of tokens the executive asked us to forget.
    await revokeToken(tokens.refreshToken ?? tokens.accessToken).catch(() => undefined);
  }
  await deleteTokens(executiveId, GOOGLE_PROVIDER);
}
