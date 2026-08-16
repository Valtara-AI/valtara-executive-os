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
