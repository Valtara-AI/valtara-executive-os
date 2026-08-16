// Shared by DB-gated route tests (agents/tasks/hitl) that need real signed
// JWTs against a real app instance, rather than app.test.ts's approach of
// mocking the domain layer entirely.

import { SignJWT, exportSPKI, generateKeyPair } from "jose";
import type { JwtPayload, Role } from "@vex-os/shared";

export async function createTestJwtSigner() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicKeyPem = await exportSPKI(publicKey);

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

  return { publicKeyPem, signToken };
}
