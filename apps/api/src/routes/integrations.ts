// API-001 §2.8, mounted at /api/v1/integrations. GET /:provider/callback
// is deliberately NOT behind jwtMiddleware - see
// domains/integrations/oauth-state.ts for why (it's a browser redirect
// from Google, not an API call with a Bearer token).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  beginGoogleAuthorization,
  buildGoogleAuthorizationUrl,
  completeGoogleConnection,
  disconnectGoogle,
  isGoogleConnected,
} from "@vex-os/integrations";
import { fail, ok } from "@vex-os/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { jwtMiddleware } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { signOAuthState, verifyOAuthState } from "../domains/integrations/oauth-state.js";
import { logTaskEvent } from "@vex-os/audit";

// Only Google exists as of Sprint 4 - Outlook (Sprint 5) and Slack
// (Sprint 6) add entries here, not new route files, once they land.
const SUPPORTED_PROVIDERS = ["google"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

export const integrationsRoute = new Hono<{ Variables: AuthedVariables }>();

// jwtMiddleware applied *inside* this router, not via an app.ts-level
// path-prefix .use("/integrations/*", ...): both this router and
// integrationsCallbackRoute below mount at the same /integrations prefix
// in app.ts, and a prefix-level gate would incorrectly also cover the
// callback route, which can't carry a Bearer token (see the file header).
// Scoping auth per-router instead of per-path-prefix avoids that collision
// entirely.
integrationsRoute.use("*", jwtMiddleware);
integrationsRoute.use("*", requireRole("Executive"));

integrationsRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const statuses = await Promise.all(
    SUPPORTED_PROVIDERS.map(async (provider) => ({
      provider,
      connected: provider === "google" ? await isGoogleConnected(executive.id) : false,
    })),
  );
  return c.json(ok(statuses));
});

integrationsRoute.get("/:provider/authorize", async (c) => {
  const provider = c.req.param("provider")!;
  if (!isSupportedProvider(provider)) {
    return c.json(
      fail("UNSUPPORTED_PROVIDER", `"${provider}" is not a supported integration.`),
      400,
    );
  }
  const executive = await resolveExecutive(c.get("user"));

  if (provider === "google") {
    // PKCE's real data dependency: codeVerifier must exist before state
    // (which embeds it) can be signed, and codeChallenge (needed for the
    // URL) is derived from that same codeVerifier - so generate the pair
    // first, sign state from it, then build the URL from state + challenge.
    const { codeVerifier, codeChallenge } = beginGoogleAuthorization();
    const state = await signOAuthState({ executiveId: executive.id, provider, codeVerifier });
    const url = buildGoogleAuthorizationUrl(codeChallenge, state);
    return c.json(ok({ url }));
  }

  return c.json(fail("UNSUPPORTED_PROVIDER", `"${provider}" is not a supported integration.`), 400);
});

integrationsRoute.delete("/:provider", async (c) => {
  const provider = c.req.param("provider")!;
  if (!isSupportedProvider(provider)) {
    return c.json(
      fail("UNSUPPORTED_PROVIDER", `"${provider}" is not a supported integration.`),
      400,
    );
  }
  const executive = await resolveExecutive(c.get("user"));

  if (provider === "google") {
    await disconnectGoogle(executive.id);
  }

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "integration",
    entityId: executive.id,
    action: "integration_disconnected",
    output: { provider },
  });

  return c.json(ok({ provider, connected: false }));
});

// Unauthenticated (no jwtMiddleware) - see the file header. Mounted
// separately in app.ts.
export const integrationsCallbackRoute = new Hono();

integrationsCallbackRoute.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider")!;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!code || !state) {
    return c.redirect(`${appUrl}/dashboard?integration=error`);
  }

  try {
    const statePayload = await verifyOAuthState(state);
    if (statePayload.provider !== provider) {
      throw new Error("State token provider does not match callback URL provider.");
    }

    if (provider === "google") {
      await completeGoogleConnection(statePayload.executiveId, code, statePayload.codeVerifier);
    } else {
      throw new Error(`"${provider}" is not a supported integration.`);
    }

    const db = getDb();
    const [executive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.id, statePayload.executiveId));
    if (executive) {
      await logTaskEvent({
        actorId: executive.id,
        actorRole: "Executive",
        entityType: "integration",
        entityId: executive.id,
        action: "integration_connected",
        output: { provider },
      });
    }

    return c.redirect(`${appUrl}/dashboard?integration=connected`);
  } catch {
    return c.redirect(`${appUrl}/dashboard?integration=error`);
  }
});
