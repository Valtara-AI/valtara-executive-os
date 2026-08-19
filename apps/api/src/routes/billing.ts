// DL-ARCH-010, mounted at /api/v1/billing. Executive-only - Delegates and
// Administrators never manage the Executive's own subscription (SEC-001
// §3.2's role matrix has no billing duty for either).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getEntitlements,
} from "@vex-os/billing";
import { z } from "zod";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const billingRoute = new Hono<{ Variables: AuthedVariables }>();

billingRoute.use("*", requireRole("Executive"));

billingRoute.get("/subscription", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.executiveId, executive.id));
  const entitlements = await getEntitlements(executive.id);
  return c.json(ok({ subscription: row ?? null, entitlements }));
});

const CheckoutBodySchema = z.object({ tier: z.enum(["starter", "pro", "enterprise"]) });

billingRoute.post("/checkout", async (c) => {
  const parsed = CheckoutBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "A valid tier is required.", { issues: parsed.error.issues }),
      400,
    );
  }
  const executive = await resolveExecutive(c.get("user"));
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const { url } = await createCheckoutSession({
    executiveId: executive.id,
    email: c.get("user").email,
    tier: parsed.data.tier,
    successUrl: `${appUrl}/dashboard?billing=connected`,
    cancelUrl: `${appUrl}/dashboard?billing=cancelled`,
  });
  return c.json(ok({ url }));
});

billingRoute.post("/portal", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.executiveId, executive.id));
  if (!row) {
    return c.json(
      fail("NO_SUBSCRIPTION", "No billing account exists yet - complete checkout first."),
      404,
    );
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const { url } = await createBillingPortalSession({
    stripeCustomerId: row.stripeCustomerId,
    returnUrl: `${appUrl}/dashboard`,
  });
  return c.json(ok({ url }));
});
