// Core data entity types. Field lists are authoritative from VEX-OS-SRS-001
// §5.1 and CLAUDE.md "Key Data Entities". Keep in sync with the Drizzle
// schema in packages/database/src/schema/*.ts — that package is the source
// of truth for column types/constraints; these are the shapes consumed by
// application code in apps/web and apps/api.

export type OnboardingStatus = "not_started" | "in_progress" | "complete";
export type HitlMode = "auto_draft_review" | "checkpoint" | "autonomous_report";
export type AgentStatus = "active" | "archived";
export type TaskStatus =
  "queued" | "in_progress" | "at_checkpoint" | "complete" | "failed" | "cancelled";
export type HitlStatus = "pending" | "approved" | "edited" | "rejected";

export interface Executive {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  title: string | null;
  domain: string | null;
  createdAt: string;
  onboardingStatus: OnboardingStatus;
  voiceProfileId: string | null;
  preferences: Record<string, unknown>;
}

export interface ExecutiveIntelligenceProfile {
  id: string;
  executiveId: string;
  version: number;
  timeDrains: string[];
  delegationCandidates: string[];
  communicationStyle: string | null;
  tools: string[];
  createdAt: string;
}

export interface VoiceProfile {
  id: string;
  executiveId: string;
  version: number;
  tone: string | null;
  formality: string | null;
  sentenceLength: string | null;
  vocabularyLevel: string | null;
  salutations: string[];
  structuralPreferences: Record<string, unknown>;
  createdAt: string;
}

export interface Agent {
  id: string;
  executiveId: string;
  name: string;
  description: string;
  responsibilities: string[];
  hitlMode: HitlMode;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  agentId: string;
  executiveId: string;
  prompt: string;
  status: TaskStatus;
  contextSnapshot: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
  retryCount: number;
}

export interface TaskOutput {
  id: string;
  taskId: string;
  modelProvider: string;
  modelId: string;
  promptVersion: string;
  outputText: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  hitlStatus: HitlStatus;
  createdAt: string;
}

export interface HitlQueueItem {
  id: string;
  taskOutputId: string | null;
  executiveId: string;
  status: HitlStatus;
  originalOutput: string;
  finalOutput: string | null;
  rejectionReason: string | null;
  actionedAt: string | null;
  actionedBy: string | null;
}

// Field set follows VEX-OS-SAD-001 §4.6 (audit-layer spec), which is more
// detailed than the SRS §5.1 entity summary and is treated as authoritative
// for implementation: hash-referenced input/output rather than raw
// snapshots, plus chain-integrity fields (SEC-001 §6). SRS's ip_address
// field is folded into `metadata`.
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  inputHash: string | null;
  outputHash: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  recordHash: string;
}

export interface MorningBrief {
  id: string;
  executiveId: string;
  date: string;
  content: string;
  sectionsJson: Record<string, unknown>;
  generatedAt: string;
  readAt: string | null;
}

export interface IntegrationToken {
  id: string;
  executiveId: string;
  provider: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  scopes: string[];
  expiresAt: string | null;
}

// Not in the SRS §5.1 list; added to make Sprint 1 requirements concrete
// (see the Sprint 1 plan's "Area 3" notes).

export type OnboardingSessionStatus = "in_progress" | "complete";

export interface OnboardingSession {
  id: string;
  executiveId: string | null;
  state: Record<string, unknown>;
  currentQuestionIndex: number;
  status: OnboardingSessionStatus;
  createdAt: string;
  updatedAt: string;
}

// Concrete DB-level expression of DL-ARCH-005: a row here can only exist
// with a hitl_queue_item_id pointing at an *approved* HITL record — enforced
// by a Postgres trigger, not just the NOT NULL foreign key.
export interface ExternalAction {
  id: string;
  actionType: string;
  agentId: string;
  hitlQueueItemId: string;
  executedAt: string;
}

export interface RefreshTokenRevocation {
  tokenId: string;
  revokedAt: string;
}
