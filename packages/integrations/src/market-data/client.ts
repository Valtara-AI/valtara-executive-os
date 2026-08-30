// Deliberately NOT an IntegrationAdapter (see types.ts's OAuth-shaped
// interface): Alpha Vantage is a single org-wide API key, not per-executive
// three-legged OAuth. There is nothing to "connect"/"disconnect" per
// executive and no getAuthorizationUrl/exchangeCodeForTokens to implement -
// forcing this into that interface would misrepresent the security model.
// ALPHA_VANTAGE_API_KEY is a platform secret (same tier as RESEND_API_KEY),
// read directly from process.env, never stored in integration_tokens - that
// table's encrypted-per-executive shape doesn't apply to a key that isn't
// per-executive at all.
//
// Alpha Vantage's free tier is 25 requests/day - fine for a single daily
// morning-brief pass over one executive's watchlist, but will need a paid
// tier before real multi-executive production use. This module makes no
// attempt to cache/dedupe across executives; that's a future concern if
// volume ever approaches the limit.

import { fetchWithBackoff } from "../http-retry.js";
import type { Quote } from "./types.js";

const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

interface GlobalQuoteResponse {
  "Global Quote"?: {
    "01. symbol"?: string;
    "05. price"?: string;
    "10. change percent"?: string;
    "07. latest trading day"?: string;
  };
}

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY must be set (see .env.example).");
  return key;
}

async function getQuote(ticker: string, apiKey: string): Promise<Quote> {
  const url = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const res = await fetchWithBackoff(url);
  if (!res.ok) {
    throw new Error(`Alpha Vantage request for "${ticker}" failed (${res.status}).`);
  }

  const body = (await res.json()) as GlobalQuoteResponse;
  const quote = body["Global Quote"];
  const price = quote?.["05. price"];
  const changePercent = quote?.["10. change percent"];
  if (!quote || !price) {
    // Alpha Vantage returns 200 with an empty {"Global Quote": {}} for an
    // unknown symbol, and a 200 with a "Note"/"Information" field (rate
    // limit or invalid key) instead of "Global Quote" entirely - both look
    // like success at the HTTP layer, so this has to be caught here rather
    // than via fetchWithBackoff's status-code checks.
    throw new Error(`Alpha Vantage returned no quote data for "${ticker}".`);
  }

  return {
    ticker: quote["01. symbol"] ?? ticker,
    price: Number(price),
    changePercent: Number((changePercent ?? "0%").replace("%", "")),
    asOf: quote["07. latest trading day"] ?? new Date().toISOString().slice(0, 10),
  };
}

/**
 * Fetches current quotes for the given tickers. Each ticker is a separate
 * Alpha Vantage request (GLOBAL_QUOTE has no batch endpoint on the free
 * tier); a single ticker failing doesn't fail the whole call - it's simply
 * omitted, so a typo'd or delisted ticker in someone's watchlist doesn't
 * take down the rest of their portfolio section.
 */
export async function getQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  const apiKey = getApiKey();

  const results = await Promise.allSettled(tickers.map((ticker) => getQuote(ticker, apiKey)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}
