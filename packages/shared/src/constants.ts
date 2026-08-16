import type {
  AgentStatus,
  HitlMode,
  HitlStatus,
  OnboardingStatus,
  TaskStatus,
} from "./types/entities";
import type { Role } from "./types/auth";

export const ROLES: readonly Role[] = ["Executive", "Delegate", "Administrator"];

export const HITL_MODES: readonly HitlMode[] = [
  "auto_draft_review",
  "checkpoint",
  "autonomous_report",
];

export const HITL_STATUSES: readonly HitlStatus[] = ["pending", "approved", "edited", "rejected"];

export const AGENT_STATUSES: readonly AgentStatus[] = ["active", "archived"];

export const TASK_STATUSES: readonly TaskStatus[] = [
  "queued",
  "in_progress",
  "at_checkpoint",
  "complete",
  "failed",
];

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "not_started",
  "in_progress",
  "complete",
];

// SRS FR-OA-03: minimum 2, maximum 8 agents proposed per executive at onboarding.
export const MIN_ONBOARDING_AGENTS = 2;
export const MAX_ONBOARDING_AGENTS = 8;

// SRS OA-SYS-01: minimum 12 discovery questions.
export const MIN_ONBOARDING_QUESTIONS = 12;

// SRS §3.3 / SAD §4.3: response validation retry policy.
export const MAX_LLM_RESPONSE_RETRIES = 3;
