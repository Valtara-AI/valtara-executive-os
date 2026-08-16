// NextAuth v5 (DL-PROD-001) is the OAuth *issuer* — it owns the Google/
// Microsoft consent flow and the web session cookie. apps/api's JWT
// middleware is the *verifier* of a separate, custom-minted RS256 access
// token: NextAuth's own session JWT uses its own (symmetric, AUTH_SECRET-
// keyed) encoding, which apps/api has no reason to understand. Instead, the
// `session` callback below mints a standalone RS256 JWT via `jose`, signed
// with JWT_PRIVATE_KEY, whose shape exactly matches
// packages/shared's JwtPayload and what apps/api/src/middleware/jwt.ts
// verifies with JWT_PUBLIC_KEY (SEC-001 §3.1). That token, not the NextAuth
// session cookie, is what's sent as `Authorization: Bearer` to apps/api.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { importPKCS8, SignJWT } from "jose";
import type { Role } from "@vex-os/shared";

// SEC-001 §3.2: every new sign-up gets the Executive role by default; the
// only account-creation surface in Sprint 1 is "the executive signs up",
// there is no admin-invite or delegate-invite flow yet. Role promotion to
// Delegate/Administrator is out of Sprint 1 scope.
const DEFAULT_ROLE: Role = "Executive";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour, matching SEC-001 §3.1

let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | undefined;

async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) {
    throw new Error("JWT_PRIVATE_KEY must be set (see .env.example).");
  }
  cachedPrivateKey = await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
  return cachedPrivateKey;
}

async function mintAccessToken(payload: {
  sub: string;
  email: string;
  role: Role;
}): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // AUTH-01: openid, email, profile — read-only identity scopes here;
      // Gmail/Calendar data scopes are requested separately by the
      // integrations flow (Sprint 4+), not at sign-in.
      authorization: { params: { scope: "openid email profile" } },
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}/v2.0`,
      authorization: { params: { scope: "openid email profile" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // AUTH-05: 8-hour default idle timeout
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First sign-in this session: stamp the default role. NextAuth's
        // own `token.sub` is already the stable provider-qualified user id.
        token.role = DEFAULT_ROLE;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !session.user?.email) return session;
      const accessToken = await mintAccessToken({
        sub: token.sub,
        email: session.user.email,
        role: (token.role as Role | undefined) ?? DEFAULT_ROLE,
      });
      return { ...session, accessToken };
    },
  },
});
