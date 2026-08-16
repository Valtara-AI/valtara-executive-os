# Valtara Executive OS (VEX-OS) — Claude Code Context

## Project Identity
- **Product:** Valtara Executive OS (VEX-OS)
- **Owner:** Francis Ogbogu — Chief AI Officer, Valtara AI
- **Organization:** Valtara Inc. (Valtara AI), Saskatoon, Saskatchewan, Canada
- **Repo:** github.com/blu-geek / Valtara org
- **Contact:** fcogbogu@gmail.com | linkedin.com/in/francis-ogbogu

---

## What This System Is

VEX-OS is a domain-agnostic, AI-powered Executive Operating System comprising three integrated layers:

1. **Onboarding Agent** — interviews each executive; generates Executive Intelligence Profile; dynamically provisions a custom AI agent workforce specific to their role, industry, and function
2. **Executive Dashboard** — personalized command center: morning briefs, HITL queue, task status, decision inbox, calendar intelligence
3. **Dynamic Agent Workforce** — custom AI agents that execute delegated work under a configurable HITL governance model; all outputs calibrated to the executive's Voice Profile

---

## Non-Negotiable Architectural Constraints

These are absolute. No task, optimization, or shortcut overrides them.

### 1. MODEL AGNOSTIC
All LLM inference routes through the `InferenceProvider` adapter in `packages/ai-orchestrator/`.
No provider SDK (OpenAI, Anthropic, Google, Mistral, Groq) called directly in business logic.
Provider selected via `LLM_PROVIDER` env var only.

### 2. API FIRST
All integrations use published REST APIs.
MCP connections permitted only where no REST API exists.
Each MCP exception must be documented in `docs/01-technical/VEX-OS-API-001` Section 6 with CAO approval before implementation.

### 3. SECRETS IN .ENV ONLY
No credential, API key, or secret in source code, config files, or version control.
`.env` always in `.gitignore`. Pre-commit hook enforced. CI secret scan enforced.

### 4. HITL IS ARCHITECTURAL
No agent may trigger an external action (send email, post to Slack, modify calendar) without an approved HITL queue record.
Enforced at the application layer via database constraint.
This cannot be bypassed. It cannot be made optional.

### 5. NO VENDOR LOCK-IN
PostgreSQL-compatible database only. Provider-agnostic infrastructure.
No proprietary managed services that cannot be migrated. Docker-deployable backend.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS + Shadcn/UI |
| Backend | Node.js 20 LTS + TypeScript |
| Database | PostgreSQL 15 via Supabase + Drizzle ORM |
| Queue | BullMQ + Redis |
| Auth | NextAuth.js v5 — Google + Microsoft OAuth 2.0 |
| AI Adapter | Custom InferenceProvider (packages/ai-orchestrator/) |
| Deployment | Vercel (frontend) + Railway/Fly.io (backend) + Docker |
| CI/CD | GitHub Actions |
| Monitoring | OpenTelemetry + Pino structured logging |

---

## Repository Structure

```
valtara-executive-os/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Node.js backend API
├── packages/
│   ├── ai-orchestrator/  # InferenceProvider adapter layer
│   ├── integrations/     # Gmail, Outlook, Calendar, Slack adapters
│   ├── database/         # Drizzle schema, migrations, seed
│   ├── audit/            # Audit logging service
│   └── shared/           # Shared types, utilities, constants
├── prompts/              # Versioned Handlebars prompt templates
├── docs/                 # All 23 pre-build governance documents
│   ├── 00-foundation/
│   ├── 01-technical/
│   ├── 02-ai-governance/
│   ├── 03-security-compliance/
│   ├── 04-build-governance/
│   └── 05-handoff/
├── .github/workflows/    # CI/CD pipeline definitions
├── docker-compose.yml    # Local development stack
├── .env.example          # Template — no real values ever
├── .gitignore            # .env always listed here
└── CLAUDE.md             # This file
```

---

## Code Conventions

- TypeScript strict mode throughout. No `any` without documented justification.
- ESLint + Prettier enforced. Run `npm run lint` before committing.
- **All LLM calls: `InferenceProvider` adapter only. Never direct SDK calls.**
- All DB queries: Drizzle ORM. No raw SQL without Engineering Lead approval.
- All prompts: Handlebars templates in `/prompts/`. No inline prompt strings in business logic.
- Logging: Pino JSON only. No `console.log` in production code. No PII in logs.
- Errors: explicit error types. No unhandled promise rejections.
- Tests: Vitest (unit/integration), Playwright (E2E). Target: ≥80% branch coverage on business logic; 100% on HITL enforcement code.

---

## Key Data Entities

```typescript
Executive           { id, name, email, organization, title, domain, onboarding_status }
IntelligenceProfile { id, executive_id, version, time_drains[], delegation_candidates[], communication_style, tools[] }
VoiceProfile        { id, executive_id, version, tone, formality, sentence_length, vocabulary_level }
Agent               { id, executive_id, name, description, responsibilities[], hitl_mode, status }
Task                { id, agent_id, executive_id, prompt, status, context_snapshot, created_at }
TaskOutput          { id, task_id, model_provider, model_id, output_text, tokens_input, tokens_output, hitl_status }
HITLQueueItem       { id, task_output_id, executive_id, status, original_output, final_output, actioned_by, actioned_at }
AuditLogEntry       { id, timestamp, actor_id, actor_role, entity_type, entity_id, action, input_hash, output_hash }
MorningBrief        { id, executive_id, date, content, sections_json, generated_at }
IntegrationToken    { id, executive_id, provider, access_token_encrypted, refresh_token_encrypted, scopes[], expires_at }
```

---

## HITL Mode Reference

| Mode | Behaviour |
|---|---|
| Auto-Draft → Review | Agent completes task → output held in HITL queue → executive approves / edits / rejects |
| Checkpoint | Agent pauses at defined milestones → HITL queue entry → resumes only on executive action |
| Autonomous + Report | Agent executes fully → completion report delivered to dashboard → executive reviews outcome |

HITL mode is configurable per agent. Mode change takes effect on next task.
External actions (send email, post to Slack, modify calendar) blocked at database level without an approved HITL record.

---

## API Conventions

```
Base URL:      /api/v1/
Auth:          Bearer JWT in Authorization header (httpOnly cookie in browser)
Request:       JSON body for POST/PATCH/PUT; query params for GET filters
Response:      { success: boolean, data: object | null, error: object | null }
Errors:        { success: false, error: { code: string, message: string, details?: object } }
Pagination:    { data: [], nextCursor: string | null, total: number }
```

---

## .env Variables (Key Subset — see .env.example for full list)

```bash
LLM_PROVIDER=anthropic              # openai | anthropic | google | mistral | groq
LLM_MODEL_DEFAULT=                  # Default model for agent tasks
LLM_MODEL_ANALYSIS=                 # Higher-capability model for research/analysis
LLM_MODEL_DRAFT=                    # Cost-efficient model for draft tasks
DATABASE_URL=                       # PostgreSQL connection string
DB_ENCRYPTION_KEY=                  # AES-256-GCM key for field-level encryption
REDIS_URL=                          # Redis connection string
GOOGLE_CLIENT_ID=                   # Google OAuth
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=                # Microsoft OAuth
MICROSOFT_CLIENT_SECRET=
SLACK_CLIENT_ID=                    # Slack OAuth
SLACK_CLIENT_SECRET=
ANTHROPIC_API_KEY=                  # Set whichever provider is active
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
```

---

## Decision Log

All significant architectural decisions are logged in:
`docs/04-build-governance/VEX-OS-DL-001-Decision-Log.docx`

Before making a significant design decision, check the Decision Log.
After making one, add an entry. Format: `DL-[CATEGORY]-[NUMBER]`.

---

## Pre-Build Documentation Suite

23 governance documents in `docs/`. All completed before Sprint 1.

| Key Document | Purpose |
|---|---|
| VEX-OS-SRS-001 | System behavior specification |
| VEX-OS-SAD-001 | Architecture and technology decisions |
| VEX-OS-API-001 | API contracts and .env template |
| VEX-OS-ETF-001 | Ethical constraints and prohibited behaviors |
| VEX-OS-SEC-001 | Security controls |
| VEX-OS-DMP-001 | Data management and classification |
| VEX-OS-DL-001 | Decision log (living document) |

---

## Sprint Plan

| Sprint | Focus |
|---|---|
| 1 | Project scaffold, auth, onboarding agent conversation engine |
| 2 | Agent workforce activation, Voice Profile extraction, HITL engine |
| 3 | Executive dashboard, morning brief generation |
| 4 | Gmail + Google Calendar integration |
| 5 | Outlook Mail + Calendar integration |
| 6 | Slack integration, audit log, compliance export |
| 7 | Performance hardening, security review, UAT |
| 8 | Pilot launch, monitoring, on-call rotation |

---

## What Claude Code Must Never Do

- Call an LLM provider SDK directly in business logic (use `InferenceProvider` only)
- Put any secret, API key, or credential in source code or committed files
- Allow an agent to send, post, or modify external data without an approved HITL record
- Use MCP where a REST API exists — without CAO approval and Decision Log entry
- Write raw SQL queries without Engineering Lead approval
- Put `console.log` or PII in production logging code
- Deploy to production without all CI pipeline stages passing
- Add a new integration without checking VEX-OS-API-001 for the MCP exception register
