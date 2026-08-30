// Service-to-service endpoints, mounted at /api/v1/internal - not part of
// API-001's original spec (that document predates the Delegate-linkage
// gap this closes). Protected by internalSecretMiddleware, not JWT/RBAC.

import { Hono } from "hono";
import { z } from "zod";
import { fail, ok } from "@nyxor/shared";
import { resolveRoleForEmail } from "../domains/delegates/resolve-role-for-email.js";

export const internalRoute = new Hono();

const ResolveRoleQuerySchema = z.object({ email: z.string().email() });

// Called by apps/web's auth.ts (NextAuth jwt callback) at sign-in to decide
// what role a session gets minted with - see resolve-role-for-email.ts for
// the precedence rules.
internalRoute.get("/resolve-role", async (c) => {
  const parsed = ResolveRoleQuerySchema.safeParse({ email: c.req.query("email") });
  if (!parsed.success) {
    return c.json(fail("VALIDATION_ERROR", "A valid email query param is required."), 400);
  }

  const role = await resolveRoleForEmail(parsed.data.email);
  return c.json(ok({ role }));
});
