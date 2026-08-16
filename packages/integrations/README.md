# @vex-os/integrations

Empty by design in Sprint 1. Per the CLAUDE.md Sprint Plan, integration adapters land:

- Sprint 4 — Gmail + Google Calendar
- Sprint 5 — Outlook Mail + Calendar
- Sprint 6 — Slack

## Forward-referenced contract

Every adapter in this package will implement the `IntegrationAdapter` interface specified in VEX-OS-SAD-001 §4.4:

```typescript
interface IntegrationAdapter {
  getProviderName(): string;
  isConnected(executiveId: string): Promise<boolean>;
  // Token storage encrypted in DB (packages/database's crypto.ts helper);
  // refresh handled transparently; rate limit backoff built in; each
  // adapter independently testable with a mock transport.
}
```

All write operations (send email, post to Slack, create/update calendar events) must go through an approved HITL queue record before execution — this is enforced at the application layer and, for any adapter that records an `external_action` row, at the database layer via the trigger described in `packages/database/src/schema/external-action.ts`. No adapter may bypass this regardless of its own internal logic (DL-ARCH-005).

Each integration in this package must use the provider's published REST API (API-first policy, DL-ARCH-003). Any proposed MCP-based exception requires a logged entry in VEX-OS-API-001 §6 with CAO approval before implementation.
