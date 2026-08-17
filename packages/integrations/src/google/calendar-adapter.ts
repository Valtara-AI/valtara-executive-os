// API-001 §3.2. events.insert/update require an approved HITL record
// (DL-ARCH-005), same pattern as GoogleMailAdapter.sendMessage.

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

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarEventSummary {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  hangoutLink?: string;
}

export class GoogleCalendarAdapter implements IntegrationAdapter {
  getProviderName(): string {
    return GOOGLE_PROVIDER;
  }

  isConnected(executiveId: string): Promise<boolean> {
    return isGoogleConnected(executiveId);
  }

  getAuthorizationUrl(state: string): AuthorizationRequest {
    return getGoogleAuthorizationUrlLegacy(state);
  }

  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet> {
    return exchangeCodeForTokens(code, codeVerifier);
  }

  disconnect(executiveId: string): Promise<void> {
    return disconnectGoogle(executiveId);
  }

  /** MB-02's calendar summary and scheduling-intelligence context both go through this. */
  async listEvents(
    executiveId: string,
    timeMin: Date,
    timeMax: Date,
    calendarId = "primary",
  ): Promise<CalendarEventSummary[]> {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });
    const res = await googleApiFetch(
      executiveId,
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    );
    const body = (await res.json()) as { items?: CalendarEventSummary[] };
    return body.items ?? [];
  }

  async getEvent(
    executiveId: string,
    eventId: string,
    calendarId = "primary",
  ): Promise<CalendarEventSummary> {
    const res = await googleApiFetch(
      executiveId,
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    );
    return (await res.json()) as CalendarEventSummary;
  }

  async freeBusy(
    executiveId: string,
    timeMin: Date,
    timeMax: Date,
    calendarId = "primary",
  ): Promise<unknown> {
    const res = await googleApiFetch(executiveId, `${CALENDAR_API_BASE}/freeBusy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    return res.json();
  }

  /** HITL-gated (DL-ARCH-005) - same insert-before-call pattern as GoogleMailAdapter.sendMessage. */
  async createEvent(
    executiveId: string,
    context: HitlGatedWriteContext,
    event: { summary: string; start: string; end: string; attendees?: string[] },
    calendarId = "primary",
  ): Promise<CalendarEventSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "create_calendar_event",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await googleApiFetch(
      executiveId,
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: event.summary,
          start: { dateTime: event.start },
          end: { dateTime: event.end },
          attendees: event.attendees?.map((email) => ({ email })),
        }),
      },
    );
    return (await res.json()) as CalendarEventSummary;
  }

  /** HITL-gated (DL-ARCH-005), same pattern as createEvent. */
  async updateEvent(
    executiveId: string,
    context: HitlGatedWriteContext,
    eventId: string,
    patch: Record<string, unknown>,
    calendarId = "primary",
  ): Promise<CalendarEventSummary> {
    const db = getDb();
    await db.insert(schema.externalActions).values({
      actionType: "update_calendar_event",
      agentId: context.agentId,
      hitlQueueItemId: context.hitlQueueItemId,
    });

    const res = await googleApiFetch(
      executiveId,
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    return (await res.json()) as CalendarEventSummary;
  }
}
