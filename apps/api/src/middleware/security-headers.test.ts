import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers.js";

function buildApp() {
  const app = new Hono();
  app.use("*", securityHeaders);
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("securityHeaders", () => {
  it("sets HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy", async () => {
    const res = await buildApp().request("/");
    expect(res.headers.get("Strict-Transport-Security")).toBeTruthy();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBeTruthy();
    expect(res.headers.get("Referrer-Policy")).toBeTruthy();
  });

  it("sets a Permissions-Policy header denying camera/microphone/geolocation/payment/usb", async () => {
    const res = await buildApp().request("/");
    const policy = res.headers.get("Permissions-Policy");
    expect(policy).toBeTruthy();
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("removes the X-Powered-By header", async () => {
    const res = await buildApp().request("/");
    expect(res.headers.get("X-Powered-By")).toBeNull();
  });
});
