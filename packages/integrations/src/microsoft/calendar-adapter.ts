// API-001 §3.4. events.insert/update require an approved HITL record
// (DL-ARCH-005), same pattern as GoogleCalendarAdapter.createEvent/updateEvent.

import { getDb, schema } from "@nyxor/database";
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

export interface OutlookEventSummary {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: { emailAddress: { address: string; name?: string }; type?: string }[];
  onlineMeetingUrl?: string;
}

export class OutlookCalendarAdapter implements IntegrationAdapter {
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

  /** MB-02's calendar summary and scheduling-intelligence context both go through this. */
  async listEvents(
    executiveId: string,
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<OutlookEventSummary[]> {
    const params = new URLSearchParams({
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      $orderby: "start/dateTime",
    });
    const res = await graphApiFetch(
      executiveId,
      `${GRAPH_API_BASE}/me/calendarView?${params.toString()}`,
    );
    const body = (await res.json()) as { value?: OutlookEventSummary[] };
    return body.value ?? [];
  }

  async getEvent(executiveId: string, eventId: string): Promise<OutlookEventSummary> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/events/${eventId}`);
    return (await res.json()) as OutlookEventSummary;
  }

  async listCalendars(executiveId: string): Promise<{ id: string; name: string }[]> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/calendars`);
    const body = (await res.json()) as { value?: { id: string; name: string }[] };
    return body.value ?? [];
  }

  async getSchedule(
    executiveId: string,
    schedules: string[],
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<unknown> {
    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/calendar/getSchedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedules,
        startTime: { dateTime: startDateTime.toISOString(), timeZone: "UTC" },
        endTime: { dateTime: endDateTime.toISOString(), timeZone: "UTC" },
      }),
    });
    return res.json();
  }

  /** HITL-gated (DL-ARCH-005) - same insert-before-call pattern as GoogleCalendarAdapter.createEvent. */
  async createEvent(
    executiveId: string,
    context: HitlGatedWriteContext,
    event: { subject: string; start: string; end: string; attendees?: string[] },
  ): Promise<OutlookEventSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "create_calendar_event",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: event.subject,
        start: { dateTime: event.start, timeZone: "UTC" },
        end: { dateTime: event.end, timeZone: "UTC" },
        attendees: event.attendees?.map((address) => ({
          emailAddress: { address },
          type: "required",
        })),
      }),
    });
    return (await res.json()) as OutlookEventSummary;
  }

  /** HITL-gated (DL-ARCH-005), same pattern as createEvent. */
  async updateEvent(
    executiveId: string,
    context: HitlGatedWriteContext,
    eventId: string,
    patch: Record<string, unknown>,
  ): Promise<OutlookEventSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "update_calendar_event",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await graphApiFetch(executiveId, `${GRAPH_API_BASE}/me/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await res.json()) as OutlookEventSummary;
  }
}
