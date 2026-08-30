"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonalDevelopmentRecommendation } from "@nyxor/shared";
import { listRecommendations, updateRecommendationStatus } from "@/lib/personal-development-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const TYPE_LABEL: Record<PersonalDevelopmentRecommendation["type"], string> = {
  book: "Book",
  podcast: "Podcast",
  publication: "Publication",
};

export default function PersonalDevelopmentPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const queryClient = useQueryClient();

  const recommendationsQuery = useQuery({
    queryKey: ["personal-development"],
    queryFn: () => listRecommendations(accessToken!),
    enabled: Boolean(accessToken),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "in_progress" | "completed" | "dismissed";
    }) => updateRecommendationStatus(accessToken!, id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["personal-development"] }),
  });

  const recommendations = recommendationsQuery.data ?? [];
  const active = recommendations.filter(
    (r) => r.status !== "dismissed" && r.status !== "completed",
  );
  const completed = recommendations.filter((r) => r.status === "completed");

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Dashboard
          </Link>
          <h1 className="font-display text-2xl font-semibold">Personal development</h1>
        </div>
        <ThemeToggle />
      </header>

      <Card>
        <p className="text-sm text-muted-foreground">
          AI-curated books, podcasts, and publications refreshed weekly based on your role,
          priorities, and stated interests. Mark items as you work through them.
        </p>
      </Card>

      <Card>
        <h2 className="font-display mb-4 text-lg font-semibold">To explore</h2>
        {recommendationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommendations yet - check back after your first weekly refresh.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {active.map((rec) => (
              <li key={rec.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline">{TYPE_LABEL[rec.type]}</Badge>
                  {rec.status === "in_progress" && <Badge variant="accent">In progress</Badge>}
                </div>
                <p className="font-medium">
                  {rec.title}
                  {rec.creator && <span className="text-muted-foreground"> — {rec.creator}</span>}
                </p>
                <p className="mb-2 text-sm text-muted-foreground">{rec.rationale}</p>
                <div className="flex gap-2">
                  {rec.status !== "in_progress" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate({ id: rec.id, status: "in_progress" })}
                    >
                      Start
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: rec.id, status: "completed" })}
                  >
                    Mark complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: rec.id, status: "dismissed" })}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {completed.length > 0 && (
        <Card>
          <h2 className="font-display mb-4 text-lg font-semibold">Completed</h2>
          <ul className="flex flex-col gap-2">
            {completed.map((rec) => (
              <li key={rec.id} className="text-sm text-muted-foreground">
                {TYPE_LABEL[rec.type]}: {rec.title}
                {rec.creator && ` — ${rec.creator}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
