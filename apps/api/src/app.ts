import { Hono } from "hono";
import { fail } from "@vex-os/shared";
import type { AuthedVariables } from "./middleware/jwt";
import { jwtMiddleware } from "./middleware/jwt";
import { errorHandler } from "./middleware/error-handler";
import { healthRoute } from "./routes/health";
import { onboardingRoute } from "./routes/onboarding";

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

  app.route("/api/v1", v1);

  return app;
}
