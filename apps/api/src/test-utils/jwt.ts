// Shared by DB-gated route tests (agents/tasks/hitl) that need real signed
// JWTs against a real app instance, rather than app.test.ts's approach of
// mocking the domain layer entirely.

import { SignJWT, exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import type { JwtPayload, Role } from "@vex-os/shared";

export async function createTestJwtSigner() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicKeyPem = await exportSPKI(publicKey);
  // PKCS8, matching what JWT_PRIVATE_KEY holds in real deployments and
  // what oauth-state.ts's importPKCS8 expects - needed by tests that
  // exercise the OAuth-state signing path (apps/api's own concern, not
  // jwtMiddleware's), not just user-token verification.
  const privateKeyPem = await exportPKCS8(privateKey);

  async function signToken(
    payload: Partial<JwtPayload> & { email: string; role: Role },
  ): Promise<string> {
    return new SignJWT({ email: payload.email, role: payload.role })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(payload.sub ?? payload.email)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  return { publicKeyPem, privateKeyPem, signToken };
}
