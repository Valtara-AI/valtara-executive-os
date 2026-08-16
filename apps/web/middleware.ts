import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Route protection is enforced here (server-side, via NextAuth's session)
// as well as independently by apps/api's JWT middleware on every API call -
// this middleware exists for UX (redirect to sign-in) rather than as the
// security boundary itself; SEC-001 §3.2's boundary is apps/api's RBAC.
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/onboarding/:path*", "/welcome/:path*"],
};
