// SEC-001 §3.2 RBAC matrix, enforced server-side on every request:
// Executive  = full access to own data (agents, HITL, integrations, etc.)
// Delegate   = HITL read/approve/reject/edit + task/brief view only; no
//              agent config, no integrations
// Administrator = system config + audit export + user role management;
//              explicitly no access to executive content
//
// "Client-side role checks are for UX only and are not trusted as a
// security boundary" — this middleware is the actual boundary.

import type { Context, Next } from "hono";
import type { Role } from "@vex-os/shared";
import { fail } from "@vex-os/shared";
import type { AuthedVariables } from "./jwt.js";

export function requireRole(...allowedRoles: Role[]) {
  return async (c: Context<{ Variables: AuthedVariables }>, next: Next) => {
    const user = c.get("user");
    if (!user) {
      // jwtMiddleware must run before requireRole on every route; this is a
      // defensive check, not the primary auth gate.
      return c.json(fail("UNAUTHORIZED", "Missing authenticated user context."), 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        fail("FORBIDDEN", `Role "${user.role}" is not permitted to access this resource.`),
        403,
      );
    }

    await next();
  };
}
