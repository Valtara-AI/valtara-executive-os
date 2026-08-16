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

export const taskStatusEnum = pgEnum("task_status", [
  "queued",
  "in_progress",
  "at_checkpoint",
  "complete",
  "failed",
]);

export const hitlStatusEnum = pgEnum("hitl_status", ["pending", "approved", "edited", "rejected"]);

export const onboardingSessionStatusEnum = pgEnum("onboarding_session_status", [
  "in_progress",
  "complete",
]);
