import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Sprint 1 scope is auth + the onboarding conversation engine (CLAUDE.md
// Sprint Plan); routing an already-onboarded executive straight to a
// dashboard is Sprint 3 scope once GET /api/v1/executive/profile exists to
// check onboardingStatus. For now every authenticated visit goes to
// /onboarding, whose own flow (see app/onboarding/page.tsx) is what
// forwards to /welcome once confirm() succeeds.
export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  redirect("/onboarding");
}
