// Mirrors google/authenticated-fetch.ts's refresh/backoff/retry shape
// exactly - see that file's header for the API-001 §3.1 error-handling
// rationale (401 → refresh, 403 → insufficient scope, 429 → backoff and
// retry, 5xx → retry 3x then fail). API-001 §3.3 additionally calls out
// respecting Graph's Retry-After header on 429, which this already does.

import { getTokens, needsRefresh, saveTokens } from "../token-store.js";
import { refreshAccessToken } from "./oauth.js";
import { IntegrationNotConnectedError } from "../types.js";

const MICROSOFT_PROVIDER = "microsoft";
const MAX_RETRIES = 3;

export class InsufficientScopeError extends Error {
  constructor(url: string) {
    super(`Microsoft Graph request to ${url} failed with 403 (insufficient scope).`);
    this.name = "InsufficientScopeError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getValidAccessToken(executiveId: string): Promise<string> {
  const tokens = await getTokens(executiveId, MICROSOFT_PROVIDER);
  if (!tokens) throw new IntegrationNotConnectedError(MICROSOFT_PROVIDER, executiveId);

  if (!needsRefresh(tokens)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    throw new Error(
      `Executive ${executiveId}'s Microsoft access token expired and no refresh token is stored; they must reconnect.`,
    );
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(executiveId, MICROSOFT_PROVIDER, {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
  });
  return refreshed.accessToken;
}

/**
 * Authenticated fetch against Microsoft Graph, with automatic token
 * refresh (401), rate-limit backoff (429, respecting Retry-After), and
 * retry on transient 5xx errors. Throws InsufficientScopeError on 403
 * rather than retrying it.
 */
export async function graphApiFetch(
  executiveId: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let accessToken = await getValidAccessToken(executiveId);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) return res;

    if (res.status === 401 && attempt === 1) {
      const tokens = await getTokens(executiveId, MICROSOFT_PROVIDER);
      if (!tokens?.refreshToken)
        throw new IntegrationNotConnectedError(MICROSOFT_PROVIDER, executiveId);
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(executiveId, MICROSOFT_PROVIDER, {
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
      });
      accessToken = refreshed.accessToken;
      continue;
    }

    if (res.status === 403) {
      throw new InsufficientScopeError(url);
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Microsoft Graph request to ${url} failed after ${MAX_RETRIES} attempts (${res.status}).`,
        );
      }
      const retryAfterHeader = res.headers.get("Retry-After");
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
      await sleep(delayMs);
      continue;
    }

    throw new Error(
      `Microsoft Graph request to ${url} failed (${res.status}): ${await res.text()}`,
    );
  }

  throw new Error(`Microsoft Graph request to ${url} exhausted retries unexpectedly.`);
}
