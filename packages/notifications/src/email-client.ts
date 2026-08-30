// The one file in this package permitted to import the `resend` SDK
// directly - same "one adapter file" pattern as packages/billing's
// stripe-client.ts and packages/ai-orchestrator's provider files
// (CLAUDE.md non-negotiable #1's shape, applied here too).

import { Resend } from "resend";

let cachedClient: Resend | undefined;

export function getEmailClient(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set (see .env.example).");
  }
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function getFromAddress(): string {
  return process.env.NOTIFICATIONS_FROM_ADDRESS ?? "NYXOR <notifications@nyxor.example>";
}
