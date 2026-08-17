// API-001 §3.3/§3.4. Like Google, Outlook Mail and Calendar share one
// stored token (provider "microsoft") - see google/scopes.ts for the same
// reasoning: connecting via either requests the union of both scope sets
// in one consent screen.

export const MAIL_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
];

export const CALENDAR_SCOPES = [
  "https://graph.microsoft.com/Calendars.Read",
  "https://graph.microsoft.com/Calendars.ReadWrite",
];

// openid/email/profile/offline_access per API-001 §3.3 - offline_access is
// what makes Microsoft issue a refresh_token at all.
export const OPENID_SCOPES = ["openid", "email", "profile", "offline_access"];

export const MICROSOFT_PROVIDER = "microsoft";
export const ALL_MICROSOFT_SCOPES = [...OPENID_SCOPES, ...MAIL_SCOPES, ...CALENDAR_SCOPES];
