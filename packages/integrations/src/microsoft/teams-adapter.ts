// Not in API-001 (added post-launch - see scopes.ts's header for why this
// shares the "microsoft" connection rather than being a separate
// provider). Endpoints and delegated-permission names verified against
// Microsoft Graph's own v1.0 reference docs (channel-post-messages,
// chatmessage-post, channel-list-messages, chat-list-messages) rather
// than assumed - Graph's permission naming here is genuinely
// non-obvious: sending to *either* a channel or a 1:1/group chat uses the
// same ChannelMessage.Send delegated scope (Send chatMessage in a channel
// or a chat is one shared API surface), while *reading* channel messages
// and chat messages use two different scopes (ChannelMessage.Read.All vs
// Chat.Read).
//
// channel/chat messages requires an approved HITL record (DL-ARCH-005) -
// same insert-external_actions-row-before-calling-the-API pattern as the
// Mail/Calendar adapters' send methods. Listing teams/channels/chats and
// their messages is unrestricted (read-only, same data-minimization
// policy as Mail/Calendar - callers ask for a specific team/channel/chat
// rather than this adapter ever bulk-exporting a executive's entire Teams
// history).

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

export interface TeamsTeamSummary {
  id: string;
  displayName: string;
  description?: string;
}

export interface TeamsChannelSummary {
  id: string;
  displayName: string;
  description?: string;
}

export interface TeamsChatSummary {
  id: string;
  topic?: string;
  chatType?: string;
}

export interface TeamsMessageSummary {
  id: string;
  subject?: string;
  body?: { contentType?: string; content?: string };
  from?: { user?: { displayName?: string } };
  createdDateTime?: string;
}

export class TeamsAdapter implements IntegrationAdapter {
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

  async listJoinedTeams(executiveId: string): Promise<TeamsTeamSummary[]> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/joinedTeams`);
    const body = (await res.json()) as { value?: TeamsTeamSummary[] };
    return body.value ?? [];
  }

  async listChannels(executiveId: string, teamId: string): Promise<TeamsChannelSummary[]> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/teams/${teamId}/channels`);
    const body = (await res.json()) as { value?: TeamsChannelSummary[] };
    return body.value ?? [];
  }

  async listChannelMessages(
    executiveId: string,
    teamId: string,
    channelId: string,
    top = 20,
  ): Promise<TeamsMessageSummary[]> {
    const params = new URLSearchParams({ $top: String(top) });
    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages?${params.toString()}`,
    );
    const body = (await res.json()) as { value?: TeamsMessageSummary[] };
    return body.value ?? [];
  }

  async listChats(executiveId: string): Promise<TeamsChatSummary[]> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/chats`);
    const body = (await res.json()) as { value?: TeamsChatSummary[] };
    return body.value ?? [];
  }

  async listChatMessages(
    executiveId: string,
    chatId: string,
    top = 20,
  ): Promise<TeamsMessageSummary[]> {
    const params = new URLSearchParams({ $top: String(top) });
    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/chats/${chatId}/messages?${params.toString()}`,
    );
    const body = (await res.json()) as { value?: TeamsMessageSummary[] };
    return body.value ?? [];
  }

  /** HITL-gated (DL-ARCH-005) - same insert-before-call pattern as the Mail/Calendar adapters. */
  async sendChannelMessage(
    executiveId: string,
    context: HitlGatedWriteContext,
    teamId: string,
    channelId: string,
    content: string,
  ): Promise<TeamsMessageSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "post_teams_channel_message",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: { content } }),
      },
    );
    return (await res.json()) as TeamsMessageSummary;
  }

  /** HITL-gated (DL-ARCH-005), same pattern as sendChannelMessage. */
  async sendChatMessage(
    executiveId: string,
    context: HitlGatedWriteContext,
    chatId: string,
    content: string,
  ): Promise<TeamsMessageSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "post_teams_chat_message",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: { content } }),
    });
    return (await res.json()) as TeamsMessageSummary;
  }
}
