// API-001 §3.1. Read operations (threads.list/get, messages.get,
// labels.list) and drafts.create are unrestricted; messages.send requires
// an approved HITL record (DL-ARCH-005) - enforced by inserting the
// external_actions row *before* calling Gmail, so a rejected/pending HITL
// item (caught by the Postgres trigger on that insert) means the send
// never happens at all, not that it happens and gets logged after the
// fact.

import { getDb, schema } from "@vex-os/database";
import type {
  AuthorizationRequest,
  HitlGatedWriteContext,
  IntegrationAdapter,
  OAuthTokenSet,
} from "../types.js";
import { googleApiFetch } from "./authenticated-fetch.js";
import {
  disconnectGoogle,
  getGoogleAuthorizationUrlLegacy,
  isGoogleConnected,
} from "./google-connection.js";
import { exchangeCodeForTokens } from "./oauth.js";
import { GOOGLE_PROVIDER } from "./scopes.js";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailThreadSummary {
  id: string;
  snippet: string;
  historyId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

// Data minimization (API-001 §3.1): callers pass a Gmail search query
// (e.g. "is:unread newer_than:1d") rather than this adapter ever listing
// or downloading a executive's full mail history - context assembly
// (execute-task.ts, generate-brief.ts) is expected to ask for only what a
// specific task/brief actually needs.
export class GoogleMailAdapter implements IntegrationAdapter {
  getProviderName(): string {
    return GOOGLE_PROVIDER;
  }

  isConnected(executiveId: string): Promise<boolean> {
    return isGoogleConnected(executiveId);
  }

  getAuthorizationUrl(state: string): AuthorizationRequest {
    return getGoogleAuthorizationUrlLegacy(state);
  }

  // Pure exchange only - matches IntegrationAdapter's contract (no
  // executiveId param, so no persistence here). The route handler uses
  // google-connection.ts's completeGoogleConnection() instead, which
  // exchanges *and* persists in one call; this method exists so the
  // adapter still fully implements the interface for callers that only
  // need the exchange step.
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet> {
    return exchangeCodeForTokens(code, codeVerifier);
  }

  disconnect(executiveId: string): Promise<void> {
    return disconnectGoogle(executiveId);
  }

  async listThreads(
    executiveId: string,
    query: string,
    maxResults = 10,
  ): Promise<GmailThreadSummary[]> {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/threads?${params.toString()}`);
    const body = (await res.json()) as { threads?: GmailThreadSummary[] };
    return body.threads ?? [];
  }

  async getThread(executiveId: string, threadId: string): Promise<unknown> {
    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/threads/${threadId}`);
    return res.json();
  }

  async getMessage(executiveId: string, messageId: string): Promise<unknown> {
    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/messages/${messageId}`);
    return res.json();
  }

  async listLabels(executiveId: string): Promise<GmailLabel[]> {
    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/labels`);
    const body = (await res.json()) as { labels?: GmailLabel[] };
    return body.labels ?? [];
  }

  /** Always allowed - a draft is never sent to anyone (API-001 §3.1). */
  async createDraft(executiveId: string, rawRfc2822Base64Url: string): Promise<{ id: string }> {
    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw: rawRfc2822Base64Url } }),
    });
    return (await res.json()) as { id: string };
  }

  /**
   * HITL-gated (DL-ARCH-005). Inserts the external_actions row first - the
   * Postgres trigger rejects it if hitlQueueItemId isn't approved, and the
   * send is never attempted in that case.
   */
  async sendMessage(
    executiveId: string,
    context: HitlGatedWriteContext,
    rawRfc2822Base64Url: string,
  ): Promise<{ id: string }> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "send_email",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await googleApiFetch(executiveId, `${GMAIL_API_BASE}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawRfc2822Base64Url }),
    });
    return (await res.json()) as { id: string };
  }
}
