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

// SEC-001 §3.2 default for a genuinely new user with no Executive row and
// no delegate invitation anywhere - see resolveRoleForNewSignIn below for
// the real precedence logic (added post-Sprint-2 alongside the
// Executive-Delegate relationship; every earlier sign-up hardcoded this
// value, meaning nothing could ever actually become a Delegate).
const DEFAULT_ROLE: Role = "Executive";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour, matching SEC-001 §3.1

// apps/web has no direct DB access by design (SAD's layer diagram: all
// persistence goes through apps/api) - so role resolution at sign-in,
// which needs to check for an existing Executive row or a pending/accepted
// delegate_links row, is a server-to-server call rather than a query here.
// Guarded by INTERNAL_API_SECRET (a shared secret, not a user JWT - this
// runs server-side inside the NextAuth callback, never reachable from a
// browser). On any failure, falls back to DEFAULT_ROLE rather than blocking
// sign-in: worst case a real Delegate's first sign-in mints an Executive
// token, which grants them nothing beyond their own isolated (auto-created)
// executive profile - not a privilege escalation, just a UX miss they can
// resolve by signing in again once apps/api is reachable.
async function resolveRoleForNewSignIn(email: string): Promise<Role> {
  const apiUrl = process.env.API_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!apiUrl || !internalSecret) {
    console.error(
      "API_URL or INTERNAL_API_SECRET not set; defaulting new sign-in to",
      DEFAULT_ROLE,
    );
    return DEFAULT_ROLE;
  }

  try {
    const res = await fetch(
      `${apiUrl}/api/v1/internal/resolve-role?email=${encodeURIComponent(email)}`,
      { headers: { "X-Internal-Secret": internalSecret } },
    );
    if (!res.ok) throw new Error(`resolve-role responded ${res.status}`);
    const body = (await res.json()) as { data: { role: Role } | null };
    return body.data?.role ?? DEFAULT_ROLE;
  } catch (err) {
    console.error("Failed to resolve role for new sign-in, defaulting to", DEFAULT_ROLE, err);
    return DEFAULT_ROLE;
  }
}

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
        // First sign-in this session. NextAuth's own `token.sub` is
        // already the stable provider-qualified user id; `user.email`
        // (populated from the OAuth profile) is what role resolution keys
        // on, matching how apps/api's resolveExecutive/resolveAccessibleExecutiveIds
        // key everything else on email too.
        token.role = user.email ? await resolveRoleForNewSignIn(user.email) : DEFAULT_ROLE;
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
