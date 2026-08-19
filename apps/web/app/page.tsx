import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getExecutiveProfile } from "@/lib/dashboard-api";
import { LandingPage } from "@/components/marketing/landing-page";

// A Delegate has no executives row of their own (GET /executive/profile is
// Executive-only), so onboarding status only applies to the Executive role
// - a Delegate goes straight to /dashboard, where they'll either see their
// accepted executives' data or a pending-invitations widget to accept one.
export default async function RootPage() {
  const session = await auth();

  // Unauthenticated visitors see the marketing landing page instead of
  // being bounced straight to sign-in - everything below this point
  // (role/profile redirect logic) is unchanged from before this route had
  // any public content.
  if (!session || !session.accessToken) {
    return <LandingPage />;
  }

  const role = session.user?.role;
  if (role !== "Executive") {
    redirect("/dashboard");
  }

  try {
    const { executive } = await getExecutiveProfile(session.accessToken);
    redirect(executive.onboardingStatus === "complete" ? "/dashboard" : "/onboarding");
  } catch {
    // Profile lookup failing (apps/api unreachable, etc.) shouldn't stall
    // the user on a blank page - onboarding is always safe to (re)enter.
    redirect("/onboarding");
  }
}
