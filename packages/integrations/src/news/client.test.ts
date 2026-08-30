import { afterEach, describe, expect, it, vi } from "vitest";
import { getHeadlines } from "./client.js";

describe("getHeadlines", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEWS_API_KEY;
  });

  it("throws if NEWS_API_KEY is unset", async () => {
    delete process.env.NEWS_API_KEY;
    await expect(getHeadlines({ topics: [], limit: 5 })).rejects.toThrow(/NEWS_API_KEY/);
  });

  it("filters by topics via the q param when topics are given", async () => {
    process.env.NEWS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok", articles: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHeadlines({ topics: ["Tesla", "AI regulation"], limit: 5 });

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    const requestedQuery = new URL(requestedUrl).searchParams.get("q");
    expect(requestedQuery).toBe('"Tesla" OR "AI regulation"');
  });

  it("falls back to a broad, non-empty query when no topics are given", async () => {
    process.env.NEWS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok", articles: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHeadlines({ topics: [], limit: 5 });

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain("q=business");
  });

  it("parses a successful response into Headline objects", async () => {
    process.env.NEWS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            articles: [
              {
                title: "Fed holds rates steady",
                description: "The Federal Reserve...",
                url: "https://example.com/a",
                source: { name: "Example News" },
                publishedAt: "2026-03-15T12:00:00Z",
              },
            ],
          }),
      }),
    );

    const headlines = await getHeadlines({ topics: [], limit: 5 });
    expect(headlines).toEqual([
      {
        title: "Fed holds rates steady",
        summary: "The Federal Reserve...",
        url: "https://example.com/a",
        source: "Example News",
        publishedAt: "2026-03-15T12:00:00Z",
      },
    ]);
  });

  it("throws when NewsAPI returns a non-ok status", async () => {
    process.env.NEWS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ status: "error", message: "Invalid API key." }),
      }),
    );

    await expect(getHeadlines({ topics: [], limit: 5 })).rejects.toThrow(/Invalid API key/);
  });
});
