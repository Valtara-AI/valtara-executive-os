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
export { TeamsAdapter } from "./microsoft/teams-adapter.js";
export {
  MICROSOFT_PROVIDER,
  MAIL_SCOPES as MICROSOFT_MAIL_SCOPES,
  CALENDAR_SCOPES as MICROSOFT_CALENDAR_SCOPES,
  TEAMS_SCOPES as MICROSOFT_TEAMS_SCOPES,
  ALL_MICROSOFT_SCOPES,
} from "./microsoft/scopes.js";
export {
  isMicrosoftConnected,
  disconnectMicrosoft,
  beginMicrosoftAuthorization,
  buildMicrosoftAuthorizationUrl,
  completeMicrosoftConnection,
} from "./microsoft/microsoft-connection.js";
export { SlackAdapter } from "./slack/slack-adapter.js";
export { SLACK_PROVIDER, SLACK_SCOPES } from "./slack/scopes.js";
export {
  isSlackConnected,
  disconnectSlack,
  beginSlackAuthorization,
  buildSlackAuthorizationUrl,
  completeSlackConnection,
} from "./slack/slack-connection.js";
export {
  InsufficientScopeError as SlackInsufficientScopeError,
  SlackApiError,
} from "./slack/authenticated-fetch.js";
export { PandaDocAdapter } from "./pandadoc/pandadoc-adapter.js";
export { PANDADOC_PROVIDER, PANDADOC_SCOPES } from "./pandadoc/scopes.js";
export {
  isPandaDocConnected,
  disconnectPandaDoc,
  beginPandaDocAuthorization,
  buildPandaDocAuthorizationUrl,
  completePandaDocConnection,
} from "./pandadoc/pandadoc-connection.js";
export { InsufficientScopeError as PandaDocInsufficientScopeError } from "./pandadoc/authenticated-fetch.js";
