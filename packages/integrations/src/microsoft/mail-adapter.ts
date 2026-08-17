// API-001 §3.3. Read operations (messages.list/get, mailFolders.list) and
// message drafting are unrestricted; sendMail requires an approved HITL
// record (DL-ARCH-005) - same insert-external_actions-row-before-calling-
// the-API pattern as GoogleMailAdapter.sendMessage.

import { getDb, schema } from "@vex-os/database";
import type {
  AuthorizationRequest,
  HitlGatedWriteContext,
  IntegrationAdapter,
  OAuthTokenSet,
} from "../types.js";
import { graphApiFetch } from "./authenticated-fetch.js";
import {
  disconnectMicrosoft,
  getMicrosoftAuthorizationUrlLegacy,
  isMicrosoftConnected,
} from "./microsoft-connection.js";
import { exchangeCodeForTokens } from "./oauth.js";
import { MICROSOFT_PROVIDER } from "./scopes.js";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

export interface OutlookMessageSummary {
  id: string;
  subject?: string;
  bodyPreview?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  isRead?: boolean;
  receivedDateTime?: string;
}

export interface OutlookMailFolder {
  id: string;
  displayName: string;
  unreadItemCount: number;
}

export interface OutlookRecipient {
  name?: string;
  address: string;
}

// Data minimization (API-001 §3.1/§3.3, same policy as Gmail): callers pass
// a search string rather than this adapter ever listing a executive's full
// mailbox - context assembly asks for only what a specific task/brief
// actually needs.
export class OutlookMailAdapter implements IntegrationAdapter {
  getProviderName(): string {
    return MICROSOFT_PROVIDER;
  }

  isConnected(executiveId: string): Promise<boolean> {
    return isMicrosoftConnected(executiveId);
  }

  getAuthorizationUrl(state: string): AuthorizationRequest {
    return getMicrosoftAuthorizationUrlLegacy(state);
  }

  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet> {
    return exchangeCodeForTokens(code, codeVerifier);
  }

  disconnect(executiveId: string): Promise<void> {
    return disconnectMicrosoft(executiveId);
  }

  /** Free-text search against Graph's $search (not Gmail query syntax - e.g. "Q3 board deck", not "is:unread"). */
  async listMessages(
    executiveId: string,
    search: string,
    maxResults = 10,
  ): Promise<OutlookMessageSummary[]> {
    const params = new URLSearchParams({
      $search: `"${search}"`,
      $top: String(maxResults),
    });
    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/me/messages?${params.toString()}`,
      // Graph requires this header when combining $search with other
      // advanced query options on some resources; harmless to send always.
      { headers: { ConsistencyLevel: "eventual" } },
    );
    const body = (await res.json()) as { value?: OutlookMessageSummary[] };
    return body.value ?? [];
  }

  /** MB-02's email digest goes through this - $filter, not $search, since "unread" is a structured property, not free text. */
  async listUnreadMessages(executiveId: string, maxResults = 10): Promise<OutlookMessageSummary[]> {
    const params = new URLSearchParams({
      $filter: "isRead eq false",
      $top: String(maxResults),
      $orderby: "receivedDateTime desc",
    });
    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/me/messages?${params.toString()}`,
    );
    const body = (await res.json()) as { value?: OutlookMessageSummary[] };
    return body.value ?? [];
  }

  async getMessage(executiveId: string, messageId: string): Promise<unknown> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/messages/${messageId}`);
    return res.json();
  }

  async listMailFolders(executiveId: string): Promise<OutlookMailFolder[]> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/mailFolders`);
    const body = (await res.json()) as { value?: OutlookMailFolder[] };
    return body.value ?? [];
  }

  /** Always allowed - a draft is never sent to anyone (API-001 §3.3). */
  async createDraft(
    executiveId: string,
    draft: { subject: string; body: string; toRecipients: OutlookRecipient[] },
  ): Promise<{ id: string }> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toGraphMessage(draft)),
    });
    return (await res.json()) as { id: string };
  }

  /**
   * HITL-gated (DL-ARCH-005). Inserts the external_actions row first - the
   * Postgres trigger rejects it if hitlQueueItemId isn't approved, and the
   * send is never attempted in that case.
   */
  async sendMail(
    executiveId: string,
    context: HitlGatedWriteContext,
    message: { subject: string; body: string; toRecipients: OutlookRecipient[] },
  ): Promise<void> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "send_email",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    // POST /me/sendMail returns 202 with no body on success.
    await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/sendMail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: toGraphMessage(message), saveToSentItems: true }),
    });
  }
}

function toGraphMessage(input: {
  subject: string;
  body: string;
  toRecipients: OutlookRecipient[];
}) {
  return {
    subject: input.subject,
    body: { contentType: "Text", content: input.body },
    toRecipients: input.toRecipients.map((r) => ({
      emailAddress: { address: r.address, name: r.name },
    })),
  };
}
