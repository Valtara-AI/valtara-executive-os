// API-001 §2.3 onboarding endpoints, mounted at /api/v1/executive/onboarding.
// Executive-role-only (SEC-001 §3.2: onboarding configures the executive's
// own agent workforce, not something a Delegate or Administrator does).

import { Hono } from "hono";
import { z } from "zod";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import * as onboardingEngine from "../domains/onboarding/engine.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const onboardingRoute = new Hono<{ Variables: AuthedVariables }>();

onboardingRoute.use("*", requireRole("Executive"));

onboardingRoute.post("/start", async (c) => {
  const user = c.get("user");
  const executive = await resolveExecutive(user);
  const result = await onboardingEngine.startSession(executive.id);
  return c.json(ok(result));
});

const RespondBodySchema = z.object({
  sessionId: z.string().uuid(),
  response: z.string().min(1),
});

onboardingRoute.post("/respond", async (c) => {
  const parsed = RespondBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }
  const result = await onboardingEngine.respond(parsed.data.sessionId, parsed.data.response);
  return c.json(ok(result));
});

const CompleteBodySchema = z.object({
  sessionId: z.string().uuid(),
});

onboardingRoute.post("/complete", async (c) => {
  const parsed = CompleteBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }
  const result = await onboardingEngine.complete(parsed.data.sessionId);
  return c.json(ok(result));
});

const ConfirmBodySchema = z.object({
  sessionId: z.string().uuid(),
  agents: z.array(
    z.object({
      proposalId: z.string().uuid(),
      name: z.string().min(1),
      hitlMode: z.enum(["auto_draft_review", "checkpoint", "autonomous_report"]),
      active: z.boolean(),
    }),
  ),
});

onboardingRoute.post("/confirm", async (c) => {
  const parsed = ConfirmBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }
  const result = await onboardingEngine.confirm(parsed.data.sessionId, parsed.data.agents);
  return c.json(ok(result));
});
