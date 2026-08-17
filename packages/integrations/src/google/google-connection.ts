// Shared connection lifecycle for both Google adapters - see scopes.ts for
// why they're one connection rather than two.

import { deleteTokens, getTokens, saveTokens } from "../token-store.js";
import {
  buildGoogleAuthorizationUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  revokeToken,
} from "./oauth.js";
import { ALL_GOOGLE_SCOPES, GOOGLE_PROVIDER } from "./scopes.js";
import type { AuthorizationRequest, OAuthTokenSet } from "../types.js";

export async function isGoogleConnected(executiveId: string): Promise<boolean> {
  return Boolean(await getTokens(executiveId, GOOGLE_PROVIDER));
}

export function getGoogleAuthorizationUrl(state: string): AuthorizationRequest {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  return {
    url: buildGoogleAuthorizationUrl(ALL_GOOGLE_SCOPES, state, codeChallenge),
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
