// API-001 §3.5. conversations.list (channels:read) is unrestricted;
// chat.postMessage (chat:write) requires an approved HITL record
// (DL-ARCH-005) - same insert-external_actions-row-before-calling-the-API
// pattern as the Google/Microsoft adapters' send methods.

import { getDb, schema } from "@vex-os/database";
import type {
  AuthorizationRequest,
  HitlGatedWriteContext,
  IntegrationAdapter,
  OAuthTokenSet,
} from "../types.js";
import { slackApiFetch } from "./authenticated-fetch.js";
import {
  disconnectSlack,
  getSlackAuthorizationUrlLegacy,
  isSlackConnected,
} from "./slack-connection.js";
import { exchangeCodeForTokens } from "./oauth.js";
import { SLACK_PROVIDER } from "./scopes.js";

export interface SlackChannel {
  id: string;
  name: string;
  is_member?: boolean;
}

export class SlackAdapter implements IntegrationAdapter {
  getProviderName(): string {
    return SLACK_PROVIDER;
  }

  isConnected(executiveId: string): Promise<boolean> {
    return isSlackConnected(executiveId);
  }

  getAuthorizationUrl(state: string): AuthorizationRequest {
    return getSlackAuthorizationUrlLegacy(state);
  }

  // codeVerifier is part of IntegrationAdapter's shared contract (PKCE, for
  // Google/Microsoft) but Slack's OAuth doesn't use it - see oauth.ts's
  // header. Accepted and ignored rather than removed from the signature,
  // so this adapter still fully implements the interface.
  exchangeCodeForTokens(code: string, _codeVerifier: string): Promise<OAuthTokenSet> {
    return exchangeCodeForTokens(code);
  }

  disconnect(executiveId: string): Promise<void> {
    return disconnectSlack(executiveId);
  }

  /** MB-02-adjacent context assembly and workforce agent context both go through this. */
  async listChannels(executiveId: string): Promise<SlackChannel[]> {
    const body = await slackApiFetch(executiveId, "conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    return (body.channels as SlackChannel[] | undefined) ?? [];
  }

  /**
   * HITL-gated (DL-ARCH-005). Inserts the external_actions row first - the
   * Postgres trigger rejects it if hitlQueueItemId isn't approved, and the
   * post is never attempted in that case.
   */
  async postMessage(
    executiveId: string,
    context: HitlGatedWriteContext,
    channel: string,
    text: string,
  ): Promise<{ ts: string; channel: string }> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "post_slack_message",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const body = await slackApiFetch(executiveId, "chat.postMessage", { channel, text });
    return { ts: body.ts as string, channel: body.channel as string };
  }
}
