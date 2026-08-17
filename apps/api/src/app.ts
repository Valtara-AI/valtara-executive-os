import { Hono } from "hono";
import { fail } from "@vex-os/shared";
import type { AuthedVariables } from "./middleware/jwt.js";
import { jwtMiddleware } from "./middleware/jwt.js";
import { errorHandler } from "./middleware/error-handler.js";
import { internalSecretMiddleware } from "./middleware/internal-secret.js";
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

// API-001 §2.1: base URL /api/v1/, all endpoints require authentication
// except /auth/* (and, by the same rationale, /health).
export function createApp() {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.onError(errorHandler);
  // Keep the {success, data, error} envelope even for unmatched routes -
  // Hono's default 404 is plain text, which would be the one response
  // shape in the whole API that breaks API-001 §2.1's contract.
  app.notFound((c) => c.json(fail("NOT_FOUND", "Route not found."), 404));

  const v1 = new Hono<{ Variables: AuthedVariables }>();
  v1.route("/", healthRoute);

  // Everything below this point requires a valid JWT (SEC-001 §3.2: "RBAC
  // is enforced server-side on every API request").
  v1.use("/executive/*", jwtMiddleware);
  v1.route("/executive/onboarding", onboardingRoute);
  v1.route("/executive/delegates", executiveDelegatesRoute);
  v1.route("/executive/profile", executiveProfileRoute);

  v1.use("/agents/*", jwtMiddleware);
  v1.route("/agents", agentsRoute);

  v1.use("/tasks/*", jwtMiddleware);
  v1.route("/tasks", tasksRoute);

  v1.use("/hitl/queue/*", jwtMiddleware);
  v1.route("/hitl/queue", hitlRoute);

  v1.use("/delegate/*", jwtMiddleware);
  v1.route("/delegate/invitations", delegateInvitationsRoute);

  v1.use("/briefs/*", jwtMiddleware);
  v1.route("/briefs", briefsRoute);

  v1.use("/dashboard/*", jwtMiddleware);
  v1.route("/dashboard", dashboardRoute);

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
