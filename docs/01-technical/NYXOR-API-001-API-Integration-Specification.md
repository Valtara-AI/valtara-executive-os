**VALTARA AI**

**Nyxor**

**API & INTEGRATION SPECIFICATION**

NYXOR-API-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-API-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Draft — Internal Review                       |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Engineering, Architecture, QA, Security       |
| Date           | August 2026                                   |
| Depends On     | NYXOR-SRS-001, NYXOR-SAD-001                  |
| Classification | Confidential — Internal Use Only              |

# 1. Purpose & Scope

This API & Integration Specification defines the internal NYXOR API contract and the specifications for all external integrations. It is the authoritative reference for every interface in the system: the REST API consumed by the frontend, the integration adapter contracts for email and calendar providers, and the LLM provider adapter interface.

NYXOR follows an API-first integration policy. All third-party integrations use published REST APIs. MCP connections are permitted only where no REST API equivalent exists, and each such exception must be documented in Section 6 of this document with explicit justification.

# 2. Internal REST API

**2.1 API Design Conventions**

| Convention      | Specification                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Base URL        | /api/v1/ — all endpoints versioned from Sprint 1                                                |
| Protocol        | HTTPS only; HTTP redirects to HTTPS; no HTTP in production                                      |
| Request format  | JSON body for POST/PATCH/PUT; query params for GET filters; no XML                              |
| Response format | JSON; always includes {success: boolean, data: object                                           | null, error: object  | null} |
| Error format    | {success: false, error: {code: string, message: string, details?: object}}                      |
| Authentication  | Bearer token (JWT) in Authorization header; all endpoints require authentication except /auth/* |
| Versioning      | URL path versioning (/api/v1/, /api/v2/ on breaking change); no header versioning               |
| Rate limiting   | Per-user rate limits enforced; 429 response includes Retry-After header                         |
| Pagination      | Cursor-based pagination; {data: [], nextCursor: string                                          | null, total: number} |
| OpenAPI spec    | OpenAPI 3.1 spec auto-generated from route definitions; published at /api/docs in development   |

## 2.2 Authentication Endpoints

| Method + Path                       | Purpose                           | Notes                                                                                               |
| ----------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET /api/v1/auth/google             | Initiate Google OAuth 2.0 flow    | Redirects to Google consent screen; returns state parameter for CSRF protection                     |
| GET /api/v1/auth/google/callback    | Handle Google OAuth callback      | Validates state; exchanges code for tokens; creates or updates user session; redirects to dashboard |
| GET /api/v1/auth/microsoft          | Initiate Microsoft OAuth 2.0 flow | MSAL-based; same pattern as Google                                                                  |
| GET /api/v1/auth/microsoft/callback | Handle Microsoft OAuth callback   | Same pattern as Google callback                                                                     |
| POST /api/v1/auth/logout            | Invalidate session                | Clears JWT; revokes refresh token; audit log entry created                                          |
| POST /api/v1/auth/refresh           | Refresh access token              | Requires valid refresh token in httpOnly cookie; returns new access token                           |

## 2.3 Executive Profile Endpoints

| Method + Path                              | Purpose                                             | Notes                                                                                    |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET /api/v1/executive/profile              | Retrieve executive profile and Intelligence Profile | Returns current version; includes agent workforce summary                                |
| PATCH /api/v1/executive/profile            | Update executive profile fields                     | Partial update; version incremented; previous version archived                           |
| GET /api/v1/executive/voice-profile        | Retrieve Voice Profile                              | Returns structured Voice Profile JSON                                                    |
| PATCH /api/v1/executive/voice-profile      | Update Voice Profile                                | Manual override of extracted profile; version incremented                                |
| POST /api/v1/executive/onboarding/start    | Start onboarding interview session                  | Returns session ID; initiates conversational interview state machine                     |
| POST /api/v1/executive/onboarding/respond  | Submit interview response                           | Body: {sessionId, response}; returns next question or completion signal                  |
| POST /api/v1/executive/onboarding/complete | Finalize onboarding                                 | Triggers profile generation and agent workforce provisioning; returns proposed workforce |
| POST /api/v1/executive/onboarding/confirm  | Confirm proposed agent workforce                    | Body: {agents: [{id, name, hitl_mode, active: boolean}]}; activates approved agents      |

## 2.4 Agent Endpoints

| Method + Path                      | Purpose                                     | Notes                                                                        |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| GET /api/v1/agents                 | List all agents for authenticated executive | Returns active and archived; filterable by status                            |
| GET /api/v1/agents/:agentId        | Get agent detail                            | Includes configuration, HITL mode, task history summary                      |
| POST /api/v1/agents                | Create new agent                            | Body: {name, description, responsibilities[], hitl_mode}                     |
| PATCH /api/v1/agents/:agentId      | Update agent configuration                  | Partial update; hitl_mode change takes effect on next task                   |
| DELETE /api/v1/agents/:agentId     | Archive agent                               | Soft delete; data preserved; tasks in progress completed before archival     |
| POST /api/v1/agents/:agentId/tasks | Assign task to agent                        | Body: {prompt, context?: object}; returns task ID; task queued for execution |

## 2.5 Task Endpoints

| Method + Path                | Purpose                                       | Notes                                                          |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| GET /api/v1/tasks            | List tasks; filterable by agent, status, date | Cursor-paginated; default sort: created_at DESC                |
| GET /api/v1/tasks/:taskId    | Get task detail including output              | Returns task record, output (if complete), HITL status         |
| DELETE /api/v1/tasks/:taskId | Cancel queued or in-progress task             | Only cancellable in queued or in_progress status; audit logged |

## 2.6 HITL Queue Endpoints

| Method + Path                           | Purpose                               | Notes                                                                               |
| --------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| GET /api/v1/hitl/queue                  | List pending HITL items               | Default: pending items only; filterable by agent, date; sorted by urgency           |
| GET /api/v1/hitl/queue/:itemId          | Get HITL item detail with full output | Returns original output, metadata, agent context                                    |
| POST /api/v1/hitl/queue/:itemId/approve | Approve output as-is                  | Triggers downstream action; audit log entry created with actor and timestamp        |
| POST /api/v1/hitl/queue/:itemId/edit    | Submit edited output for approval     | Body: {finalOutput: string}; records original and final; triggers downstream action |
| POST /api/v1/hitl/queue/:itemId/reject  | Reject output                         | Body: {reason?: string}; agent notified; retry if configured; audit logged          |

## 2.7 Dashboard & Brief Endpoints

| Method + Path                 | Purpose                    | Notes                                                                          |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| GET /api/v1/dashboard/summary | Get dashboard summary data | Returns: HITL queue count, active tasks, pending decisions, integration status |
| GET /api/v1/briefs            | List morning briefs        | Returns last 30 days; cursor-paginated                                         |
| GET /api/v1/briefs/today      | Get today's morning brief  | Returns null if not yet generated; 404 if generation failed                    |
| GET /api/v1/briefs/:briefId   | Get specific brief         | Returns full brief content and section breakdown                               |

## 2.8 Integration Management Endpoints

| Method + Path                                | Purpose                                     | Notes                                                                  |
| -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| GET /api/v1/integrations                     | List all integrations and connection status | Returns provider, status (connected/disconnected), scopes, last_synced |
| DELETE /api/v1/integrations/:provider        | Disconnect integration and revoke tokens    | Revokes OAuth; deletes stored tokens; audit logged                     |
| GET /api/v1/integrations/:provider/authorize | Initiate OAuth connection for provider      | Redirects to provider OAuth consent screen                             |

# 3. External Integration Specifications

## 3.1 Gmail Integration

| Attribute         | Specification                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API               | Google Gmail API v1 (REST)                                                                                                                                                                 |
| Auth flow         | OAuth 2.0 Authorization Code with PKCE; Google Identity Services                                                                                                                           |
| Scopes requested  | https://www.googleapis.com/auth/gmail.readonly (read only); https://www.googleapis.com/auth/gmail.compose (draft creation); https://www.googleapis.com/auth/gmail.send (send — HITL-gated) |
| Token management  | Access token (1hr TTL) stored encrypted; refresh token stored encrypted; auto-refresh via adapter before expiry                                                                            |
| Read operations   | threads.list, threads.get, messages.get, labels.list — used for morning brief and agent context assembly                                                                                   |
| Write operations  | drafts.create (always allowed); messages.send (requires approved HITL queue record; enforced at application layer)                                                                         |
| Rate limits       | Gmail API: 250 quota units/second/user; adapter implements exponential backoff on 429; rate limit events logged                                                                            |
| Error handling    | 401 → trigger token refresh; 403 → log insufficient scope error, notify executive; 429 → backoff and retry; 5xx → retry 3x then task fails                                                 |
| Data minimization | Only retrieve emails relevant to active agent task context; no bulk historical download to NYXOR storage                                                                                   |

## 3.2 Google Calendar Integration

| Attribute        | Specification                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| API              | Google Calendar API v3 (REST)                                                                                                          |
| Auth flow        | Same OAuth session as Gmail if both connected; separate consent if Calendar only                                                       |
| Scopes requested | https://www.googleapis.com/auth/calendar.readonly (read); https://www.googleapis.com/auth/calendar.events (create/update — HITL-gated) |
| Read operations  | events.list, events.get, freebusy.query — used for morning brief calendar section and scheduling intelligence                          |
| Write operations | events.insert, events.update (requires approved HITL record)                                                                           |
| Refresh pattern  | Shared token with Gmail integration if connected via same Google account; independent token if separate                                |

## 3.3 Microsoft Outlook Mail Integration

| Attribute        | Specification                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| API              | Microsoft Graph API v1.0 (REST)                                                                                |
| Auth flow        | OAuth 2.0 via MSAL (Microsoft Authentication Library); Authorization Code + PKCE                               |
| Scopes requested | openid, email, profile, offline_access, Mail.Read, Mail.ReadWrite, Mail.Send (send HITL-gated)                 |
| Endpoints used   | GET /me/messages, GET /me/mailFolders, POST /me/messages (draft), POST /me/sendMail (HITL-gated)               |
| Token management | MSAL handles token refresh; tokens stored encrypted; same pattern as Gmail adapter                             |
| Rate limits      | Graph API: throttling based on service protection limits; adapter implements Retry-After header respect on 429 |

## 3.4 Microsoft Outlook Calendar Integration

| Attribute        | Specification                                                                         |
| ---------------- | ------------------------------------------------------------------------------------- |
| API              | Microsoft Graph API v1.0 (REST)                                                       |
| Auth flow        | Shared OAuth session with Outlook Mail if both connected                              |
| Scopes requested | Calendars.Read, Calendars.ReadWrite (write HITL-gated)                                |
| Endpoints used   | GET /me/events, GET /me/calendars, POST /me/events (HITL-gated), GET /me/calendarView |
| Free/busy        | POST /me/calendar/getSchedule for scheduling intelligence feature                     |

## 3.5 Slack Integration

| Attribute        | Specification                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------- |
| API              | Slack Web API (REST)                                                                     |
| Auth flow        | OAuth 2.0 with Slack; workspace-level authorization                                      |
| Scopes requested | channels:read (list channels), chat:write (post message — HITL-gated)                    |
| Endpoints used   | conversations.list, chat.postMessage (HITL-gated)                                        |
| Rate limits      | Slack Tier 3: 50 requests/minute for most methods; adapter queues requests near limit    |
| Write constraint | chat.postMessage only callable after approved HITL record; enforced at application layer |

# 4. LLM Provider Adapter Specification

**4.1 Adapter Interface Contract**

All LLM providers must implement the following TypeScript interface. No provider SDK may be called outside of its concrete adapter implementation.

interface InferenceProvider {

complete(request: InferenceRequest): Promise<InferenceResult>;

isAvailable(): Promise<boolean>;

getProviderName(): string;

}

interface InferenceRequest {

systemPrompt: string;

messages: {role: "user" | "assistant"; content: string}[];

maxOutputTokens: number;

temperature?: number; // default: 0.3 for agents; 0.7 for creative tasks

responseFormat?: "text" | "json";

}

interface InferenceResult {

content: string;

inputTokens: number;

outputTokens: number;

model: string;

provider: string;

latencyMs: number;

}

**4.2 Provider Configuration via .env**

| Environment Variable   | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| LLM_PROVIDER           | Primary provider: openai                                  | anthropic | google | mistral | groq |
| LLM_PROVIDER_SECONDARY | Failover provider (optional); same values as above        |
| LLM_MODEL_DEFAULT      | Default model for general agent tasks                     |
| LLM_MODEL_ANALYSIS     | Higher-capability model for analysis and research tasks   |
| LLM_MODEL_ONBOARDING   | Model for onboarding interview and profile generation     |
| LLM_MODEL_DRAFT        | Cost-efficient model for draft generation tasks           |
| OPENAI_API_KEY         | OpenAI API key; required if LLM_PROVIDER=openai           |
| ANTHROPIC_API_KEY      | Anthropic API key; required if LLM_PROVIDER=anthropic     |
| GOOGLE_AI_API_KEY      | Google AI Studio API key; required if LLM_PROVIDER=google |
| MISTRAL_API_KEY        | Mistral API key; required if LLM_PROVIDER=mistral         |
| GROQ_API_KEY           | Groq API key; required if LLM_PROVIDER=groq               |

# 5. Complete .env Template

The following is the canonical .env template for NYXOR. The .env.example file in the repository contains this structure with no real values. The actual .env file is always listed in .gitignore and must never be committed.

# NYXOR Environment Configuration

# Copy to .env and populate with real values

# NEVER commit .env to version control

# ── Application ──────────────────────────────

NODE_ENV=development

PORT=3001

APP_URL=http://localhost:3000

API_URL=http://localhost:3001

JWT_SECRET=

JWT_REFRESH_SECRET=

SESSION_SECRET=

# ── Database ─────────────────────────────────

DATABASE_URL=

DB_ENCRYPTION_KEY=

# ── Cache / Queue ────────────────────────────

REDIS_URL=

# ── AI Provider ──────────────────────────────

LLM_PROVIDER=anthropic

LLM_PROVIDER_SECONDARY=

LLM_MODEL_DEFAULT=claude-sonnet-4-6

LLM_MODEL_ANALYSIS=claude-opus-4-6

LLM_MODEL_ONBOARDING=claude-sonnet-4-6

LLM_MODEL_DRAFT=claude-haiku-4-5-20251001

OPENAI_API_KEY=

ANTHROPIC_API_KEY=

GOOGLE_AI_API_KEY=

MISTRAL_API_KEY=

GROQ_API_KEY=

# ── Google Integration ───────────────────────

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

GOOGLE_REDIRECT_URI=

# ── Microsoft Integration ────────────────────

MICROSOFT_CLIENT_ID=

MICROSOFT_CLIENT_SECRET=

MICROSOFT_REDIRECT_URI=

MICROSOFT_TENANT_ID=common

# ── Slack Integration ────────────────────────

SLACK_CLIENT_ID=

SLACK_CLIENT_SECRET=

SLACK_REDIRECT_URI=

# ── Storage ──────────────────────────────────

SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

# ── Monitoring ───────────────────────────────

SENTRY_DSN=

OTEL_EXPORTER_ENDPOINT=

# 6. MCP Integration Exceptions Register

NYXOR follows an API-first integration policy. The following register documents any MCP connections approved for use where no viable REST API alternative exists. Any team member proposing an MCP integration must add an entry here before implementation begins. Empty at document creation — no MCP exceptions approved for v1.0 MVP.

| MCP Server        | Proposed Use |
| ----------------- | ------------ |
| (None — v1.0 MVP) | —            |

# 7. Document Approval

| Role        | Name                                                            |
| ----------- | --------------------------------------------------------------- |
| Author      | Francis Ogbogu — Chief AI Officer                               |
| Reviewer    | Valtara Engineering Lead                                        |
| Approver    | Francis Ogbogu — Chief AI Officer                               |
| Date Issued | August 2026                                                     |
| Next Review | Upon addition of new integration or internal API endpoint group |

_NYXOR-API-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
