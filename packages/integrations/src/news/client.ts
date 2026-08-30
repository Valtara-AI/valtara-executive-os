// Deliberately NOT an IntegrationAdapter - same reasoning as
// ../market-data/client.ts: NewsAPI is a single org-wide API key, not
// per-executive OAuth. NEWS_API_KEY is a platform secret, read directly
// from process.env.
//
// NewsAPI's free "Developer" plan is explicitly restricted to local
// development/testing per their terms - a paid plan is required before
// this goes live in production, not just at scale.
//
// Topic filtering happens server-side via NewsAPI's own `q` param, not by
// fetching everything and asking the LLM to pick - cheaper (no wasted
// context tokens on irrelevant headlines) and more precise than hoping the
// model selects the right few out of a broad, unfiltered set.

import { fetchWithBackoff } from "../http-retry.js";
import type { Headline } from "./types.js";

const NEWS_API_BASE_URL = "https://newsapi.org/v2/everything";

interface NewsApiArticle {
  title: string;
  description: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
}

interface NewsApiResponse {
  status: "ok" | "error";
  articles?: NewsApiArticle[];
  message?: string;
}

function getApiKey(): string {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY must be set (see .env.example).");
  return key;
}

export interface GetHeadlinesParams {
  /** Topics/keywords to filter by, OR'd together server-side. Empty array falls back to no keyword filter (whatever's currently trending). */
  topics: string[];
  limit: number;
}

export async function getHeadlines({ topics, limit }: GetHeadlinesParams): Promise<Headline[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    sortBy: "publishedAt",
    language: "en",
    pageSize: String(limit),
    apiKey,
  });
  if (topics.length > 0) {
    params.set("q", topics.map((t) => `"${t}"`).join(" OR "));
  } else {
    // NewsAPI's /everything requires at least one of q/sources/domains -
    // fall back to a broad, always-non-empty query rather than erroring
    // out for executives who haven't set any topics of interest yet.
    params.set("q", "business OR markets");
  }

  const res = await fetchWithBackoff(`${NEWS_API_BASE_URL}?${params.toString()}`);
  const body = (await res.json()) as NewsApiResponse;
  if (!res.ok || body.status !== "ok") {
    throw new Error(`NewsAPI request failed: ${body.message ?? res.status}`);
  }

  return (body.articles ?? []).map((article) => ({
    title: article.title,
    summary: article.description ?? "",
    url: article.url,
    source: article.source.name,
    publishedAt: article.publishedAt,
  }));
}
