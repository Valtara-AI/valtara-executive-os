// API-001 §3.5. Unlike Google/Microsoft, Slack has no read-vs-write
// adapter split worth making - there's one read scope and one HITL-gated
// write scope, both requested together in the single workspace-level
// consent screen (Slack's "Add to Slack" OAuth flow is inherently
// workspace-wide, not per-mailbox like Gmail/Outlook).

export const SLACK_SCOPES = ["channels:read", "chat:write"];

export const SLACK_PROVIDER = "slack";
