export * from "./types.js";
export * from "./token-store.js";
export { GoogleMailAdapter } from "./google/gmail-adapter.js";
export { GoogleCalendarAdapter } from "./google/calendar-adapter.js";
export {
  GOOGLE_PROVIDER,
  GMAIL_SCOPES,
  CALENDAR_SCOPES,
  ALL_GOOGLE_SCOPES,
} from "./google/scopes.js";
export {
  isGoogleConnected,
  disconnectGoogle,
  beginGoogleAuthorization,
  buildGoogleAuthorizationUrl,
  completeGoogleConnection,
} from "./google/google-connection.js";
export { InsufficientScopeError } from "./google/authenticated-fetch.js";
export { OutlookMailAdapter } from "./microsoft/mail-adapter.js";
export { OutlookCalendarAdapter } from "./microsoft/calendar-adapter.js";
export {
  MICROSOFT_PROVIDER,
  MAIL_SCOPES as MICROSOFT_MAIL_SCOPES,
  CALENDAR_SCOPES as MICROSOFT_CALENDAR_SCOPES,
  ALL_MICROSOFT_SCOPES,
} from "./microsoft/scopes.js";
export {
  isMicrosoftConnected,
  disconnectMicrosoft,
  beginMicrosoftAuthorization,
  buildMicrosoftAuthorizationUrl,
  completeMicrosoftConnection,
} from "./microsoft/microsoft-connection.js";
