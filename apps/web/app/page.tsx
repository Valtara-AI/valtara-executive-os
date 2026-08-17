import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getExecutiveProfile } from "@/lib/dashboard-api";

// A Delegate has no executives row of their own (GET /executive/profile is
// Executive-only), so onboarding status only applies to the Executive role
// - a Delegate goes straight to /dashboard, where they'll either see their
// accepted executives' data or a pending-invitations widget to accept one.
export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }
  if (!session.accessToken) {
    redirect("/api/auth/signin");
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
