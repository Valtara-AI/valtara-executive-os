import { AuditLogger, type AuditLogInput } from "./audit-logger.js";

export { AuditLogger } from "./audit-logger.js";
export type { AuditLogInput } from "./audit-logger.js";

const sharedLogger = new AuditLogger();

/** Convenience wrapper for authentication events (login, logout, token refresh). */
export function logAuthEvent(entry: Omit<AuditLogInput, "entityType"> & { entityType?: string }) {
  return sharedLogger.log({ ...entry, entityType: entry.entityType ?? "auth" });
}

/** Convenience wrapper for onboarding actions (session start/respond/complete/confirm). */
export function logOnboardingEvent(
  entry: Omit<AuditLogInput, "entityType"> & { entityType?: string },
) {
  return sharedLogger.log({ ...entry, entityType: entry.entityType ?? "onboarding_session" });
}

/** Convenience wrapper for agent task execution (FR-AW-06: task starts/completions). */
export function logTaskEvent(entry: Omit<AuditLogInput, "entityType"> & { entityType?: string }) {
  return sharedLogger.log({ ...entry, entityType: entry.entityType ?? "task" });
}

/** Convenience wrapper for HITL queue actions (approve/edit/reject - SEC-001 §6). */
export function logHitlEvent(entry: Omit<AuditLogInput, "entityType"> & { entityType?: string }) {
  return sharedLogger.log({ ...entry, entityType: entry.entityType ?? "hitl_queue_item" });
}
