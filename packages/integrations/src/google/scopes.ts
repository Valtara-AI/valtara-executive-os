// API-001 §3.1/§3.2. GoogleMailAdapter and GoogleCalendarAdapter share one
// stored token (provider "google") rather than two - a deliberate Sprint 4
// simplification: connecting via either adapter requests the *union* of
// both scope sets in one consent screen, so "connect Gmail" and "connect
// Calendar" are really "connect Google" from the executive's perspective.
// True incremental authorization (grant Calendar now, add Gmail scopes
// later without re-consenting to what's already granted) is Google's
// documented pattern for this but adds real complexity (tracking granted
// vs. requested scopes, re-prompting only for the delta) that isn't worth
// it until there's a second Google-only integration that might actually
// want partial access.

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
];

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export const GOOGLE_PROVIDER = "google";
export const ALL_GOOGLE_SCOPES = [...GMAIL_SCOPES, ...CALENDAR_SCOPES];
