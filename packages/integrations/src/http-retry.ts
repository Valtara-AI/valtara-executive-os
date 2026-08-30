// Shared 429/5xx exponential-backoff retry logic (Retry-After aware), the
// same policy each OAuth adapter's authenticated-fetch.ts already
// implements inline (see e.g. google/authenticated-fetch.ts). Pulled out
// here specifically for API-key-based clients (market-data, news) that have
// no token to refresh on 401 and no meaningful "insufficient scope" 403 -
// those two concerns stay adapter-specific per provider; only the generic
// "retry a failed fetch with backoff" part is shared, to avoid a third
// copy-paste as more API-key clients are added.

const DEFAULT_MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches `url`, retrying on 429 (respecting Retry-After) and 5xx with
 * exponential backoff, up to `maxRetries` attempts (default 3, matching
 * every OAuth adapter's MAX_RETRIES). Any other non-ok status (4xx besides
 * 429) is returned immediately, unretried, for the caller to inspect/throw
 * on - those are permanent errors (bad API key, malformed request), not
 * transient ones.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) return res;

    lastResponse = res;
    if (attempt === maxRetries) break;

    const retryAfterHeader = res.headers.get("Retry-After");
    const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
    await sleep(delayMs);
  }

  return lastResponse!;
}
