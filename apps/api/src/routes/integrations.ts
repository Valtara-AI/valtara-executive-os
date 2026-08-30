// API-001 §2.8, mounted at /api/v1/integrations. GET /:provider/callback
// is deliberately NOT behind jwtMiddleware - see
// domains/integrations/oauth-state.ts for why (it's a browser redirect
// from the provider, not an API call with a Bearer token).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import {
  beginGoogleAuthorization,
  buildGoogleAuthorizationUrl,
  completeGoogleConnection,
  disconnectGoogle,
  isGoogleConnected,
  beginMicrosoftAuthorization,
  buildMicrosoftAuthorizationUrl,
  completeMicrosoftConnection,
  disconnectMicrosoft,
  isMicrosoftConnected,
  beginSlackAuthorization,
  buildSlackAuthorizationUrl,
  completeSlackConnection,
  disconnectSlack,
  isSlackConnected,
  beginPandaDocAuthorization,
  buildPandaDocAuthorizationUrl,
  completePandaDocConnection,
  disconnectPandaDoc,
  isPandaDocConnected,
} from "@nyxor/integrations";
import { assertIntegrationAllowed, EntitlementError } from "@nyxor/billing";
import { fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { jwtMiddleware } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { generalRateLimit } from "../middleware/rate-limit.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { signOAuthState, verifyOAuthState } from "../domains/integrations/oauth-state.js";
import { logTaskEvent } from "@nyxor/audit";

// Google Sprint 4, Microsoft (Outlook) Sprint 5, Slack Sprint 6, PandaDoc
// post-launch (DL-ARCH-009).
const SUPPORTED_PROVIDERS = ["google", "microsoft", "slack", "pandadoc"] as const;
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
integrationsRoute.use("*", generalRateLimit);

async function isProviderConnected(
  provider: SupportedProvider,
  executiveId: string,
): Promise<boolean> {
  if (provider === "google") return isGoogleConnected(executiveId);
  if (provider === "microsoft") return isMicrosoftConnected(executiveId);
  if (provider === "slack") return isSlackConnected(executiveId);
  return isPandaDocConnected(executiveId);
}

integrationsRoute.get("/", async (c) => {
  const executive = await resolveExecutive(c.get("user"));
  const statuses = await Promise.all(
    SUPPORTED_PROVIDERS.map(async (provider) => ({
      provider,
      connected: await isProviderConnected(provider, executive.id),
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

  // Gated at connection time only, not on every subsequent Gmail/Calendar/
  // Slack/PandaDoc API call - a downgrade after connecting doesn't
  // retroactively revoke an already-connected integration's stored tokens.
  // Enforcing per-call would mean threading an entitlement check into
  // every adapter's authenticated-fetch (google/microsoft/slack/pandadoc),
  // which isn't justified for a first pass.
  try {
    await assertIntegrationAllowed(executive.id, provider);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return c.json(fail("ENTITLEMENT_LIMIT", err.message), 402);
    }
    throw err;
  }

  // PKCE's real data dependency (Google/Microsoft only - Slack has none,
  // see below): codeVerifier must exist before state (which embeds it) can
  // be signed, and codeChallenge (needed for the URL) is derived from that
  // same codeVerifier - so generate the pair first, sign state from it,
  // then build the URL from state + challenge.
  if (provider === "google") {
    const { codeVerifier, codeChallenge } = beginGoogleAuthorization();
    const state = await signOAuthState({ executiveId: executive.id, provider, codeVerifier });
    const url = buildGoogleAuthorizationUrl(codeChallenge, state);
    return c.json(ok({ url }));
  }

  if (provider === "microsoft") {
    const { codeVerifier, codeChallenge } = beginMicrosoftAuthorization();
    const state = await signOAuthState({ executiveId: executive.id, provider, codeVerifier });
    const url = buildMicrosoftAuthorizationUrl(codeChallenge, state);
    return c.json(ok({ url }));
  }

  // Slack and PandaDoc both have no PKCE (each provider's oauth.ts header
  // explains why) - codeVerifier is always "" here, carried through the
  // state token purely so signOAuthState's shared payload shape doesn't
  // need a provider-specific exception.
  if (provider === "slack") {
    const { codeVerifier } = beginSlackAuthorization();
    const state = await signOAuthState({ executiveId: executive.id, provider, codeVerifier });
    const url = buildSlackAuthorizationUrl(state);
    return c.json(ok({ url }));
  }

  const { codeVerifier } = beginPandaDocAuthorization();
  const state = await signOAuthState({ executiveId: executive.id, provider, codeVerifier });
  const url = buildPandaDocAuthorizationUrl(state);
  return c.json(ok({ url }));
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
  } else if (provider === "microsoft") {
    await disconnectMicrosoft(executive.id);
  } else if (provider === "slack") {
    await disconnectSlack(executive.id);
  } else {
    await disconnectPandaDoc(executive.id);
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
    } else if (provider === "microsoft") {
      await completeMicrosoftConnection(statePayload.executiveId, code, statePayload.codeVerifier);
    } else if (provider === "slack") {
      await completeSlackConnection(statePayload.executiveId, code);
    } else if (provider === "pandadoc") {
      await completePandaDocConnection(statePayload.executiveId, code);
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
