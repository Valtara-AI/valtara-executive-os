import { expect } from "vitest";

// drizzle-orm >=0.39 wraps every failed query in DrizzleQueryError, whose
// own .message is "Failed query: <sql>\nparams: <params>" - the original
// Postgres error (the HITL trigger's rejection message these tests
// actually care about) is preserved on .cause instead
// (drizzle-orm/errors.ts). A plain `.rejects.toThrow(pattern)` only
// checks .message, so it stopped matching once this codebase bumped past
// 0.38 (DL-SEC-005) - this helper unwraps .cause first.
export async function expectDbErrorMessage(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  let caught: Error | undefined;
  try {
    await promise;
  } catch (err) {
    caught = err as Error;
  }
  if (!caught) throw new Error("Expected the promise to reject, but it resolved.");
  const cause = (caught as { cause?: unknown }).cause;
  const message = cause instanceof Error ? cause.message : caught.message;
  expect(message).toMatch(pattern);
}
