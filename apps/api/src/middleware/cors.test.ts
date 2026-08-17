import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { corsMiddleware } from "./cors.js";

const ORIGINAL_CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS;
const ORIGINAL_APP_URL = process.env.APP_URL;

afterEach(() => {
  if (ORIGINAL_CORS_ALLOWED_ORIGINS === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
  else process.env.CORS_ALLOWED_ORIGINS = ORIGINAL_CORS_ALLOWED_ORIGINS;
  if (ORIGINAL_APP_URL === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = ORIGINAL_APP_URL;
});

function buildApp() {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("corsMiddleware", () => {
  it("echoes Access-Control-Allow-Origin for a whitelisted origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    const res = await buildApp().request("/", {
      headers: { Origin: "https://app.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("omits Access-Control-Allow-Origin for a non-whitelisted origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    const res = await buildApp().request("/", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("supports a comma-separated list of allowed origins", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://a.example.com, https://b.example.com";
    const resA = await buildApp().request("/", { headers: { Origin: "https://a.example.com" } });
    const resB = await buildApp().request("/", { headers: { Origin: "https://b.example.com" } });
    expect(resA.headers.get("Access-Control-Allow-Origin")).toBe("https://a.example.com");
    expect(resB.headers.get("Access-Control-Allow-Origin")).toBe("https://b.example.com");
  });

  it("falls back to APP_URL when CORS_ALLOWED_ORIGINS is unset", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.APP_URL = "https://fallback.example.com";
    const res = await buildApp().request("/", {
      headers: { Origin: "https://fallback.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://fallback.example.com");
  });
});
