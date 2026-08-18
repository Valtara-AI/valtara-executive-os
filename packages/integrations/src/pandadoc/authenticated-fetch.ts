// Mirrors google/authenticated-fetch.ts - PandaDoc's REST API uses
// standard HTTP status codes for auth/scope/rate-limit failures (401/403/
// 429/5xx), not Slack's body-level "ok" quirk, confirmed against
// PandaDoc's own auth reference docs (Authorization: Bearer ${accessToken},
// 401 on expiry triggers a refresh via the stored refresh_token).

import { getTokens, needsRefresh, saveTokens } from "../token-store.js";
import { refreshAccessToken } from "./oauth.js";
import { IntegrationNotConnectedError } from "../types.js";
import { PANDADOC_PROVIDER } from "./scopes.js";

const MAX_RETRIES = 3;

export class InsufficientScopeError extends Error {
  constructor(url: string) {
    super(`PandaDoc API request to ${url} failed with 403 (insufficient scope).`);
    this.name = "InsufficientScopeError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getValidAccessToken(executiveId: string): Promise<string> {
  const tokens = await getTokens(executiveId, PANDADOC_PROVIDER);
  if (!tokens) throw new IntegrationNotConnectedError(PANDADOC_PROVIDER, executiveId);

  if (!needsRefresh(tokens)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    throw new Error(
      `Executive ${executiveId}'s PandaDoc access token expired and no refresh token is stored; they must reconnect.`,
    );
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(executiveId, PANDADOC_PROVIDER, {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
  });
  return refreshed.accessToken;
}

/**
 * Authenticated fetch against the PandaDoc public v1 API, with automatic
 * token refresh (401), rate-limit backoff (429, respecting Retry-After),
 * and retry on transient 5xx errors. Throws InsufficientScopeError on 403
 * rather than retrying it - that's a permanent misconfiguration, not
 * transient.
 */
export async function pandaDocApiFetch(
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
      const tokens = await getTokens(executiveId, PANDADOC_PROVIDER);
      if (!tokens?.refreshToken)
        throw new IntegrationNotConnectedError(PANDADOC_PROVIDER, executiveId);
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(executiveId, PANDADOC_PROVIDER, {
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
          `PandaDoc API request to ${url} failed after ${MAX_RETRIES} attempts (${res.status}).`,
        );
      }
      const retryAfterHeader = res.headers.get("Retry-After");
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
      await sleep(delayMs);
      continue;
    }

    throw new Error(`PandaDoc API request to ${url} failed (${res.status}): ${await res.text()}`);
  }

  throw new Error(`PandaDoc API request to ${url} exhausted retries unexpectedly.`);
}
