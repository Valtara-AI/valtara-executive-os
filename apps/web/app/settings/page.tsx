"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_TOPICS_OF_INTEREST } from "@nyxor/shared";
import {
  getExecutiveProfile,
  updateTopicsOfInterest,
  listWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
} from "@/lib/dashboard-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

// Phase A of the Portfolio/News/Personal-Development plan: the only editor
// here today is "Interests" (topicsOfInterest), since it's the one profile
// field expected to drift after onboarding (see intelligence-profile.ts's
// schema comment). The watchlist editor (Phase B) belongs on this same
// page once built - both are "things that feed the morning brief," not
// separate settings concerns.
export default function SettingsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["executive-profile"],
    queryFn: () => getExecutiveProfile(accessToken!),
    enabled: Boolean(accessToken),
  });

  const [draftTopic, setDraftTopic] = React.useState("");
  // No state-from-query-via-effect: local edits (add/remove below) are the
  // only writer of this; it falls back to server data until the executive
  // touches it, then stays local until a successful save invalidates the
  // query and this reverts to `undefined` (server-driven) again.
  const [localTopics, setLocalTopics] = React.useState<string[] | undefined>(undefined);

  const saveMutation = useMutation({
    mutationFn: (next: string[]) => updateTopicsOfInterest(accessToken!, next),
    onSuccess: () => {
      setLocalTopics(undefined);
      void queryClient.invalidateQueries({ queryKey: ["executive-profile"] });
    },
  });

  const effectiveTopics =
    localTopics ?? profileQuery.data?.intelligenceProfile?.topicsOfInterest ?? [];

  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => listWatchlist(accessToken!),
    enabled: Boolean(accessToken),
  });
  const [draftTicker, setDraftTicker] = React.useState("");
  const MAX_WATCHLIST_ITEMS = 20;

  const addTickerMutation = useMutation({
    mutationFn: (ticker: string) => addWatchlistItem(accessToken!, ticker),
    onSuccess: () => {
      setDraftTicker("");
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  const removeTickerMutation = useMutation({
    mutationFn: (itemId: string) => removeWatchlistItem(accessToken!, itemId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  function addTopic() {
    const value = draftTopic.trim();
    if (!value || effectiveTopics.includes(value)) return;
    if (effectiveTopics.length >= MAX_TOPICS_OF_INTEREST) return;
    setLocalTopics([...effectiveTopics, value]);
    setDraftTopic("");
  }

  function removeTopic(topic: string) {
    setLocalTopics(effectiveTopics.filter((t) => t !== topic));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Dashboard
          </Link>
          <h1 className="font-display text-2xl font-semibold">Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      <Card>
        <h2 className="font-display mb-2 text-lg font-semibold">Interests</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Industries, companies, or topics your morning brief should keep you on top of in the news.
          Up to {MAX_TOPICS_OF_INTEREST}.
        </p>

        {profileQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {effectiveTopics.length === 0 && (
                <p className="text-sm text-muted-foreground">No topics added yet.</p>
              )}
              {effectiveTopics.map((topic) => (
                <Badge key={topic} variant="outline" className="gap-1">
                  {topic}
                  <button
                    type="button"
                    aria-label={`Remove ${topic}`}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => removeTopic(topic)}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. semiconductor industry, Tesla, AI regulation"
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                disabled={effectiveTopics.length >= MAX_TOPICS_OF_INTEREST}
              />
              <Button
                variant="outline"
                onClick={addTopic}
                disabled={!draftTopic.trim() || effectiveTopics.length >= MAX_TOPICS_OF_INTEREST}
              >
                Add
              </Button>
            </div>

            <Button
              className="mt-4"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(effectiveTopics)}
            >
              {saveMutation.isPending ? "Saving…" : "Save interests"}
            </Button>
            {saveMutation.isSuccess && <p className="mt-2 text-sm text-muted-foreground">Saved.</p>}
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-display mb-2 text-lg font-semibold">Portfolio watchlist</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Tickers your morning brief should include a price summary for. Up to {MAX_WATCHLIST_ITEMS}
          . This is a watchlist, not a brokerage sync - no positions or cost basis, just symbols to
          track.
        </p>

        {watchlistQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {(watchlistQuery.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No tickers added yet.</p>
              )}
              {watchlistQuery.data?.map((item) => (
                <Badge key={item.id} variant="outline" className="gap-1">
                  {item.ticker}
                  <button
                    type="button"
                    aria-label={`Remove ${item.ticker}`}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => removeTickerMutation.mutate(item.id)}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. AAPL"
                value={draftTicker}
                onChange={(e) => setDraftTicker(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (draftTicker.trim()) addTickerMutation.mutate(draftTicker.trim());
                  }
                }}
                disabled={(watchlistQuery.data?.length ?? 0) >= MAX_WATCHLIST_ITEMS}
              />
              <Button
                variant="outline"
                onClick={() => addTickerMutation.mutate(draftTicker.trim())}
                disabled={
                  !draftTicker.trim() ||
                  addTickerMutation.isPending ||
                  (watchlistQuery.data?.length ?? 0) >= MAX_WATCHLIST_ITEMS
                }
              >
                Add
              </Button>
            </div>
            {addTickerMutation.isError && (
              <p className="mt-2 text-sm text-muted-foreground">
                Couldn&rsquo;t add that ticker - it may already be on your list.
              </p>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
