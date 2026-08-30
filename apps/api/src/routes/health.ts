import { Hono } from "hono";
import { ok } from "@nyxor/shared";

export const healthRoute = new Hono();

// Unauthenticated, alongside /auth/* (API-001 §2.1: "all endpoints require
// authentication except /auth/*" — health checks get the same exemption so
// infra/uptime monitors don't need a token).
healthRoute.get("/health", (c) => {
  return c.json(ok({ status: "ok" }));
});
