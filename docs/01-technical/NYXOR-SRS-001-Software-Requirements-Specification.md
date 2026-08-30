**VALTARA AI**

**Nyxor**

**SOFTWARE REQUIREMENTS SPECIFICATION**

NYXOR-SRS-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-SRS-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Draft — Internal Review                       |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Engineering, Architecture, QA, Security       |
| Date           | August 2026                                   |
| Depends On     | NYXOR-PB-001, NYXOR-PRD-001                   |
| Referenced By  | NYXOR-SAD-001, NYXOR-DMP-001, NYXOR-API-001   |
| Classification | Confidential — Internal Use Only              |

# 1. Purpose & Scope

This Software Requirements Specification (SRS) defines the complete system behavior, interface contracts, performance bounds, data requirements, and constraints for Nyxor. It is the technical contract between product requirements and system implementation. All engineering decisions must be traceable to requirements defined here or in NYXOR-PRD-001.

This document follows IEEE 830-1998 SRS structure adapted for AI-native product development. It covers the full system boundary: frontend, backend, AI inference layer, integration adapters, data persistence, security controls, and operational requirements.

# 2. System Overview

**2.1 System Description**

NYXOR is a multi-tier web application with an AI orchestration layer. It is designed to be modular, platform-agnostic, and migration-friendly. No component has a hard dependency on any single vendor.

| Layer                     | Responsibility                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Presentation Layer        | React-based single-page application; server-side rendering for dashboard; responsive to 375px minimum viewport    |
| Application Layer         | Node.js/TypeScript API server; REST endpoints; business logic; session management; HITL queue management          |
| AI Orchestration Layer    | Model-agnostic LLM routing; prompt management; Voice Profile application; agent task execution; provider failover |
| Integration Adapter Layer | API connectors for email, calendar, and auxiliary tools; OAuth token management; webhook handling                 |
| Data Persistence Layer    | PostgreSQL via Supabase for structured data; vector store for semantic retrieval; encrypted secrets via .env      |
| Audit & Compliance Layer  | Immutable audit log; event streaming; compliance export; retention policy enforcement                             |

**2.2 System Boundaries**

In scope: web application frontend, API backend, AI orchestration engine, integration adapters (Gmail, Outlook, Google Calendar, Outlook Calendar, Slack in MVP), data persistence, audit logging, authentication, and HITL governance engine.

Out of scope: native mobile applications, telephony integrations, real-time voice interfaces, on-premise deployment, and financial transaction processing.

# 3. System Interface Requirements

## 3.1 User Interface Requirements

| ID    | Requirement         | Detail                                                               | Priority |
| ----- | ------------------- | -------------------------------------------------------------------- | -------- |
| UI-01 | Web-based SPA       | React frontend; no native app required for v1.0                      | M        |
| UI-02 | Responsive layout   | Minimum breakpoint 375px; full functionality at 1280px+              | M        |
| UI-03 | WCAG 2.1 AA         | All interactive elements meet accessibility standards                | M        |
| UI-04 | Dark/light mode     | User preference stored; applies system-wide immediately              | S        |
| UI-05 | Session persistence | Session survives page refresh; JWT-based authentication              | M        |
| UI-06 | Loading states      | All async operations show progress indicator ≤200ms after trigger    | M        |
| UI-07 | Error messaging     | All error states surface user-readable messages with recovery action | M        |

## 3.2 External Interface Requirements — Integrations

| ID    | Integration                | Protocol                                          | Auth Method                                                                                  |
| ----- | -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EI-01 | Gmail                      | Google Gmail API v1 (REST)                        | OAuth 2.0; scopes: gmail.readonly, gmail.compose, gmail.send (send requires HITL approval)   |
| EI-02 | Google Calendar            | Google Calendar API v3 (REST)                     | OAuth 2.0; scopes: calendar.readonly, calendar.events (write requires HITL approval)         |
| EI-03 | Microsoft Outlook Mail     | Microsoft Graph API v1.0 (REST)                   | OAuth 2.0 / MSAL; scopes: Mail.Read, Mail.ReadWrite, Mail.Send (send requires HITL approval) |
| EI-04 | Microsoft Outlook Calendar | Microsoft Graph API v1.0 (REST)                   | OAuth 2.0 / MSAL; scopes: Calendars.Read, Calendars.ReadWrite (write requires HITL approval) |
| EI-05 | Slack                      | Slack Web API (REST)                              | OAuth 2.0; scopes: channels:read, chat:write (write requires HITL approval)                  |
| EI-06 | LLM Providers              | OpenAI API / Anthropic API / Google AI API (REST) | API key via .env; provider selected via configuration; no hardcoded provider                 |

## 3.3 AI Orchestration Interface Requirements

| Requirement              | Specification                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider abstraction     | All LLM calls routed through a provider-agnostic adapter layer; provider specified in .env (LLM_PROVIDER); no direct provider SDK calls in business logic                             |
| Model selection          | Model configurable per task type via .env (LLM_MODEL_DEFAULT, LLM_MODEL_ANALYSIS, LLM_MODEL_DRAFT); defaults to cost-efficient model for drafts, higher-capability model for analysis |
| Prompt management        | All system prompts stored as versioned templates; no inline prompt construction in application code                                                                                   |
| Voice Profile injection  | Voice Profile appended to all agent generation prompts as a structured system context block                                                                                           |
| Response validation      | All LLM responses validated for structure before use; malformed responses trigger retry with backoff (max 3 attempts)                                                                 |
| Token budget enforcement | Max token budgets defined per task type; enforced at orchestration layer; never exceeded                                                                                              |
| Failover                 | If primary LLM provider returns 5xx or rate limit error, failover to secondary provider if configured in .env                                                                         |

# 4. Detailed Functional Requirements

## 4.1 Authentication & Session Management

| ID      | Requirement              | Specification                                                                          | Priority |
| ------- | ------------------------ | -------------------------------------------------------------------------------------- | -------- |
| AUTH-01 | SSO via Google Workspace | OAuth 2.0 PKCE flow; openid, email, profile scopes                                     | M        |
| AUTH-02 | SSO via Microsoft 365    | OAuth 2.0 MSAL flow; openid, email, profile scopes                                     | M        |
| AUTH-03 | JWT session management   | Access token: 1-hour TTL; refresh token: 30-day TTL; stored in httpOnly cookie         | M        |
| AUTH-04 | MFA enforcement          | Enforced at IdP level; NYXOR does not bypass MFA                                       | M        |
| AUTH-05 | Session timeout          | Configurable idle timeout (default: 8 hours); explicit logout clears all tokens        | M        |
| AUTH-06 | RBAC enforcement         | Three roles: Executive, Delegate, Administrator; enforced server-side on every request | M        |

## 4.2 Onboarding Agent — System Requirements

| ID        | Requirement                           | Specification                                                                                                                                                                      | Priority |
| --------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| OA-SYS-01 | Conversational interview engine       | Stateful multi-turn conversation; branching logic based on role/domain response; minimum 12 questions                                                                              | M        |
| OA-SYS-02 | Executive Intelligence Profile schema | JSON document: {name, title, domain, organization, time_drains[], delegation_candidates[], communication_style, tools[], priorities[], voice_sample}; versioned on update          | M        |
| OA-SYS-03 | Agent workforce generation            | LLM generates proposed agents from profile; each agent: {id, name, description, responsibilities[], hitl_mode, skill_templates[]}; stored to database                              | M        |
| OA-SYS-04 | Voice Profile extraction              | LLM extracts: tone (formal/conversational/direct), sentence_length (short/medium/long), vocabulary_level, preferred_salutations, structural_preferences; stored as structured JSON | M        |
| OA-SYS-05 | Re-onboarding support                 | Incremental profile update; existing agents preserved unless explicitly retired; version history maintained                                                                        | S        |

## 4.3 HITL Governance Engine

| ID      | Requirement         | Specification                                                                                                         | Priority |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| HITL-01 | Queue management    | All agent outputs requiring approval held in pending queue; status: pending, approved, edited, rejected               | M        |
| HITL-02 | Approve action      | Marks output approved; triggers downstream action (send email, publish, etc.); audit log entry created                | M        |
| HITL-03 | Edit action         | Opens output in inline editor; executive modifies; submits as approved-with-edit; original and final both logged      | M        |
| HITL-04 | Reject action       | Marks output rejected; captures rejection reason (optional); agent notified for retry if retry_on_reject=true         | M        |
| HITL-05 | Checkpoint mode     | Agent pauses at defined checkpoint; posts checkpoint summary to HITL queue; resumes only on executive action          | M        |
| HITL-06 | Autonomous mode     | Agent executes and delivers completion report to dashboard; no blocking approval gate; all actions still audit-logged | S        |
| HITL-07 | Queue notifications | In-app notification on new HITL item; optional email digest (configurable: immediate / hourly / daily)                | M        |
| HITL-08 | Mode enforcement    | HITL mode enforced server-side; no agent can bypass HITL queue regardless of task type                                | M        |

## 4.4 Agent Task Execution

| ID      | Requirement         | Specification                                                                                                                      | Priority                        |
| ------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| TASK-01 | Task creation       | Natural language prompt → task record: {id, agent_id, prompt, status, created_at, context[]}; stored to database                   | M                               |
| TASK-02 | Context injection   | Agent retrieves relevant executive context before execution: Voice Profile, recent outputs, integration data, task history         | M                               |
| TASK-03 | Execution isolation | Each agent task runs in isolated execution context; no shared mutable state between concurrent tasks                               | M                               |
| TASK-04 | Status tracking     | Task status transitions: queued → in_progress → (at_checkpoint?) → complete                                                        | failed; every transition logged | M   |
| TASK-05 | Retry on failure    | Transient failures (network, rate limit): exponential backoff, max 3 retries; permanent failures: logged and surfaced to dashboard | M                               |
| TASK-06 | Output storage      | All task outputs stored with full metadata: {task_id, agent_id, model_used, prompt_version, output, tokens_used, duration_ms}      | M                               |
| TASK-07 | Parallel execution  | Multiple agent tasks execute concurrently; no cross-task blocking unless explicit dependency defined                               | S                               |

## 4.5 Morning Brief Generation

| ID    | Requirement                | Specification                                                                                                                                                        | Priority |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| MB-01 | Scheduled generation       | Cron job triggers at 05:30 executive local time; brief delivered by 06:00                                                                                            | M        |
| MB-02 | Brief composition          | Sections: Calendar summary (today + tomorrow), HITL queue count + priority items, Email digest (flagged items), Pending decisions, Agent task status, Priority flags | M        |
| MB-03 | Personalization            | Brief structure and depth calibrated to executive's stated preferences from onboarding                                                                               | M        |
| MB-04 | Integration data freshness | Calendar and email data fetched within 30 minutes of brief generation; stale data flagged                                                                            | M        |
| MB-05 | Brief persistence          | Each daily brief stored; accessible from dashboard for 30-day rolling window                                                                                         | S        |

# 5. Data Requirements

## 5.1 Core Data Entities

| Entity                         | Key Fields                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Executive                      | id, name, email, organization, title, domain, created_at, onboarding_status, voice_profile_id, preferences                            |
| Executive Intelligence Profile | id, executive_id, version, time_drains[], delegation_candidates[], communication_style, tools[], created_at                           |
| Voice Profile                  | id, executive_id, version, tone, formality, sentence_length, vocabulary_level, salutations, structural_preferences, created_at        |
| Agent                          | id, executive_id, name, description, responsibilities[], hitl_mode, status (active/archived), created_at, updated_at                  |
| Task                           | id, agent_id, executive_id, prompt, status, context_snapshot, created_at, completed_at, retry_count                                   |
| Task Output                    | id, task_id, model_provider, model_id, prompt_version, output_text, tokens_input, tokens_output, duration_ms, hitl_status, created_at |
| HITL Queue Item                | id, task_output_id, executive_id, status, original_output, final_output, rejection_reason, actioned_at, actioned_by                   |
| Audit Log Entry                | id, timestamp, actor_id, actor_role, entity_type, entity_id, action, input_snapshot, output_snapshot, ip_address                      |
| Morning Brief                  | id, executive_id, date, content, sections_json, generated_at, read_at                                                                 |
| Integration Token              | id, executive_id, provider, access_token_encrypted, refresh_token_encrypted, scopes[], expires_at                                     |

## 5.2 Data Classification

| Classification   | Examples                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| Highly Sensitive | Integration tokens, executive communications, task outputs, Voice Profile |
| Sensitive        | Executive Intelligence Profile, agent configurations, HITL decisions      |
| Internal         | Morning briefs, task status, agent definitions                            |
| Operational      | Audit logs, system metrics, error logs                                    |

# 6. Performance Requirements

| Requirement                                  | Target                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| Dashboard page load (p95)                    | ≤ 2.0 seconds                                                               |
| HITL queue load (p95)                        | ≤ 1.0 second                                                                |
| Agent task initiation to first token output  | ≤ 30 seconds (standard tasks)                                               |
| Morning brief generation                     | Complete by 06:00 executive local time; generation window: 05:30–06:00      |
| Email/calendar data sync freshness           | ≤ 30 minutes for morning brief; ≤ 5 minutes for real-time dashboard updates |
| API response time — non-AI endpoints (p95)   | ≤ 300ms                                                                     |
| HITL action processing time (approve/reject) | ≤ 500ms                                                                     |
| System availability                          | 99.5% uptime (excluding scheduled maintenance windows)                      |
| Concurrent users — MVP                       | 1,000 concurrent authenticated sessions                                     |
| Audit log write latency                      | ≤ 100ms; must not block primary request path                                |

# 7. Security Requirements

| Requirement               | Specification                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret management         | All API keys, OAuth secrets, and database credentials stored exclusively in .env files; never in code, config files, or version control; CI/CD pipeline enforces this via secret scanning |
| Encryption at rest        | AES-256 for all sensitive and highly sensitive data fields; database-level encryption enabled                                                                                             |
| Encryption in transit     | TLS 1.3 minimum for all connections; no TLS 1.1 or 1.2 permitted                                                                                                                          |
| Integration token storage | OAuth access and refresh tokens encrypted before persistence; decrypted only at point of use; never logged                                                                                |
| Input validation          | All user and API inputs validated server-side; parameterized queries only; no dynamic SQL construction                                                                                    |
| Output sanitization       | All LLM outputs sanitized before rendering in UI; HTML escaping enforced; no raw LLM output injected into DOM                                                                             |
| Rate limiting             | API rate limits enforced per authenticated user; LLM provider rate limits handled with backoff and queue                                                                                  |
| Audit logging             | All authentication events, HITL actions, integration access, and agent executions logged immutably; log integrity protected                                                               |
| Dependency scanning       | Automated vulnerability scanning on every build; critical/high CVEs block deployment                                                                                                      |
| CORS policy               | Strict CORS origin whitelist; no wildcard origins in production                                                                                                                           |

# 8. Design Constraints

| Constraint             | Specification                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model agnosticism      | No LLM provider SDK may be called directly from business logic. All inference must route through the provider-agnostic adapter layer. Provider changes require only .env update.                                        |
| API-first integrations | All third-party integrations must use published REST APIs. MCP connections permitted only where no REST API equivalent exists and must be documented with justification in NYXOR-API-001.                               |
| .env enforcement       | No secret, credential, or API key may appear in source code, configuration files, or version control history. Enforced by pre-commit hook and CI/CD pipeline check.                                                     |
| HITL hard constraint   | No agent may execute an external action (send email, post to Slack, modify calendar) without an approved HITL queue record. This constraint is enforced at the application layer and cannot be bypassed by agent logic. |
| Modularity             | Each system layer (presentation, application, AI orchestration, integration, persistence) must be independently deployable and replaceable without requiring changes to other layers.                                   |
| No vendor lock-in      | Database: PostgreSQL-compatible only. Cloud: provider-agnostic infrastructure-as-code. Frontend: no proprietary component libraries. AI: provider-agnostic adapter required.                                            |

# 9. Document Approval

| Role        | Name                                                        |
| ----------- | ----------------------------------------------------------- |
| Author      | Francis Ogbogu — Chief AI Officer                           |
| Reviewer    | Valtara Engineering Lead                                    |
| Approver    | Francis Ogbogu — Chief AI Officer                           |
| Date Issued | August 2026                                                 |
| Next Review | Upon material change to system architecture or requirements |

_NYXOR-SRS-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
