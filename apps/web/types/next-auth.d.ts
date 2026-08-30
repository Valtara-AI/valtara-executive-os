import type { DefaultSession } from "next-auth";
import type { Role } from "@nyxor/shared";

declare module "next-auth" {
  interface Session {
    /** RS256 JWT for calling apps/api — see auth.ts's session callback. */
    accessToken?: string;
    user?: DefaultSession["user"] & { role?: Role };
  }
}

// The real JWT interface lives in @auth/core/jwt - next-auth/jwt only
// re-exports it (`export * from "@auth/core/jwt"`), which doesn't count as
// the same declaration site for TS's module-augmentation merging. Without
// this, `token.role` silently resolves to `unknown` rather than `Role`.
declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
  }
}
