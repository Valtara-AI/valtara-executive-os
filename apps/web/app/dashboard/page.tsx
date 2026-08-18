"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HitlQueueItem, Task } from "@vex-os/shared";
import {
  approveHitlItem,
  editHitlItem,
  getDashboardSummary,
  getTodaysBrief,
  listAgents,
  listHitlQueue,
  listTasks,
  rejectHitlItem,
} from "@/lib/dashboard-api";
import { acceptInvitation, declineInvitation, listPendingInvitations } from "@/lib/delegate-api";
import {
  disconnectIntegration,
  getAuthorizationUrl,
  listIntegrations,
} from "@/lib/integrations-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google (Gmail + Calendar)",
  microsoft: "Microsoft (Outlook Mail + Calendar + Teams)",
  slack: "Slack",
  pandadoc: "PandaDoc",
};

// useSearchParams (for ?integration=connected|error from the OAuth
// callback redirect) requires a Suspense boundary in the App Router, or
// the whole route fails static/server rendering - the actual content
// lives in DashboardContent below.
export default function DashboardPage() {
  return (
    <React.Suspense fallback={null}>
      <DashboardContent />
    </React.Suspense>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Feedback from routes/integrations.ts's callback redirect
  // (?integration=connected|error). Captured into state once on mount
  // (not read directly from searchParams on every render) so it survives
  // the router.replace() below that strips the query param - otherwise a
  // refresh-triggered re-render would immediately null it back out before
  // the executive has a chance to see it.
  const [integrationFeedback] = React.useState(() => searchParams.get("integration"));
  React.useEffect(() => {
    if (!integrationFeedback) return;
    router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => getDashboardSummary(accessToken!),
    enabled: Boolean(accessToken),
  });

  const briefQuery = useQuery({
    queryKey: ["today-brief"],
    queryFn: () => getTodaysBrief(accessToken!),
    enabled: Boolean(accessToken),
  });

  const hitlQuery = useQuery({
    queryKey: ["hitl-queue"],
    queryFn: () => listHitlQueue(accessToken!, "pending"),
    enabled: Boolean(accessToken),
    // FR-DB-03: "real-time" task status; polling is the simplest honest
    // implementation of that without adding a websocket/SSE layer this
    // sprint. 30s matches SRS FR-DB-03's own stated polling interval.
    refetchInterval: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listTasks(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(accessToken!),
    enabled: Boolean(accessToken),
  });

  // Checked regardless of the current session's role: the many-to-many
  // delegate model means even an Executive could separately have a pending
  // invitation to delegate for someone else.
  const invitationsQuery = useQuery({
    queryKey: ["pending-invitations"],
    queryFn: () => listPendingInvitations(accessToken!),
    enabled: Boolean(accessToken),
  });
  const acceptMutation = useMutation({
    mutationFn: (linkId: string) => acceptInvitation(accessToken!, linkId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-invitations"] }),
  });
  const declineMutation = useMutation({
    mutationFn: (linkId: string) => declineInvitation(accessToken!, linkId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-invitations"] }),
  });

  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: () => listIntegrations(accessToken!),
    enabled: Boolean(accessToken),
  });
  const connectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const { url } = await getAuthorizationUrl(accessToken!, provider);
      // A full top-level navigation, not a fetch: the executive has to
      // actually see and act on Google's consent screen.
      window.location.href = url;
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: (provider: string) => disconnectIntegration(accessToken!, provider),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const agentNameById = React.useMemo(
    () => new Map((agentsQuery.data ?? []).map((a) => [a.id, a.name])),
    [agentsQuery.data],
  );

  function invalidateHitlAndSummary() {
    void queryClient.invalidateQueries({ queryKey: ["hitl-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  }

  const approveMutation = useMutation({
    mutationFn: (itemId: string) => approveHitlItem(accessToken!, itemId),
    onSuccess: invalidateHitlAndSummary,
  });
  const rejectMutation = useMutation({
    mutationFn: (itemId: string) => rejectHitlItem(accessToken!, itemId),
    onSuccess: invalidateHitlAndSummary,
  });
  const editMutation = useMutation({
    mutationFn: ({ itemId, finalOutput }: { itemId: string; finalOutput: string }) =>
      editHitlItem(accessToken!, itemId, finalOutput),
    onSuccess: invalidateHitlAndSummary,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Good morning{session?.user?.name ? `, ${session.user.name}` : ""}.
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      {integrationFeedback === "connected" && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm">
          Integration connected.
        </div>
      )}
      {integrationFeedback === "error" && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm">
          Something went wrong connecting that integration. Please try again.
        </div>
      )}

      {invitationsQuery.data && invitationsQuery.data.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Delegate invitations</h2>
          <div className="flex flex-col gap-2">
            {invitationsQuery.data.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  You&rsquo;ve been invited to review agent outputs on someone&rsquo;s behalf.
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={acceptMutation.isPending || declineMutation.isPending}
                    onClick={() => acceptMutation.mutate(invitation.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acceptMutation.isPending || declineMutation.isPending}
                    onClick={() => declineMutation.mutate(invitation.id)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="HITL queue" value={summaryQuery.data?.hitlQueueCount} />
        <StatTile label="Active tasks" value={summaryQuery.data?.activeTaskCount} />
        <StatTile label="Pending decisions" value={summaryQuery.data?.pendingDecisionCount} />
        <StatTile
          label="Integrations"
          value={integrationsQuery.data?.filter((i) => i.connected).length}
        />
      </section>

      <Card>
        <h2 className="mb-2 text-lg font-medium">Morning brief</h2>
        {briefQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : briefQuery.data ? (
          <p className="whitespace-pre-wrap text-sm">{briefQuery.data.content}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brief yet today. Briefs generate automatically each morning.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">HITL queue</h2>
        {hitlQuery.data && hitlQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
        )}
        <div className="flex flex-col gap-4">
          {hitlQuery.data?.map((item) => (
            <HitlQueueRow
              key={item.id}
              item={item}
              onApprove={() => approveMutation.mutate(item.id)}
              onReject={() => rejectMutation.mutate(item.id)}
              onEdit={(finalOutput) => editMutation.mutate({ itemId: item.id, finalOutput })}
              isPending={
                approveMutation.isPending || rejectMutation.isPending || editMutation.isPending
              }
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Agent task activity</h2>
        {tasksQuery.data && tasksQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {tasksQuery.data?.slice(0, 10).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              agentName={agentNameById.get(task.agentId) ?? "Agent"}
            />
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Integrations</h2>
        <div className="flex flex-col gap-2">
          {integrationsQuery.data?.map((integration) => (
            <div
              key={integration.provider}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>{PROVIDER_LABEL[integration.provider] ?? integration.provider}</span>
              {integration.connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate(integration.provider)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={connectMutation.isPending}
                  onClick={() => connectMutation.mutate(integration.provider)}
                >
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="text-center">
      <div className="text-2xl font-semibold">{value ?? "–"}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function HitlQueueRow({
  item,
  onApprove,
  onReject,
  onEdit,
  isPending,
}: {
  item: HitlQueueItem;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (finalOutput: string) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(item.originalOutput);

  return (
    <div className="rounded-md border border-border p-4">
      {editing ? (
        <textarea
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <p className="text-sm">{item.originalOutput}</p>
      )}

      <div className="mt-3 flex gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={isPending || !draft.trim()}
              onClick={() => {
                onEdit(draft);
                setEditing(false);
              }}
            >
              Save &amp; approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={isPending} onClick={onApprove}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={onReject}>
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

const TASK_STATUS_LABEL: Record<Task["status"], string> = {
  queued: "Queued",
  in_progress: "In progress",
  at_checkpoint: "At checkpoint",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

function TaskRow({ task, agentName }: { task: Task; agentName: string }) {
  return (
    <li className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span>
        <span className="font-medium">{agentName}</span> — {task.prompt.slice(0, 60)}
        {task.prompt.length > 60 ? "…" : ""}
      </span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {TASK_STATUS_LABEL[task.status]}
      </span>
    </li>
  );
}
