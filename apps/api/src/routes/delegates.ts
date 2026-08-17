// Not in API-001's original spec (predates the Delegate-linkage gap this
// closes). Two routers: executiveDelegatesRoute (an Executive managing who
// delegates for them, mounted at /api/v1/executive/delegates) and
// delegateInvitationsRoute (any authenticated user managing invitations
// addressed to their own email, mounted at /api/v1/delegate/invitations).

import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@vex-os/database";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { inviteDelegate, normalizeEmail } from "../domains/delegates/invite-delegate.js";

export const executiveDelegatesRoute = new Hono<{ Variables: AuthedVariables }>();

executiveDelegatesRoute.use("*", requireRole("Executive"));

executiveDelegatesRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const rows = await getDb()
    .select()
    .from(schema.delegateLinks)
    .where(eq(schema.delegateLinks.executiveId, executive.id));
  return c.json(ok(rows));
});

const InviteBodySchema = z.object({ email: z.string().email() });

executiveDelegatesRoute.post("/", async (c) => {
  const parsed = InviteBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "A valid email is required.", { issues: parsed.error.issues }),
      400,
    );
  }
  const executive = await resolveExecutive(c.get("user"));
  const link = await inviteDelegate(executive.id, parsed.data.email);
  return c.json(ok(link), 201);
});

executiveDelegatesRoute.delete("/:linkId", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const db = getDb();

  const [link] = await db
    .select()
    .from(schema.delegateLinks)
    .where(eq(schema.delegateLinks.id, c.req.param("linkId")!));
  if (!link || link.executiveId !== executive.id) {
    return c.json(fail("NOT_FOUND", "Delegate link not found."), 404);
  }

  const [revoked] = await db
    .update(schema.delegateLinks)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(schema.delegateLinks.id, link.id))
    .returning();
  return c.json(ok(revoked));
});

export const delegateInvitationsRoute = new Hono<{ Variables: AuthedVariables }>();

// No requireRole gate: a brand-new user with no role-defining data yet
// still needs to see invitations addressed to them (that's exactly how
// they become a Delegate - see resolve-role-for-email.ts). Scoped entirely
// by matching the JWT's own email, not by role.

delegateInvitationsRoute.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()
    .select()
    .from(schema.delegateLinks)
    .where(
      and(
        eq(schema.delegateLinks.delegateEmail, normalizeEmail(user.email)),
        eq(schema.delegateLinks.status, "pending"),
      ),
    );
  return c.json(ok(rows));
});

async function respondToInvitation(
  c: Context<{ Variables: AuthedVariables }>,
  status: "accepted" | "declined",
) {
  const user = c.get("user");
  const db = getDb();

  const [link] = await db
    .select()
    .from(schema.delegateLinks)
    .where(eq(schema.delegateLinks.id, c.req.param("linkId")!));
  if (!link || link.delegateEmail !== normalizeEmail(user.email)) {
    return c.json(fail("NOT_FOUND", "Invitation not found."), 404);
  }
  if (link.status !== "pending") {
    return c.json(fail("INVALID_STATE", `Invitation is already "${link.status}".`), 409);
  }

  const [updated] = await db
    .update(schema.delegateLinks)
    .set({ status, respondedAt: new Date() })
    .where(eq(schema.delegateLinks.id, link.id))
    .returning();
  return c.json(ok(updated));
}

delegateInvitationsRoute.post("/:linkId/accept", (c) => respondToInvitation(c, "accepted"));
delegateInvitationsRoute.post("/:linkId/decline", (c) => respondToInvitation(c, "declined"));
