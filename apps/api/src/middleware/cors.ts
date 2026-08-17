// SRS §7 / SEC-001 §4: "CORS policy | Strict CORS origin whitelist; no
// wildcard origins in production." Reads CORS_ALLOWED_ORIGINS fresh on
// each request (not once at module load) so tests can set it dynamically
// and so a runtime config change doesn't need a process restart to take
// effect - same rationale as routes/integrations.ts reading APP_URL inside
// its handlers rather than caching it.
//
// No credentials: true - apps/web sends the JWT as an explicit
// `Authorization: Bearer` header (lib/api-client.ts's apiFetch), not a
// cookie automatically attached cross-origin, so there's nothing here that
// needs the browser to include credentials on the CORS request.

import { cors } from "hono/cors";

function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? process.env.APP_URL ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const corsMiddleware = cors({
  origin: (origin) => (getAllowedOrigins().includes(origin) ? origin : undefined),
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
});
