// SEC-001 §3.1: "JWT structure | Access token: RS256 signed; 1-hour TTL;
// payload: {sub, email, role, iat, exp}." apps/web's NextAuth v5 config
// (auth.ts) is the token *issuer*; this middleware is the token *verifier*
// used on every authenticated apps/api route — "RBAC is enforced
// server-side on every API request" (SEC-001 §3.2). Both sides read the
// same RS256 keypair from JWT_PRIVATE_KEY / JWT_PUBLIC_KEY.

import type { Context, Next } from "hono";
import { importSPKI, jwtVerify } from "jose";
import type { JwtPayload } from "@nyxor/shared";
import { fail } from "@nyxor/shared";
import { logger } from "../logger.js";

let cachedPublicKey: Awaited<ReturnType<typeof importSPKI>> | undefined;

async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) {
    throw new Error("JWT_PUBLIC_KEY must be set (see .env.example).");
  }
  cachedPublicKey = await importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
  return cachedPublicKey;
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("JWT payload missing required claims (sub, email, role).");
  }

  return payload as unknown as JwtPayload;
}

export type AuthedVariables = {
  user: JwtPayload;
};

export async function jwtMiddleware(c: Context<{ Variables: AuthedVariables }>, next: Next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token) {
    return c.json(fail("UNAUTHORIZED", "Missing bearer token."), 401);
  }

  try {
    const payload = await verifyAccessToken(token);
    c.set("user", payload);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "JWT verification failed");
    return c.json(fail("UNAUTHORIZED", "Invalid or expired token."), 401);
  }

  await next();
}
