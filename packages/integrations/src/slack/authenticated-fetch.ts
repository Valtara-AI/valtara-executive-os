// Mirrors google/authenticated-fetch.ts's refresh/backoff/retry shape, but
// with one structural difference that matters: Slack's Web API returns
// HTTP 200 even for application-level failures (invalid_auth,
// missing_scope, channel_not_found, ...) - the real success/failure signal
// is the "ok" boolean in the JSON body, not the HTTP status code. Real
// non-200s from Slack are reserved for genuine HTTP-layer problems (429
// rate limiting, 5xx). So this checks both layers: HTTP status for
// rate-limit/transient-failure retry, then body.ok for the Slack-specific
// auth/scope/other-error split.
//
// API-001 §3.5 asks for the adapter to "queue requests near the limit"
// (proactive throttling) rather than just reactive backoff. This
// implements the same reactive Retry-After backoff as the Google/Microsoft
// adapters instead - proactive request queuing is meaningful extra
// complexity (tracking a rolling request budget per method tier) that
// isn't justified by this system's actual Slack call volume (channel list
// + occasional HITL-approved posts, not a bulk messaging use case).
// Revisit if a future agent workforce use case drives sustained
// near-limit traffic.

import { getTokens, needsRefresh, saveTokens } from "../token-store.js";
import { refreshAccessToken } from "./oauth.js";
import { IntegrationNotConnectedError } from "../types.js";
import { SLACK_PROVIDER } from "./scopes.js";

const MAX_RETRIES = 3;

export class InsufficientScopeError extends Error {
  constructor(method: string) {
    super(`Slack API method ${method} failed with missing_scope.`);
    this.name = "InsufficientScopeError";
  }
}

export class SlackApiError extends Error {
  constructor(
    public readonly slackError: string,
    method: string,
  ) {
    super(`Slack API method ${method} failed: ${slackError}`);
    this.name = "SlackApiError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getValidAccessToken(executiveId: string): Promise<string> {
  const tokens = await getTokens(executiveId, SLACK_PROVIDER);
  if (!tokens) throw new IntegrationNotConnectedError(SLACK_PROVIDER, executiveId);

  if (!needsRefresh(tokens)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    throw new Error(
      `Executive ${executiveId}'s Slack access token expired and no refresh token is stored; they must reconnect.`,
    );
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(executiveId, SLACK_PROVIDER, {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
  });
  return refreshed.accessToken;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Authenticated POST against a Slack Web API method, with automatic token
 * refresh (on body.error === "invalid_auth"/"token_expired"), rate-limit
 * backoff (HTTP 429, respecting Retry-After), and retry on transient 5xx.
 * Throws InsufficientScopeError on body.error === "missing_scope" rather
 * than retrying it, and SlackApiError for any other application-level
 * failure. Returns the parsed body (already known to have ok: true).
 */
export async function slackApiFetch(
  executiveId: string,
  method: string,
  params: Record<string, string> = {},
): Promise<SlackApiResponse> {
  let accessToken = await getValidAccessToken(executiveId);
  const url = `https://slack.com/api/${method}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Slack API request to ${method} failed after ${MAX_RETRIES} attempts (${res.status}).`,
        );
      }
      const retryAfterHeader = res.headers.get("Retry-After");
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
      await sleep(delayMs);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Slack API request to ${method} failed (${res.status}): ${await res.text()}`);
    }

    const body = (await res.json()) as SlackApiResponse;
    if (body.ok) return body;

    if (body.error === "missing_scope") {
      throw new InsufficientScopeError(method);
    }

    if ((body.error === "invalid_auth" || body.error === "token_expired") && attempt === 1) {
      const tokens = await getTokens(executiveId, SLACK_PROVIDER);
      if (!tokens?.refreshToken)
        throw new IntegrationNotConnectedError(SLACK_PROVIDER, executiveId);
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(executiveId, SLACK_PROVIDER, {
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
      });
      accessToken = refreshed.accessToken;
      continue;
    }

    throw new SlackApiError(body.error ?? "unknown_error", method);
  }

  throw new Error(`Slack API request to ${method} exhausted retries unexpectedly.`);
}
