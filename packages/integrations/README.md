# @vex-os/integrations

Gmail + Google Calendar landed Sprint 4. Per the CLAUDE.md Sprint Plan, the rest land:

- Sprint 5 — Outlook Mail + Calendar
- Sprint 6 — Slack

## Contract

Every adapter implements `IntegrationAdapter` (`src/types.ts`), per VEX-OS-SAD-001 §4.4:

```typescript
interface IntegrationAdapter {
  getProviderName(): string;
  isConnected(executiveId: string): Promise<boolean>;
  getAuthorizationUrl(state: string): AuthorizationRequest; // { url, codeVerifier } - PKCE
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet>;
  disconnect(executiveId: string): Promise<void>;
}
```

Token storage is encrypted in `integration_tokens` (`src/token-store.ts`, using `packages/database`'s
AES-256-GCM `crypto.ts` helpers); refresh and rate-limit backoff are automatic
(`src/google/authenticated-fetch.ts`). Every write operation that performs a real external
side effect (`sendMessage`, `createEvent`, `updateEvent`) takes a `HitlGatedWriteContext` and
inserts the `external_actions` row _before_ calling the provider API — the Postgres trigger
(`packages/database`'s `0001_hitl_enforcement.sql`) rejects that insert if the linked HITL
record isn't approved, so an unapproved write is never attempted, not merely logged after the
fact (DL-ARCH-005).

**`GoogleMailAdapter` and `GoogleCalendarAdapter` share one stored token** (`provider: "google"`)
rather than two — connecting via either one requests the union of both scope sets in a single
consent screen. See `src/google/scopes.ts` for why this is a deliberate simplification rather
than Google's full incremental-authorization pattern.

Read operations are deliberately scoped to what a caller asks for (a search query, a time
range) — no bulk historical mailbox/calendar download into VEX-OS storage (API-001 §3.1's data
minimization requirement).

Each integration uses the provider's published REST API (API-first policy, DL-ARCH-003). Any
proposed MCP-based exception requires a logged entry in VEX-OS-API-001 §6 with CAO approval
before implementation.
