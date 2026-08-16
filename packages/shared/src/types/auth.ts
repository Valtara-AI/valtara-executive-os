// SEC-001 §3.1 (JWT structure) and §3.2 (RBAC roles). Single source of truth
// consumed by apps/web (issuer, via NextAuth) and apps/api (verifier, via
// the JWT middleware) so the token shape cannot drift between the two.

export type Role = "Executive" | "Delegate" | "Administrator";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
