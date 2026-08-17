import { pgEnum } from "drizzle-orm/pg-core";

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "not_started",
  "in_progress",
  "complete",
]);

export const hitlModeEnum = pgEnum("hitl_mode", [
  "auto_draft_review",
  "checkpoint",
  "autonomous_report",
]);

export const agentStatusEnum = pgEnum("agent_status", ["active", "archived"]);

// "cancelled" added in Sprint 2 (migration 0002): API-001 §2.5's
// DELETE /tasks/:taskId is specified as "cancel," distinct from a task that
// failed on its own - the original enum had no way to represent that
// distinction.
export const taskStatusEnum = pgEnum("task_status", [
  "queued",
  "in_progress",
  "at_checkpoint",
  "complete",
  "failed",
  "cancelled",
]);

export const hitlStatusEnum = pgEnum("hitl_status", ["pending", "approved", "edited", "rejected"]);

export const onboardingSessionStatusEnum = pgEnum("onboarding_session_status", [
  "in_progress",
  "complete",
]);

// Added post-Sprint-2 (migration 0003): models the Executive-Delegate
// relationship SRS describes (PRD §3.2's "Chief of Staff / EA" persona)
// but the original schema never had a way to represent. Full invite +
// accept flow, not auto-linked: "pending" grants no access at all -
// resolve-accessible-executive-ids.ts only counts "accepted".
export const delegateInvitationStatusEnum = pgEnum("delegate_invitation_status", [
  "pending",
  "accepted",
  "declined",
  "revoked",
]);
