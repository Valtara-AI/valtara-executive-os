# @nyxor/integrations

Gmail + Google Calendar landed Sprint 4. Outlook Mail + Calendar landed Sprint 5. Slack landed
Sprint 6 - all three integrations in the CLAUDE.md Sprint Plan are now built. Microsoft Teams and
PandaDoc landed after that, prioritized post-launch (DL-ARCH-009): Teams as the cheapest addition
(reuses the existing Microsoft Graph OAuth app), PandaDoc as the board/investor document-sharing
integration after DocSend was rejected for unverifiable API documentation.

## Contract

Every adapter implements `IntegrationAdapter` (`src/types.ts`), per NYXOR-SAD-001 §4.4:

```typescript
interface IntegrationAdapter {
  getProviderName(): string;
  isConnected(executiveId: string): Promise<boolean>;
  getAuthorizationUrl(state: string): AuthorizationRequest; // { url, codeVerifier } - PKCE where the provider supports it
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet>;
  disconnect(executiveId: string): Promise<void>;
}
```

`codeVerifier` is PKCE-specific (RFC 7636) and only meaningful for Google/Microsoft - Slack's
OAuth v2 endpoints don't support it, so `SlackAdapter` accepts and ignores the parameter (see
`src/slack/oauth.ts`'s header) rather than the shared interface growing a per-provider optional
field.

Token storage is encrypted in `integration_tokens` (`src/token-store.ts`, using `packages/database`'s
AES-256-GCM `crypto.ts` helpers); refresh and rate-limit backoff are automatic
(`src/google/authenticated-fetch.ts`). Every write operation that performs a real external
side effect (`sendMessage`, `createEvent`, `updateEvent`) takes a `HitlGatedWriteContext` and
inserts the `external_actions` row _before_ calling the provider API — the Postgres trigger
(`packages/database`'s `0001_hitl_enforcement.sql`) rejects that insert if the linked HITL
record isn't approved, so an unapproved write is never attempted, not merely logged after the
fact (DL-ARCH-005).

**`GoogleMailAdapter`/`GoogleCalendarAdapter`** (provider `"google"`) and
**`OutlookMailAdapter`/`OutlookCalendarAdapter`/`TeamsAdapter`** (provider `"microsoft"`) each
share one stored token per provider rather than one-per-adapter — connecting via any adapter for
a given provider requests the union of every scope set for that provider in a single consent
screen. See `src/google/scopes.ts` / `src/microsoft/scopes.ts` for why this is a deliberate
simplification rather than each provider's full incremental-authorization pattern.

**`TeamsAdapter`** sends to both channels and 1:1/group chats through the same delegated
permission, `ChannelMessage.Send` — verified against Microsoft Graph's own reference docs rather
than assumed, since the name strongly implies "channels only" and is easy to get wrong. Reading
channel messages and chat messages use two different scopes instead
(`ChannelMessage.Read.All` / `Chat.Read`). `ChannelMessage.Read.All` commonly requires _tenant
admin_ pre-consent in real Microsoft 365 organizations, unlike every other scope this package
requests - connecting may fail with an admin-consent error in tenants where that hasn't happened,
which is expected Graph behavior, not a bug here.

The Microsoft adapters call the Microsoft identity platform v2.0 and Graph v1.0 REST endpoints
directly (Authorization Code + PKCE), the same way the Google adapters call Google's OAuth/API
endpoints directly — not via `@azure/msal-node` (API-001 §3.3's literal suggestion) or
`googleapis`. See DL-ARCH-008 in the Decision Log for the rationale.

**`SlackAdapter`** (provider `"slack"`) is Slack's Web API, which has one structural quirk the
other two providers don't: it returns HTTP 200 even for application-level failures
(`invalid_auth`, `missing_scope`, `channel_not_found`, ...) — the real success/failure signal is
the `ok` boolean in the JSON body, not the HTTP status code. `src/slack/authenticated-fetch.ts`
checks both layers: HTTP status for rate-limit/transient-failure retry, `body.ok` for the
Slack-specific auth/scope/other-error split. It also implements reactive Retry-After backoff on
429 rather than API-001 §3.5's literal "queue requests near the limit" — proactive throttling
is meaningful extra complexity not justified by this system's actual Slack call volume; revisit
if a future workforce use case drives sustained near-limit traffic.

Read operations are deliberately scoped to what a caller asks for (a search query, a time
range) — no bulk historical mailbox/calendar download into NYXOR storage (API-001 §3.1's data
minimization requirement).

**`PandaDocAdapter`** (provider `"pandadoc"`) follows the same create-draft/send split as Gmail,
not Calendar's create-notifies-immediately split: `createDocumentFromTemplate` (`POST
/documents`) is unrestricted because a newly created document (`document.uploaded` →
`document.draft`) never notifies its recipients on its own - only `sendDocument` (`POST
/documents/{id}/send`) does, so only that method is HITL-gated (DL-ARCH-005). PandaDoc's OAuth
has no PKCE (like Slack) and a much simpler scope model (`read`/`write` cover the whole API,
confirmed against PandaDoc's own reference docs rather than assumed). One real gap, logged in
DL-ARCH-009: PandaDoc's public REST API does not expose recipient view/engagement analytics via
GET - not on `/documents/{id}` (status) nor `/documents/{id}/details`. That data only exists via
webhooks (`document_viewed`, `document_state_changed`), which would require an inbound webhook
receiver - a genuinely new architectural pattern (every adapter here is pull/polling-based) -
deliberately not built in this phase.

Each integration uses the provider's published REST API (API-first policy, DL-ARCH-003). Any
proposed MCP-based exception requires a logged entry in NYXOR-API-001 §6 with CAO approval
before implementation.
