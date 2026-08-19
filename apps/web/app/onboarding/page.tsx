"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import {
  completeOnboarding,
  confirmOnboardingWorkforce,
  respondToOnboarding,
  startOnboardingSession,
} from "@/lib/onboarding-api";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const {
    sessionId,
    phase,
    messages,
    proposedAgents,
    selections,
    startInterview,
    addUserAnswer,
    addAgentQuestion,
    beginWorkforceReview,
    updateSelection,
    confirmComplete,
  } = useOnboardingStore();

  const [answer, setAnswer] = React.useState("");
  const startedRef = React.useRef(false);

  const startMutation = useMutation({
    mutationFn: () => startOnboardingSession(accessToken!),
    onSuccess: (data) => startInterview(data.sessionId, data.question),
  });

  React.useEffect(() => {
    if (accessToken && !sessionId && !startedRef.current) {
      startedRef.current = true;
      startMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionId]);

  const completeMutation = useMutation({
    mutationFn: () => completeOnboarding(accessToken!, sessionId!),
    onSuccess: (data) => beginWorkforceReview(data.proposedAgents),
  });

  const respondMutation = useMutation({
    mutationFn: (text: string) => respondToOnboarding(accessToken!, sessionId!, text),
    onSuccess: (data) => {
      if (data.done) {
        completeMutation.mutate();
      } else if (data.question) {
        addAgentQuestion(data.question);
      }
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmOnboardingWorkforce(accessToken!, sessionId!, Object.values(selections)),
    onSuccess: () => {
      confirmComplete();
      router.push("/dashboard");
    },
  });

  function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault();
    const text = answer.trim();
    if (!text || respondMutation.isPending) return;
    addUserAnswer(text);
    respondMutation.mutate(text);
    setAnswer("");
  }

  if (sessionStatus === "loading" || startMutation.isPending) {
    return <CenteredMessage>Starting your onboarding interview…</CenteredMessage>;
  }

  if (startMutation.isError) {
    return (
      <CenteredMessage>
        Couldn&rsquo;t start onboarding. Please refresh to try again.
      </CenteredMessage>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-display text-2xl font-semibold">Let&rsquo;s set up your AI workforce</h1>

      {phase === "interviewing" && (
        <>
          <div className="flex flex-col gap-3">
            {messages.map((message, i) => (
              <ChatBubble key={i} sender={message.role} text={message.text} />
            ))}
            {(respondMutation.isPending || completeMutation.isPending) && (
              <ChatBubble sender="agent" text="…" />
            )}
          </div>

          <form onSubmit={handleSubmitAnswer} className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              disabled={respondMutation.isPending || completeMutation.isPending}
            />
            <Button type="submit" disabled={!answer.trim() || respondMutation.isPending}>
              Send
            </Button>
          </form>
        </>
      )}

      {phase === "reviewing_workforce" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Here&rsquo;s the agent workforce we&rsquo;d propose based on what you told us. Review
            each one, adjust as needed, and confirm which to activate.
          </p>

          {proposedAgents.map((agent) => {
            const selection = selections[agent.proposalId];
            if (!selection) return null;
            return (
              <Card key={agent.proposalId} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Input
                      value={selection.name}
                      onChange={(e) => updateSelection(agent.proposalId, { name: e.target.value })}
                      className="mb-1 h-8 font-medium"
                    />
                    <p className="text-sm text-muted-foreground">{agent.description}</p>
                  </div>
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={selection.active}
                      onChange={(e) =>
                        updateSelection(agent.proposalId, { active: e.target.checked })
                      }
                    />
                    Activate
                  </label>
                </div>

                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {agent.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>

                <label className="flex items-center gap-2 text-sm">
                  HITL mode
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={selection.hitlMode}
                    disabled={!selection.active}
                    onChange={(e) =>
                      updateSelection(agent.proposalId, {
                        hitlMode: e.target.value as typeof selection.hitlMode,
                      })
                    }
                  >
                    <option value="auto_draft_review">Auto-Draft → Review</option>
                    <option value="checkpoint">Checkpoint</option>
                    <option value="autonomous_report">Autonomous + Report</option>
                  </select>
                </label>
              </Card>
            );
          })}

          <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending ? "Activating…" : "Confirm workforce"}
          </Button>
        </div>
      )}
    </main>
  );
}

function ChatBubble({ sender, text }: { sender: "agent" | "user"; text: string }) {
  return (
    <div className={sender === "user" ? "self-end" : "self-start"}>
      <div
        className={
          sender === "user"
            ? "rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            : "rounded-lg bg-muted px-4 py-2 text-foreground"
        }
      >
        {text}
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
      {children}
    </main>
  );
}
