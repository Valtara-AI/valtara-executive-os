import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** RS256 JWT for calling apps/api — see auth.ts's session callback. */
    accessToken?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
