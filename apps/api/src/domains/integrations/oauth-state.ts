// The OAuth callback (routes/integrations.ts's GET /:provider/callback) is
// a top-level browser redirect from Google - it carries no
// `Authorization: Bearer` header the way every other authenticated route
// in this API does, since browsers don't attach custom headers to
// navigations. This signed, short-lived state token *is* that route's
// authentication: minted here (by /authorize, which *is* a normal
// Bearer-authenticated call) and verified on the way back, it's what
// proves which executive this callback belongs to and carries the PKCE
// code_verifier that has to survive the round trip to Google and back.
//
// Reuses apps/api's existing JWT_PRIVATE_KEY/JWT_PUBLIC_KEY RS256 keypair
// (same one that signs/verifies user access tokens) rather than
// introducing a second secret - this token just carries a different
// payload shape and a much shorter TTL.

import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

const STATE_TTL_SECONDS = 10 * 60; // long enough for a real consent-screen interaction

export interface OAuthStatePayload {
  executiveId: string;
  provider: string;
  codeVerifier: string;
}

let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | undefined;
let cachedPublicKey: Awaited<ReturnType<typeof importSPKI>> | undefined;

async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY must be set (see .env.example).");
  cachedPrivateKey = await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
  return cachedPrivateKey;
}

async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY must be set (see .env.example).");
  cachedPublicKey = await importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
  return cachedPublicKey;
}

export async function signOAuthState(payload: OAuthStatePayload): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ ...payload, purpose: "oauth-state" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyOAuthState(token: string): Promise<OAuthStatePayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });

  if (
    payload.purpose !== "oauth-state" ||
    typeof payload.executiveId !== "string" ||
    typeof payload.provider !== "string" ||
    typeof payload.codeVerifier !== "string"
  ) {
    throw new Error("Malformed OAuth state token.");
  }

  return {
    executiveId: payload.executiveId,
    provider: payload.provider,
    codeVerifier: payload.codeVerifier,
  };
}
