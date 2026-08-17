# @vex-os/integrations

Gmail + Google Calendar landed Sprint 4. Outlook Mail + Calendar landed Sprint 5. Slack landed
Sprint 6 - all three integrations in the CLAUDE.md Sprint Plan are now built.

## Contract

Every adapter implements `IntegrationAdapter` (`src/types.ts`), per VEX-OS-SAD-001 §4.4:

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
**`OutlookMailAdapter`/`OutlookCalendarAdapter`** (provider `"microsoft"`) each share one stored
token per provider rather than two — connecting via either adapter for a given provider requests
the union of both scope sets in a single consent screen. See `src/google/scopes.ts` /
`src/microsoft/scopes.ts` for why this is a deliberate simplification rather than each provider's
full incremental-authorization pattern.

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
range) — no bulk historical mailbox/calendar download into VEX-OS storage (API-001 §3.1's data
minimization requirement).

Each integration uses the provider's published REST API (API-first policy, DL-ARCH-003). Any
proposed MCP-based exception requires a logged entry in VEX-OS-API-001 §6 with CAO approval
before implementation.
