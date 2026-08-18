// API-001 §3.3/§3.4 (Mail/Calendar) plus Teams, added later - see
// TEAMS_SCOPES below. Like Google, Outlook Mail, Calendar, and Teams all
// share one stored token (provider "microsoft") - see google/scopes.ts
// for the same reasoning: connecting via any one requests the union of
// every scope set in one consent screen.

export const MAIL_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
];

export const CALENDAR_SCOPES = [
  "https://graph.microsoft.com/Calendars.Read",
  "https://graph.microsoft.com/Calendars.ReadWrite",
];

// Not in API-001 (added post-launch, not part of the original 23-doc
// spec) - folded into the same "microsoft" connection as Mail/Calendar
// for the same reason those two share one: Teams runs on the identical
// Microsoft 365/Entra ID identity and Graph API, so a second "connect
// Teams" consent screen for the same account would just be redundant
// friction, not real scope isolation. ChannelMessage.Read.All is the one
// scope here that commonly requires *tenant admin* pre-consent in real
// Microsoft 365 organizations (unlike the others, which a work/school
// user can consent to individually) - connecting may fail with an
// AADSTS90094 "admin consent required" error in tenants where an admin
// hasn't already approved it. That's expected, not a bug in this code.
export const TEAMS_SCOPES = [
  "https://graph.microsoft.com/Team.ReadBasic.All",
  "https://graph.microsoft.com/Channel.ReadBasic.All",
  "https://graph.microsoft.com/ChannelMessage.Read.All",
  "https://graph.microsoft.com/ChannelMessage.Send",
  "https://graph.microsoft.com/Chat.Read",
];

// openid/email/profile/offline_access per API-001 §3.3 - offline_access is
// what makes Microsoft issue a refresh_token at all.
export const OPENID_SCOPES = ["openid", "email", "profile", "offline_access"];

export const MICROSOFT_PROVIDER = "microsoft";
export const ALL_MICROSOFT_SCOPES = [
  ...OPENID_SCOPES,
  ...MAIL_SCOPES,
  ...CALENDAR_SCOPES,
  ...TEAMS_SCOPES,
];
