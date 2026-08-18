// Board/investor document tooling (DL-ARCH-009) - prioritized as the
// PandaDoc/DocSend category after DocSend itself was rejected for
// unverifiable API schema (see DL-ARCH-009's Options Considered). Every
// endpoint below is confirmed against developers.pandadoc.com's own
// reference pages, the same rigor used for Teams.
//
// Document creation (from a template) does NOT notify recipients - a
// created document starts in "document.uploaded", transitions to
// "document.draft" once PandaDoc finishes processing it, and recipients
// are only actually notified when POST .../send is called. That's the
// same create-draft/send split as Gmail's createDraft/sendMessage, not
// Calendar's createEvent (which notifies immediately as a side effect of
// creation) - so createDocumentFromTemplate is unrestricted and only
// sendDocument requires an approved HITL record (DL-ARCH-005), same
// insert-external_actions-row-before-calling-the-API pattern as every
// other adapter's send method.
//
// Known gap (see DL-ARCH-009's Consequences): PandaDoc's public REST API
// does not expose recipient view/engagement analytics via GET - neither
// /documents/{id} (status) nor /documents/{id}/details includes it. That
// data is only available via webhooks (document_viewed,
// document_state_changed), which is a genuinely new architectural pattern
// (inbound receiver) not built here - deliberately scoped out to a
// follow-on phase rather than bolted on now.

import { getDb, schema } from "@vex-os/database";
import type {
  AuthorizationRequest,
  HitlGatedWriteContext,
  IntegrationAdapter,
  OAuthTokenSet,
} from "../types.js";
import { pandaDocApiFetch } from "./authenticated-fetch.js";
import {
  disconnectPandaDoc,
  getPandaDocAuthorizationUrlLegacy,
  isPandaDocConnected,
} from "./pandadoc-connection.js";
import { exchangeCodeForTokens } from "./oauth.js";
import { PANDADOC_PROVIDER } from "./scopes.js";

const API_BASE = "https://api.pandadoc.com/public/v1";

export interface PandaDocDocumentSummary {
  id: string;
  name: string;
  status: string;
  date_created?: string;
  date_modified?: string;
}

export interface PandaDocRecipient {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export interface PandaDocDocumentDetails extends PandaDocDocumentSummary {
  recipients?: PandaDocRecipient[];
  tags?: string[];
}

export class PandaDocAdapter implements IntegrationAdapter {
  getProviderName(): string {
    return PANDADOC_PROVIDER;
  }

  isConnected(executiveId: string): Promise<boolean> {
    return isPandaDocConnected(executiveId);
  }

  getAuthorizationUrl(state: string): AuthorizationRequest {
    return getPandaDocAuthorizationUrlLegacy(state);
  }

  // codeVerifier is part of IntegrationAdapter's shared contract (PKCE, for
  // Google/Microsoft) but PandaDoc's OAuth doesn't use it - see oauth.ts's
  // header. Accepted and ignored, same as SlackAdapter.
  exchangeCodeForTokens(code: string, _codeVerifier: string): Promise<OAuthTokenSet> {
    return exchangeCodeForTokens(code);
  }

  disconnect(executiveId: string): Promise<void> {
    return disconnectPandaDoc(executiveId);
  }

  /** GET /documents - data-minimized: caller-supplied filters, no bulk export. */
  async listDocuments(
    executiveId: string,
    params: { query?: string; status?: string; tag?: string; count?: number } = {},
  ): Promise<PandaDocDocumentSummary[]> {
    const search = new URLSearchParams();
    if (params.query) search.set("q", params.query);
    if (params.status) search.set("status", params.status);
    if (params.tag) search.set("tag", params.tag);
    search.set("count", String(params.count ?? 20));

    const res = await pandaDocApiFetch(executiveId, `${API_BASE}/documents?${search.toString()}`);
    const body = (await res.json()) as { results?: PandaDocDocumentSummary[] };
    return body.results ?? [];
  }

  /** GET /documents/{id} - lightweight status/basic-info check, no analytics. */
  async getDocumentStatus(
    executiveId: string,
    documentId: string,
  ): Promise<PandaDocDocumentSummary> {
    const res = await pandaDocApiFetch(executiveId, `${API_BASE}/documents/${documentId}`);
    return (await res.json()) as PandaDocDocumentSummary;
  }

  /**
   * GET /documents/{id}/details - fuller metadata (recipients, tags). Does
   * NOT include view/engagement analytics - confirmed absent from this
   * endpoint's response schema (see this file's header).
   */
  async getDocumentDetails(
    executiveId: string,
    documentId: string,
  ): Promise<PandaDocDocumentDetails> {
    const res = await pandaDocApiFetch(executiveId, `${API_BASE}/documents/${documentId}/details`);
    return (await res.json()) as PandaDocDocumentDetails;
  }

  /**
   * POST /documents - creates a draft from a template. Unrestricted: no
   * recipient is notified until sendDocument is separately called and
   * approved (this file's header).
   */
  async createDocumentFromTemplate(
    executiveId: string,
    params: {
      name: string;
      templateUuid: string;
      recipients: PandaDocRecipient[];
      tokens?: Record<string, string>;
    },
  ): Promise<PandaDocDocumentSummary> {
    const res = await pandaDocApiFetch(executiveId, `${API_BASE}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name,
        template_uuid: params.templateUuid,
        recipients: params.recipients,
        tokens: params.tokens
          ? Object.entries(params.tokens).map(([name, value]) => ({ name, value }))
          : undefined,
      }),
    });
    return (await res.json()) as PandaDocDocumentSummary;
  }

  /**
   * HITL-gated (DL-ARCH-005) - same insert-before-call pattern as every
   * other adapter's send method. The document must already be in
   * "document.draft" status (poll getDocumentStatus after create) or
   * PandaDoc rejects the send.
   */
  async sendDocument(
    executiveId: string,
    context: HitlGatedWriteContext,
    documentId: string,
    message?: string,
  ): Promise<PandaDocDocumentSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "send_pandadoc_document",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await pandaDocApiFetch(executiveId, `${API_BASE}/documents/${documentId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message ? { message } : {}),
    });
    return (await res.json()) as PandaDocDocumentSummary;
  }
}
