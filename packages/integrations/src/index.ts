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
export { fetchWithBackoff } from "./http-retry.js";
// Deliberately plain function/type exports, not IntegrationAdapter-shaped -
// these are single-API-key platform integrations (market data, news), not
// per-executive OAuth. See each client.ts's file header for why.
export { getQuotes } from "./market-data/client.js";
export type { Quote } from "./market-data/types.js";
export { getHeadlines } from "./news/client.js";
export type { GetHeadlinesParams } from "./news/client.js";
export type { Headline } from "./news/types.js";
export { transcribeAudio } from "./speech-to-text/client.js";
export { uploadRecording, getSignedPlaybackUrl } from "./audio-storage/client.js";
