// Shared by GoogleMailAdapter and GoogleCalendarAdapter - they use the
// same Google OAuth session (API-001 §3.2: "Same OAuth session as Gmail if
// both connected"), so token storage/refresh/backoff logic lives here once
// rather than duplicated per adapter.
//
// Error handling per API-001 §3.1: "401 → trigger token refresh; 403 → log
// insufficient scope error, notify executive; 429 → backoff and retry;
// 5xx → retry 3x then task fails."

import { getTokens, needsRefresh, saveTokens } from "../token-store.js";
import { refreshAccessToken } from "./oauth.js";
import { IntegrationNotConnectedError } from "../types.js";

const GOOGLE_PROVIDER = "google";
const MAX_RETRIES = 3;

export class InsufficientScopeError extends Error {
  constructor(url: string) {
    super(`Google API request to ${url} failed with 403 (insufficient scope).`);
    this.name = "InsufficientScopeError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getValidAccessToken(executiveId: string): Promise<string> {
  const tokens = await getTokens(executiveId, GOOGLE_PROVIDER);
  if (!tokens) throw new IntegrationNotConnectedError(GOOGLE_PROVIDER, executiveId);

  if (!needsRefresh(tokens)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    throw new Error(
      `Executive ${executiveId}'s Google access token expired and no refresh token is stored; they must reconnect.`,
    );
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(executiveId, GOOGLE_PROVIDER, {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
  });
  return refreshed.accessToken;
}

/**
 * Authenticated fetch against a Google API, with automatic token refresh
 * (401), rate-limit backoff (429, respecting Retry-After), and retry on
 * transient 5xx errors. Throws InsufficientScopeError on 403 rather than
 * retrying it - that's a permanent misconfiguration, not transient.
 */
export async function googleApiFetch(
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
      // Access token was rejected outright (e.g. revoked out-of-band) -
      // force a refresh regardless of our locally-cached expiry and retry
      // once.
      const tokens = await getTokens(executiveId, GOOGLE_PROVIDER);
      if (!tokens?.refreshToken)
        throw new IntegrationNotConnectedError(GOOGLE_PROVIDER, executiveId);
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(executiveId, GOOGLE_PROVIDER, {
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
          `Google API request to ${url} failed after ${MAX_RETRIES} attempts (${res.status}).`,
        );
      }
      const retryAfterHeader = res.headers.get("Retry-After");
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
      await sleep(delayMs);
      continue;
    }

    throw new Error(`Google API request to ${url} failed (${res.status}): ${await res.text()}`);
  }

  throw new Error(`Google API request to ${url} exhausted retries unexpectedly.`);
}
