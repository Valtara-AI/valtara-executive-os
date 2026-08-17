import type {
  Agent,
  HitlMode,
  HitlQueueItem,
  HitlStatus,
  MorningBrief,
  Task,
} from "@vex-os/shared";
import { apiFetch } from "./api-client";

export interface DashboardSummary {
  hitlQueueCount: number;
  activeTaskCount: number;
  pendingDecisionCount: number;
  integrations: unknown[];
}

export interface ExecutiveProfile {
  executive: {
    id: string;
    name: string;
    email: string;
    onboardingStatus: "not_started" | "in_progress" | "complete";
  };
  intelligenceProfile: {
    timeDrains: string[];
    delegationCandidates: string[];
    tools: string[];
  } | null;
  voiceProfile: { tone: string | null } | null;
  agentWorkforceSummary: { total: number; active: number };
}

export function getDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  return apiFetch("/api/v1/dashboard/summary", accessToken);
}

export function getExecutiveProfile(accessToken: string): Promise<ExecutiveProfile> {
  return apiFetch("/api/v1/executive/profile", accessToken);
}

export function getTodaysBrief(accessToken: string): Promise<MorningBrief | null> {
  return apiFetch("/api/v1/briefs/today", accessToken);
}

export function listTasks(accessToken: string): Promise<Task[]> {
  return apiFetch("/api/v1/tasks", accessToken);
}

export function listAgents(accessToken: string): Promise<Agent[]> {
  return apiFetch("/api/v1/agents", accessToken);
}

export function listHitlQueue(
  accessToken: string,
  status: HitlStatus | "all" = "pending",
): Promise<HitlQueueItem[]> {
  return apiFetch(`/api/v1/hitl/queue?status=${status}`, accessToken);
}

export function approveHitlItem(accessToken: string, itemId: string): Promise<HitlQueueItem> {
  return apiFetch(`/api/v1/hitl/queue/${itemId}/approve`, accessToken, { method: "POST" });
}

export function editHitlItem(
  accessToken: string,
  itemId: string,
  finalOutput: string,
): Promise<HitlQueueItem> {
  return apiFetch(`/api/v1/hitl/queue/${itemId}/edit`, accessToken, {
    method: "POST",
    body: JSON.stringify({ finalOutput }),
  });
}

export function rejectHitlItem(
  accessToken: string,
  itemId: string,
  reason?: string,
): Promise<HitlQueueItem> {
  return apiFetch(`/api/v1/hitl/queue/${itemId}/reject`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function assignTask(accessToken: string, agentId: string, prompt: string): Promise<Task> {
  return apiFetch(`/api/v1/agents/${agentId}/tasks`, accessToken, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export type { HitlMode };
