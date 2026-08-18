// Shared connection lifecycle - mirrors slack-connection.ts's shape: no
// PKCE (see oauth.ts's header), so there's no real two-step codeVerifier/
// codeChallenge dependency to split apart.

import { deleteTokens, getTokens, saveTokens } from "../token-store.js";
import {
  buildPandaDocAuthorizationUrl as buildPandaDocOAuthAuthorizationUrl,
  exchangeCodeForTokens,
} from "./oauth.js";
import { PANDADOC_PROVIDER, PANDADOC_SCOPES } from "./scopes.js";
import type { AuthorizationRequest, OAuthTokenSet } from "../types.js";

export async function isPandaDocConnected(executiveId: string): Promise<boolean> {
  return Boolean(await getTokens(executiveId, PANDADOC_PROVIDER));
}

// No PKCE pair to generate - codeVerifier is always "" for PandaDoc,
// carried through the signed OAuth state token purely so
// oauth-state.ts's payload shape (shared across every provider) doesn't
// need a PandaDoc-specific exception. Same pattern as beginSlackAuthorization.
export function beginPandaDocAuthorization(): { codeVerifier: string } {
  return { codeVerifier: "" };
}

export function buildPandaDocAuthorizationUrl(state: string): string {
  return buildPandaDocOAuthAuthorizationUrl(PANDADOC_SCOPES, state);
}

export function getPandaDocAuthorizationUrlLegacy(state: string): AuthorizationRequest {
  return { url: buildPandaDocOAuthAuthorizationUrl(PANDADOC_SCOPES, state), codeVerifier: "" };
}

export async function completePandaDocConnection(
  executiveId: string,
  code: string,
): Promise<OAuthTokenSet> {
  const tokens = await exchangeCodeForTokens(code);
  await saveTokens(executiveId, PANDADOC_PROVIDER, tokens);
  return tokens;
}

// No revoke call - PandaDoc's API has no documented token-revocation
// endpoint (oauth.ts's footer note). Deleting our stored copy is the whole
// disconnect, same as disconnectMicrosoft.
export async function disconnectPandaDoc(executiveId: string): Promise<void> {
  await deleteTokens(executiveId, PANDADOC_PROVIDER);
}
