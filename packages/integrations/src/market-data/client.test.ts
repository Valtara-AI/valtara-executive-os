import { afterEach, describe, expect, it, vi } from "vitest";
import { getQuotes } from "./client.js";

describe("getQuotes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ALPHA_VANTAGE_API_KEY;
  });

  it("returns an empty array without calling fetch for an empty ticker list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.ALPHA_VANTAGE_API_KEY = "test-key";

    expect(await getQuotes([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws if ALPHA_VANTAGE_API_KEY is unset and any ticker is requested", async () => {
    delete process.env.ALPHA_VANTAGE_API_KEY;
    await expect(getQuotes(["AAPL"])).rejects.toThrow(/ALPHA_VANTAGE_API_KEY/);
  });

  it("parses a successful GLOBAL_QUOTE response", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            "Global Quote": {
              "01. symbol": "AAPL",
              "05. price": "227.50",
              "10. change percent": "1.23%",
              "07. latest trading day": "2026-03-15",
            },
          }),
      }),
    );

    const quotes = await getQuotes(["AAPL"]);
    expect(quotes).toEqual([
      { ticker: "AAPL", price: 227.5, changePercent: 1.23, asOf: "2026-03-15" },
    ]);
  });

  it("omits a ticker whose response has no Global Quote data, without failing the others", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("symbol=BADTICKER")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ "Global Quote": {} }) });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              "Global Quote": {
                "01. symbol": "AAPL",
                "05. price": "227.50",
                "10. change percent": "1.23%",
                "07. latest trading day": "2026-03-15",
              },
            }),
        });
      }),
    );

    const quotes = await getQuotes(["AAPL", "BADTICKER"]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.ticker).toBe("AAPL");
  });

  it("omits a ticker whose request fails, without failing the others", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() }),
    );

    const quotes = await getQuotes(["AAPL"]);
    expect(quotes).toEqual([]);
  });
});
