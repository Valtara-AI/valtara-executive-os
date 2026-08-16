import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

// Deliberately a stub, not a dashboard: the Executive Dashboard (morning
// briefs, HITL queue, task status) is Sprint 3 scope per CLAUDE.md's Sprint
// Plan. This page exists so onboarding has somewhere to land in Sprint 1.
export default async function WelcomePage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <Card className="text-center">
        <h1 className="text-2xl font-semibold">
          You&rsquo;re all set, {session.user?.name ?? "there"}.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your agent workforce has been activated. The full dashboard — morning briefs, the HITL
          queue, and task status — is coming in a later sprint.
        </p>
      </Card>
    </main>
  );
}
