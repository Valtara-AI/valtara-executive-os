"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, HitlMode, HitlQueueItem, Task } from "@nyxor/shared";
import { HITL_MODES } from "@nyxor/shared";
import {
  approveHitlItem,
  archiveAgent,
  assignTask,
  cancelTask,
  editHitlItem,
  getDashboardSummary,
  getTask,
  getTodaysBrief,
  listAgents,
  listHitlQueue,
  listTasks,
  rejectHitlItem,
  updateAgent,
} from "@/lib/dashboard-api";
import { acceptInvitation, declineInvitation, listPendingInvitations } from "@/lib/delegate-api";
import {
  disconnectIntegration,
  getAuthorizationUrl,
  listIntegrations,
} from "@/lib/integrations-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

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
  const role = session?.user?.role;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Every query below (dashboard/summary, briefs, hitl, tasks) requires
  // Executive or Delegate (SEC-001 §3.2) - an Administrator gets a 403 from
  // all of them, since their only real capability is the audit export at
  // /admin. Redirect there instead of rendering a dashboard that would
  // fail every request.
  React.useEffect(() => {
    if (role === "Administrator") router.replace("/admin");
  }, [role, router]);

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

  // "all" then filtered client-side to non-pending, rather than a second
  // status value on the API - the pending item and its resolved outcome
  // both come from the same underlying list, and hitl.ts's GET / already
  // sorts by actionedAt desc, which is exactly the order history wants.
  const hitlHistoryQuery = useQuery({
    queryKey: ["hitl-history"],
    queryFn: () => listHitlQueue(accessToken!, "all"),
    enabled: Boolean(accessToken),
  });
  const hitlHistory = (hitlHistoryQuery.data ?? [])
    .filter((item) => item.status !== "pending")
    .slice(0, 10);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listTasks(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  // Executive-only (SEC-001 §3.2) - a Delegate's identical request 403s, so
  // this is disabled rather than fired-and-ignored for that role.
  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(accessToken!),
    enabled: Boolean(accessToken) && role === "Executive",
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

  // Executive-only (SEC-001 §3.2), same reasoning as agentsQuery above.
  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: () => listIntegrations(accessToken!),
    enabled: Boolean(accessToken) && role === "Executive",
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
    void queryClient.invalidateQueries({ queryKey: ["hitl-history"] });
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

  const updateAgentMutation = useMutation({
    mutationFn: ({
      agentId,
      patch,
    }: {
      agentId: string;
      patch: Parameters<typeof updateAgent>[2];
    }) => updateAgent(accessToken!, agentId, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
  const archiveAgentMutation = useMutation({
    mutationFn: (agentId: string) => archiveAgent(accessToken!, agentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
  const assignTaskMutation = useMutation({
    mutationFn: ({ agentId, prompt }: { agentId: string; prompt: string }) =>
      assignTask(accessToken!, agentId, prompt),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const cancelTaskMutation = useMutation({
    mutationFn: (taskId: string) => cancelTask(accessToken!, taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">
          Good morning{session?.user?.name ? `, ${session.user.name}` : ""}.
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/articulation-training">Articulation training</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/personal-development">Personal development</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
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
          <h2 className="font-display mb-3 text-lg font-semibold">Delegate invitations</h2>
          <div className="flex flex-col gap-2">
            {invitationsQuery.data.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40"
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
        <StatTile
          label="HITL queue"
          value={summaryQuery.data?.hitlQueueCount}
          needsAttention={Boolean(summaryQuery.data?.hitlQueueCount)}
        />
        <StatTile label="Active tasks" value={summaryQuery.data?.activeTaskCount} />
        <StatTile label="Pending decisions" value={summaryQuery.data?.pendingDecisionCount} />
        <StatTile
          label="Integrations"
          value={integrationsQuery.data?.filter((i) => i.connected).length}
        />
      </section>

      <Card>
        <h2 className="font-display mb-2 text-lg font-semibold">Morning brief</h2>
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
        <h2 className="font-display mb-4 text-lg font-semibold">HITL queue</h2>
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
        <h2 className="font-display mb-4 text-lg font-semibold">History</h2>
        {hitlHistory.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing resolved yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {hitlHistory.map((item) => (
            <HitlHistoryRow key={item.id} item={item} />
          ))}
        </ul>
      </Card>

      {/* Agents/Integrations are Executive-only (SEC-001 §3.2) - a
          Delegate's identical API calls 403, so these sections are hidden
          rather than rendered broken. */}
      {role === "Executive" && (
        <Card>
          <h2 className="font-display mb-4 text-lg font-semibold">Agents</h2>
          {agentsQuery.data && agentsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No agents yet - they&apos;re created during onboarding.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {agentsQuery.data?.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                onSave={(patch) => updateAgentMutation.mutate({ agentId: agent.id, patch })}
                onArchive={() => archiveAgentMutation.mutate(agent.id)}
                onAssignTask={(prompt) => assignTaskMutation.mutate({ agentId: agent.id, prompt })}
                isSaving={updateAgentMutation.isPending}
                isArchiving={archiveAgentMutation.isPending}
                isAssigning={assignTaskMutation.isPending}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-display mb-4 text-lg font-semibold">Agent task activity</h2>
        {tasksQuery.data && tasksQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {tasksQuery.data?.slice(0, 10).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              agentName={agentNameById.get(task.agentId) ?? "Agent"}
              accessToken={accessToken}
              canCancel={role === "Executive"}
              onCancel={() => cancelTaskMutation.mutate(task.id)}
              isCancelling={cancelTaskMutation.isPending}
            />
          ))}
        </ul>
      </Card>

      {role === "Executive" && (
        <Card>
          <h2 className="font-display mb-4 text-lg font-semibold">Integrations</h2>
          <div className="flex flex-col gap-2">
            {integrationsQuery.data?.map((integration) => (
              <div
                key={integration.provider}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40"
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
      )}
    </main>
  );
}

function StatTile({
  label,
  value,
  needsAttention,
}: {
  label: string;
  value: number | undefined;
  /** Executive Pulse-style signal (Branding/06-executive-command-center.md): a non-zero count here is something the executive should notice, not just a number. */
  needsAttention?: boolean;
}) {
  return (
    <Card className="text-center">
      <div
        className={cn(
          "font-display text-2xl font-bold",
          needsAttention ? "text-accent" : "text-foreground",
        )}
      >
        {value ?? "–"}
      </div>
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

const HITL_HISTORY_STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  edited: "Edited & approved",
  rejected: "Rejected",
};

function HitlHistoryRow({ item }: { item: HitlQueueItem }) {
  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <Badge variant={item.status === "rejected" ? "outline" : "accent"}>
          {HITL_HISTORY_STATUS_LABEL[item.status] ?? item.status}
        </Badge>
        {item.actionedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(item.actionedAt).toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        {item.status === "rejected"
          ? (item.rejectionReason ?? item.originalOutput)
          : (item.finalOutput ?? item.originalOutput)}
      </p>
    </li>
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

const CANCELLABLE_TASK_STATUSES: Task["status"][] = ["queued", "in_progress"];

function TaskRow({
  task,
  agentName,
  accessToken,
  canCancel,
  onCancel,
  isCancelling,
}: {
  task: Task;
  agentName: string;
  accessToken: string | undefined;
  canCancel: boolean;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ["task-detail", task.id],
    queryFn: () => getTask(accessToken!, task.id),
    enabled: expanded && Boolean(accessToken),
  });

  return (
    <li className="rounded-md border border-border text-sm transition-colors hover:border-primary/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>
          <span className="font-medium">{agentName}</span> — {task.prompt.slice(0, 60)}
          {task.prompt.length > 60 ? "…" : ""}
        </span>
        <Badge
          variant={task.status === "complete" ? "accent" : "outline"}
          className="whitespace-nowrap"
        >
          {TASK_STATUS_LABEL[task.status]}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-sm">{task.prompt}</p>
          {detailQuery.isLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading output…</p>
          ) : detailQuery.data?.output ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {detailQuery.data.output.outputText}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No output yet.</p>
          )}
          {canCancel && CANCELLABLE_TASK_STATUSES.includes(task.status) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={isCancelling}
              onClick={onCancel}
            >
              Cancel task
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

const HITL_MODE_LABEL: Record<HitlMode, string> = {
  auto_draft_review: "Auto-draft, review before send",
  checkpoint: "Pause at checkpoints",
  autonomous_report: "Autonomous, report after",
};

function AgentRow({
  agent,
  onSave,
  onArchive,
  onAssignTask,
  isSaving,
  isArchiving,
  isAssigning,
}: {
  agent: Agent;
  onSave: (patch: {
    description?: string;
    responsibilities?: string[];
    hitlMode?: HitlMode;
  }) => void;
  onArchive: () => void;
  onAssignTask: (prompt: string) => void;
  isSaving: boolean;
  isArchiving: boolean;
  isAssigning: boolean;
}) {
  const [managing, setManaging] = React.useState(false);
  const [description, setDescription] = React.useState(agent.description);
  const [responsibilities, setResponsibilities] = React.useState(agent.responsibilities.join("\n"));
  const [hitlMode, setHitlMode] = React.useState<HitlMode>(agent.hitlMode);
  const [taskPrompt, setTaskPrompt] = React.useState("");

  return (
    <div className="rounded-md border border-border p-3 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.name}</span>
          <Badge variant="outline">{HITL_MODE_LABEL[agent.hitlMode]}</Badge>
          {agent.status === "archived" && <Badge variant="outline">Archived</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setManaging((v) => !v)}>
          {managing ? "Close" : "Manage"}
        </Button>
      </div>
      {!managing && <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>}

      {managing && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Description
            <textarea
              className="rounded-md border border-border bg-background p-2 text-sm text-foreground"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Responsibilities (one per line)
            <textarea
              className="rounded-md border border-border bg-background p-2 text-sm text-foreground"
              rows={3}
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            HITL mode
            <select
              className="rounded-md border border-border bg-background p-2 text-sm text-foreground"
              value={hitlMode}
              onChange={(e) => setHitlMode(e.target.value as HitlMode)}
            >
              {HITL_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {HITL_MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() =>
                onSave({
                  description,
                  responsibilities: responsibilities
                    .split("\n")
                    .map((r) => r.trim())
                    .filter(Boolean),
                  hitlMode,
                })
              }
            >
              Save
            </Button>
            {agent.status === "active" && (
              <Button size="sm" variant="outline" disabled={isArchiving} onClick={onArchive}>
                Archive agent
              </Button>
            )}
          </div>

          {agent.status === "active" && (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Assign a task
                <textarea
                  className="rounded-md border border-border bg-background p-2 text-sm text-foreground"
                  rows={2}
                  placeholder="e.g. Draft a reply to the LP update request…"
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                />
              </label>
              <Button
                size="sm"
                className="self-start"
                disabled={isAssigning || !taskPrompt.trim()}
                onClick={() => {
                  onAssignTask(taskPrompt);
                  setTaskPrompt("");
                }}
              >
                Assign
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
