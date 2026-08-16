**VALTARA AI**

**Valtara Executive OS**

**SYSTEM ARCHITECTURE DOCUMENT**

VEX-OS-SAD-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-SAD-001 |
| --- | --- |
| Version | 1.0 |
| Status | Draft — Internal Review |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | Engineering, Architecture, DevOps, Security |
| Date | August 2026 |
| Depends On | VEX-OS-SRS-001, VEX-OS-PRD-001 |
| Referenced By | VEX-OS-DMP-001, VEX-OS-API-001, VEX-OS-SEC-001, VEX-OS-DST-001 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Scope

This System Architecture Document (SAD) defines the architectural design of Valtara Executive OS (VEX-OS). It specifies the system's structural decomposition, component responsibilities, data flows, technology stack decisions, integration patterns, and the architectural principles that govern all implementation decisions.

This document is the authoritative reference for all engineering and infrastructure decisions. Any deviation from the architecture defined here requires a Decision Log entry (VEX-OS-DL-001) with rationale, and an update to this document.

# 2. Architectural Principles

All architectural decisions in VEX-OS are governed by the following principles, listed in order of precedence:

| Principle | Architectural Implication |
| --- | --- |
| Model agnosticism | All LLM inference routes through a provider-agnostic adapter. No provider SDK called directly in business logic. Provider selection via .env configuration only. |
| API-first integrations | All third-party integrations use published REST APIs. MCP connections used only where no REST API exists; each such exception documented in VEX-OS-API-001. |
| Secret isolation | All credentials in .env; never in source code or version control. Enforced by pre-commit hook and CI/CD secret scan. |
| HITL as architectural constraint | No agent may trigger an external action without an approved HITL record. Enforced at application layer; not a policy guideline. |
| Modularity | Each layer independently deployable and replaceable. No cross-layer hard dependencies. Interfaces defined by contract, not implementation. |
| Platform agnosticism | Infrastructure defined as code using provider-neutral tooling. No proprietary managed services that cannot be migrated. PostgreSQL-compatible database only. |
| Migration-friendliness | All data exportable in open formats (JSON, CSV). No proprietary data formats. Schema versioned with reversible migrations. |
| Observability by design | Structured logging, distributed tracing, and metrics collection built in from Sprint 1. Not added post-facto. |

# 3. System Architecture Overview

**3.1 Architecture Style**

VEX-OS uses a layered monolith architecture for the MVP, with clean internal boundaries that enable extraction to microservices at scale. This decision prioritizes development velocity and operational simplicity in the early stage while preserving architectural optionality.

The system is organized into six discrete layers, each with defined responsibilities and explicit contracts with adjacent layers. No layer accesses another layer's internal implementation — only its published interface.

**3.2 Layer Diagram (Text Representation)**

From client to data, the system flows through the following layers:

┌─────────────────────────────────────────────────────────────┐

│               PRESENTATION LAYER                            │

│   React SPA · Tailwind CSS · Shadcn/UI · Server-Side Render │

├─────────────────────────────────────────────────────────────┤

│               APPLICATION LAYER                             │

│   Node.js · TypeScript · REST API · Session · HITL Engine   │

├─────────────────────────────────────────────────────────────┤

│               AI ORCHESTRATION LAYER                        │

│   Provider Adapter · Prompt Engine · Voice Profile · Agents │

├─────────────────────────────────────────────────────────────┤

│               INTEGRATION ADAPTER LAYER                     │

│   Gmail · Outlook · Google Cal · Outlook Cal · Slack        │

├─────────────────────────────────────────────────────────────┤

│               DATA PERSISTENCE LAYER                        │

│   PostgreSQL (Supabase) · Vector Store · Encrypted Secrets  │

├─────────────────────────────────────────────────────────────┤

│               AUDIT & COMPLIANCE LAYER                      │

│   Immutable Audit Log · Event Stream · Compliance Export     │

└─────────────────────────────────────────────────────────────┘

# 4. Layer Specifications

## 4.1 Presentation Layer

| Attribute | Specification |
| --- | --- |
| Framework | React 18+ with TypeScript; functional components and hooks only; no class components |
| Styling | Tailwind CSS for utility classes; Shadcn/UI for accessible component primitives; no proprietary component library |
| State management | Zustand for global client state; React Query (TanStack Query) for server state and caching; no Redux |
| Routing | React Router v6; declarative route definitions; protected routes enforced client-side and server-side |
| Build tooling | Vite; TypeScript strict mode; ESLint + Prettier enforced in CI |
| Server-side rendering | Next.js for initial page load of dashboard (SEO not required; SSR used for performance only) |
| Accessibility | Radix UI primitives via Shadcn/UI ensure ARIA compliance; all custom components tested against WCAG 2.1 AA |
| Dark/light mode | CSS custom properties (variables) for all color tokens; theme toggled via data-theme attribute on root element |

## 4.2 Application Layer

| Attribute | Specification |
| --- | --- |
| Runtime | Node.js 20 LTS with TypeScript; compiled to ESM; strict TypeScript configuration |
| Framework | Hono (lightweight, edge-compatible) or Express 5 — decision to be logged in VEX-OS-DL-001 before Sprint 1 |
| API style | REST; versioned at /api/v1/; JSON request and response bodies; OpenAPI 3.1 specification generated from code |
| Authentication middleware | JWT validation on every authenticated route; RBAC enforcement via route-level middleware |
| HITL Engine | Dedicated module within application layer; queue management, state machine for HITL status transitions, notification dispatch |
| Background jobs | BullMQ with Redis for task queuing; morning brief generation scheduled via cron; agent task execution dispatched via queue |
| Error handling | Centralized error handler; structured error responses {code, message, details}; no stack traces in production responses |
| Logging | Pino for structured JSON logging; log levels: error, warn, info, debug; no PII in application logs |

## 4.3 AI Orchestration Layer

| Attribute | Specification |
| --- | --- |
| Provider adapter | Abstract interface: InferenceProvider {complete(prompt, options): Promise<InferenceResult>}; concrete implementations: OpenAIProvider, AnthropicProvider, GoogleProvider; selected via LLM_PROVIDER env var |
| Model routing | Per-task model configuration via env vars: LLM_MODEL_DRAFT, LLM_MODEL_ANALYSIS, LLM_MODEL_ONBOARDING; defaults defined in code; overridable per deployment |
| Prompt management | All prompts stored as versioned Handlebars templates in /prompts directory; no inline prompt strings in business logic; prompt version recorded with every LLM call |
| Voice Profile injection | VoiceProfileContext block appended to system prompt on every agent generation call; format: structured JSON serialized to natural language description |
| Context assembly | ContextAssembler module retrieves: executive profile, recent task outputs, integration data, conversation history; assembled before every agent inference call |
| Token budget | Max input/output tokens defined per task type in configuration; enforced before API call; tasks exceeding budget split or summarized |
| Provider failover | If primary provider returns 5xx or 429 and secondary provider configured: automatic retry with secondary; failover event logged; alert triggered |
| Response validation | Schema validation (Zod) on structured LLM responses; retry with clarifying prompt on validation failure; max 3 retries before task marked failed |

## 4.4 Integration Adapter Layer

| Integration | Adapter Specification |
| --- | --- |
| Gmail | GoogleMailAdapter: OAuth 2.0 token management; read (threads, messages, labels); draft creation; send (HITL-gated); token refresh automated; scopes: gmail.readonly, gmail.compose, gmail.send |
| Google Calendar | GoogleCalendarAdapter: read events, attendees, conference links; create/update events (HITL-gated); free/busy queries; scopes: calendar.readonly, calendar.events |
| Outlook Mail | MicrosoftMailAdapter: MSAL token management; read mail folders, messages; draft creation; send (HITL-gated); scopes: Mail.Read, Mail.ReadWrite, Mail.Send |
| Outlook Calendar | MicrosoftCalendarAdapter: read events and calendars; create/update (HITL-gated); free/busy; scopes: Calendars.Read, Calendars.ReadWrite |
| Slack | SlackAdapter: read channel list, message history; post message (HITL-gated); scopes: channels:read, chat:write |
| Common pattern | All adapters implement IntegrationAdapter interface; token storage encrypted in DB; refresh handled transparently; rate limit backoff built in; each adapter independently testable with mock transport |

## 4.5 Data Persistence Layer

| Component | Specification |
| --- | --- |
| Primary database | PostgreSQL 15+ via Supabase; connection pooling via PgBouncer; schema managed by Drizzle ORM; all migrations versioned and reversible |
| ORM | Drizzle ORM with TypeScript type safety; no raw SQL in application code except for complex analytics queries; all queries reviewed for injection risk |
| Vector store | pgvector extension on PostgreSQL; used for semantic retrieval of executive context and task history; embedding model: text-embedding-3-small (OpenAI) or equivalent via adapter |
| Caching | Redis via Upstash or self-hosted; session store; BullMQ job queue; dashboard data cache with 5-minute TTL; cache invalidated on integration data update |
| File storage | Supabase Storage for agent-generated documents and attachments; signed URLs for time-limited access; files never served directly from application server |
| Secret storage | OAuth tokens stored encrypted (AES-256-GCM) in database; encryption key in .env (DB_ENCRYPTION_KEY); key rotation procedure documented in VEX-OS-SEC-001 |

## 4.6 Audit & Compliance Layer

| Component | Specification |
| --- | --- |
| Audit log store | Append-only PostgreSQL table with row-level security; no UPDATE or DELETE permitted on audit records; table separate from application database schema |
| Event capture | AuditLogger service called from application layer on: authentication events, HITL actions, integration access, agent task starts/completions, admin actions |
| Log schema | {id UUID, timestamp TIMESTAMPTZ, actor_id UUID, actor_role TEXT, entity_type TEXT, entity_id UUID, action TEXT, input_hash TEXT, output_hash TEXT, metadata JSONB}; full input/output stored separately with reference hash |
| Retention | Audit records retained minimum 24 months; automated archival to cold storage after 24 months; deletion only by compliance officer action |
| Export | Compliance export endpoint produces CSV and JSON; date-range and entity-type filters; accessible to Administrator role only; export event itself audit-logged |
| Integrity | Each audit record includes SHA-256 hash of previous record (chain integrity); integrity verification job runs nightly |

# 5. Technology Stack

| Component | Selected Technology | Rationale |
| --- | --- | --- |
| Frontend framework | React 18 + TypeScript | Industry standard; large ecosystem; TypeScript for type safety |
| Frontend build | Next.js 14 (App Router) | SSR for performance; file-based routing; Vercel-optimized but not Vercel-dependent |
| Styling | Tailwind CSS + Shadcn/UI | Utility-first; accessible primitives; no proprietary dependency |
| Backend runtime | Node.js 20 LTS + TypeScript | Consistent language across stack; strong async model for LLM calls |
| Database | PostgreSQL 15 via Supabase | Open standard; Supabase is PostgreSQL-compatible; migratable to any PG host |
| ORM | Drizzle ORM | TypeScript-native; schema-as-code; lightweight; PostgreSQL-first |
| Job queue | BullMQ + Redis | Production-grade; reliable task execution; scheduling support |
| Authentication | NextAuth.js v5 | OAuth 2.0 providers; JWT; extensible; no vendor lock-in |
| AI adapter | Custom provider-agnostic adapter | Required by architectural principle; no direct SDK dependency |
| Deployment | Vercel (frontend) + Railway/Fly.io (backend) | Fast deployment; no vendor lock-in for backend; migratable via Docker |
| Containerization | Docker + Docker Compose | Consistent environments; local dev parity; cloud-portable |
| CI/CD | GitHub Actions | Integrated with existing repo; secret scanning; no proprietary CI vendor |
| Monitoring | OpenTelemetry + self-hosted or Axiom | Open standard; provider-agnostic observability |
| Error tracking | Sentry | Industry standard; self-hostable; no PII in error payloads by policy |

# 6. Deployment Architecture

**6.1 Environment Strategy**

| Environment | Purpose & Configuration |
| --- | --- |
| Development (local) | Docker Compose; local PostgreSQL + Redis; .env.local with development credentials; no production data |
| Staging | Production-identical infrastructure; separate database; synthetic data only; used for QA, integration testing, and pre-release validation |
| Production | Full infrastructure; production database; real executive data; monitoring and alerting active; change management required for deployments |

**6.2 Directory Structure**

valtara-executive-os/

├── apps/

│   ├── web/              # Next.js frontend

│   └── api/              # Node.js backend API

├── packages/

│   ├── ai-orchestrator/  # Provider-agnostic LLM adapter layer

│   ├── integrations/     # Email, calendar, Slack adapters

│   ├── database/         # Drizzle schema, migrations, seed

│   ├── audit/            # Audit logging service

│   └── shared/           # Shared types, utilities, constants

├── prompts/              # Versioned prompt templates

├── docs/                 # All 23 pre-build documents

├── .github/workflows/    # CI/CD pipeline definitions

├── docker-compose.yml    # Local development stack

├── .env.example          # Template — never contains real values

├── .gitignore            # .env always listed here

└── CLAUDE.md             # Claude Code project context

# 7. Key Architecture Decisions

The following decisions have material impact on system structure. Each is logged in VEX-OS-DL-001 with full rationale. A summary is provided here for architectural reference.

| Decision | Choice Made | Primary Rationale |
| --- | --- | --- |
| Monolith vs microservices | Layered monolith for MVP | Development velocity; operational simplicity; clean boundaries allow future extraction |
| LLM provider strategy | Provider-agnostic adapter required | Architectural principle; no single-provider dependency; enforced by code review |
| Integration method | REST APIs only for MVP; MCP only with documented justification | Control, auditability, and vendor independence; MCP adds complexity without proportional benefit at this scale |
| Database | PostgreSQL via Supabase | Open standard; self-hostable; pgvector for semantic retrieval; Supabase provides managed ops without lock-in |
| ORM strategy | Drizzle ORM; schema-as-code | TypeScript-native type safety; migration control; no runtime overhead of heavy ORMs |
| Secret management | .env files only; CI enforcement | Simplest reliable approach; pre-commit hook prevents accidental commit; no secrets manager required at MVP scale |
| HITL enforcement point | Application layer; not agent layer | Agents cannot be trusted to enforce their own constraints; enforcement at application layer is auditable and reliable |
| Frontend framework | Next.js (App Router) | SSR performance for dashboard; file-based routing; Vercel-optimized but Docker-deployable; not Vercel-dependent |

# 8. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Reviewer | Valtara Engineering Lead |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date Issued | August 2026 |
| Next Review | Upon material change to architecture or stack selection |

*VEX-OS-SAD-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
