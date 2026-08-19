import { Hono } from "hono";
import { fail } from "@vex-os/shared";
import type { AuthedVariables } from "./middleware/jwt.js";
import { jwtMiddleware } from "./middleware/jwt.js";
import { errorHandler } from "./middleware/error-handler.js";
import { internalSecretMiddleware } from "./middleware/internal-secret.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { corsMiddleware } from "./middleware/cors.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { healthRoute } from "./routes/health.js";
import { onboardingRoute } from "./routes/onboarding.js";
import { agentsRoute } from "./routes/agents.js";
import { tasksRoute } from "./routes/tasks.js";
import { hitlRoute } from "./routes/hitl.js";
import { executiveDelegatesRoute, delegateInvitationsRoute } from "./routes/delegates.js";
import { internalRoute } from "./routes/internal.js";
import { briefsRoute } from "./routes/briefs.js";
import { dashboardRoute } from "./routes/dashboard.js";
import { executiveProfileRoute } from "./routes/executive-profile.js";
import { integrationsRoute, integrationsCallbackRoute } from "./routes/integrations.js";
import { complianceRoute } from "./routes/compliance.js";
import { billingRoute } from "./routes/billing.js";
import { webhooksRoute } from "./routes/webhooks.js";

// API-001 §2.1: base URL /api/v1/, all endpoints require authentication
// except /auth/* (and, by the same rationale, /health).
export function createApp() {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.onError(errorHandler);
  // Keep the {success, data, error} envelope even for unmatched routes -
  // Hono's default 404 is plain text, which would be the one response
  // shape in the whole API that breaks API-001 §2.1's contract.
  app.notFound((c) => c.json(fail("NOT_FOUND", "Route not found."), 404));

  // Applied to every response, authenticated or not (SEC-001 §4: security
  // headers and CORS policy apply API-wide, not just to protected routes).
  app.use("*", securityHeaders);
  app.use("*", corsMiddleware);

  const v1 = new Hono<{ Variables: AuthedVariables }>();
  v1.route("/", healthRoute);

  // Everything below this point requires a valid JWT (SEC-001 §3.2: "RBAC
  // is enforced server-side on every API request") and counts against the
  // general per-user rate limit (SEC-001 §4) - generalRateLimit runs after
  // jwtMiddleware in each pair below so it can key off c.get("user").
  v1.use("/executive/*", jwtMiddleware, generalRateLimit);
  v1.route("/executive/onboarding", onboardingRoute);
  v1.route("/executive/delegates", executiveDelegatesRoute);
  v1.route("/executive/profile", executiveProfileRoute);

  v1.use("/agents/*", jwtMiddleware, generalRateLimit);
  v1.route("/agents", agentsRoute);

  v1.use("/tasks/*", jwtMiddleware, generalRateLimit);
  v1.route("/tasks", tasksRoute);

  v1.use("/hitl/queue/*", jwtMiddleware, generalRateLimit);
  v1.route("/hitl/queue", hitlRoute);

  v1.use("/delegate/*", jwtMiddleware, generalRateLimit);
  v1.route("/delegate/invitations", delegateInvitationsRoute);

  v1.use("/briefs/*", jwtMiddleware, generalRateLimit);
  v1.route("/briefs", briefsRoute);

  v1.use("/dashboard/*", jwtMiddleware, generalRateLimit);
  v1.route("/dashboard", dashboardRoute);

  v1.use("/compliance/*", jwtMiddleware, generalRateLimit);
  v1.route("/compliance", complianceRoute);

  v1.use("/billing/*", jwtMiddleware, generalRateLimit);
  v1.route("/billing", billingRoute);

  // Unauthenticated like integrationsCallbackRoute above - Stripe calls
  // this directly, never via a browser or SPA (routes/webhooks.ts's file
  // header).
  v1.route("/webhooks", webhooksRoute);

  // Service-to-service only - internalSecretMiddleware, not jwtMiddleware.
  // Called by apps/web's NextAuth server-side, never by a browser.
  v1.use("/internal/*", internalSecretMiddleware);
  v1.route("/internal", internalRoute);

  // No blanket jwtMiddleware here (unlike every group above) - the two
  // routers mounted below carry their own auth internally, deliberately
  // different per route: integrationsRoute requires a Bearer token,
  // integrationsCallbackRoute (the OAuth redirect target) can't have one -
  // see routes/integrations.ts's file header.
  v1.route("/integrations", integrationsCallbackRoute);
  v1.route("/integrations", integrationsRoute);

  app.route("/api/v1", v1);

  return app;
}
