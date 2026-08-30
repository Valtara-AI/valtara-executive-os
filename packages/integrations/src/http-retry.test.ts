import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithBackoff } from "./http-retry.js";

describe("fetchWithBackoff", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response immediately on a 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithBackoff("https://example.com");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a non-retryable 4xx immediately, unretried", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithBackoff("https://example.com");
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 respecting Retry-After, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "0" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithBackoff("https://example.com");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx with exponential backoff, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithBackoff("https://example.com", {}, 3);
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up and returns the last failing response after maxRetries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithBackoff("https://example.com", {}, 2);
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
