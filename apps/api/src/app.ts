import { Hono } from "hono";
import { fail } from "@vex-os/shared";
import type { AuthedVariables } from "./middleware/jwt.js";
import { jwtMiddleware } from "./middleware/jwt.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoute } from "./routes/health.js";
import { onboardingRoute } from "./routes/onboarding.js";
import { agentsRoute } from "./routes/agents.js";
import { tasksRoute } from "./routes/tasks.js";
import { hitlRoute } from "./routes/hitl.js";

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

  v1.use("/agents/*", jwtMiddleware);
  v1.route("/agents", agentsRoute);

  v1.use("/tasks/*", jwtMiddleware);
  v1.route("/tasks", tasksRoute);

  v1.use("/hitl/queue/*", jwtMiddleware);
  v1.route("/hitl/queue", hitlRoute);

  app.route("/api/v1", v1);

  return app;
}
