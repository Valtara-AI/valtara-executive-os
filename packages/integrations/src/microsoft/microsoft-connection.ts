// Shared connection lifecycle for both Microsoft adapters - mirrors
// google/google-connection.ts. See scopes.ts for why Mail and Calendar
// share one connection rather than two.

import { deleteTokens, getTokens, saveTokens } from "../token-store.js";
import {
  buildMicrosoftAuthorizationUrl as buildMicrosoftOAuthAuthorizationUrl,
  exchangeCodeForTokens,
  generatePkcePair,
} from "./oauth.js";
import { ALL_MICROSOFT_SCOPES, MICROSOFT_PROVIDER } from "./scopes.js";
import type { AuthorizationRequest, OAuthTokenSet } from "../types.js";

export async function isMicrosoftConnected(executiveId: string): Promise<boolean> {
  return Boolean(await getTokens(executiveId, MICROSOFT_PROVIDER));
}

// Same two-step split as beginGoogleAuthorization/buildGoogleAuthorizationUrl
// and for the same reason: codeVerifier must exist before the caller can
// sign a state token embedding it, but codeChallenge (needed for the URL)
// derives from that same codeVerifier.
export function beginMicrosoftAuthorization(): { codeVerifier: string; codeChallenge: string } {
  return generatePkcePair();
}

export function buildMicrosoftAuthorizationUrl(codeChallenge: string, state: string): string {
  return buildMicrosoftOAuthAuthorizationUrl(ALL_MICROSOFT_SCOPES, state, codeChallenge);
}

// Satisfies IntegrationAdapter's generic getAuthorizationUrl(state) contract
// for callers that don't need PKCE correctness - see
// google-connection.ts's getGoogleAuthorizationUrlLegacy for the same note.
// routes/integrations.ts uses the two-step functions above instead.
export function getMicrosoftAuthorizationUrlLegacy(state: string): AuthorizationRequest {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  return {
    url: buildMicrosoftOAuthAuthorizationUrl(ALL_MICROSOFT_SCOPES, state, codeChallenge),
    codeVerifier,
  };
}

export async function completeMicrosoftConnection(
  executiveId: string,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenSet> {
  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  await saveTokens(executiveId, MICROSOFT_PROVIDER, tokens);
  return tokens;
}

// No revoke call, unlike disconnectGoogle - see oauth.ts's note: Microsoft
// identity platform has no token revocation endpoint equivalent to
// Google's /revoke. Deleting our stored copy is the whole disconnect.
export async function disconnectMicrosoft(executiveId: string): Promise<void> {
  await deleteTokens(executiveId, MICROSOFT_PROVIDER);
}
