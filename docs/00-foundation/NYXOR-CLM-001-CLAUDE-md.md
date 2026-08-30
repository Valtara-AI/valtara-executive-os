**VALTARA AI**

**Nyxor**

**CLAUDE.md — AI CONTEXT FILE**

NYXOR-CLM-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-CLM-001                                                                              |
| -------------- | ------------------------------------------------------------------------------------------ |
| Version        | 1.0                                                                                        |
| Status         | Active — Initialized after all 23 pre-build documents complete                             |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                                              |
| Purpose        | Provides Claude Code with full project context, architectural constraints, and conventions |
| Date           | August 2026                                                                                |
| File Location  | Repository root: /CLAUDE.md                                                                |
| Classification | Internal — Committed to repository                                                         |

# 1. Purpose of This Document

This document (NYXOR-CLM-001) serves two purposes: (1) it is the governance record of the CLAUDE.md file, capturing its rationale and content specification; (2) the actual CLAUDE.md markdown file in the repository root is the working artifact that Claude Code reads. Both must be kept in sync.

CLAUDE.md is the last document initialized in the NYXOR pre-build suite. It synthesizes the entire documentation corpus into a single context file that gives Claude Code precise, grounded instructions for building this system. It replaces tribal knowledge with documented constraint.

# 2. CLAUDE.md Content — Full Specification

The following is the canonical content of the CLAUDE.md file. This is the exact text committed to the repository root.

## ── CLAUDE.md (Repository Root) ──

**# Nyxor — Claude Code Context**

## Project Identity

- Product: Nyxor

- Owner: Francis Ogbogu — Chief AI Officer, Valtara AI

- Organization: Valtara Inc. (Valtara AI), Saskatoon, Saskatchewan, Canada

- Repo: github.com/blu-geek / Valtara org

- Contact: fcogbogu@gmail.com | linkedin.com/in/francis-ogbogu

## What This System Is

NYXOR is a domain-agnostic, AI-powered Executive Operating System.

Three layers: Onboarding Agent → Executive Dashboard → Dynamic Agent Workforce.

The Onboarding Agent interviews each executive and dynamically provisions a

custom AI agent workforce specific to their role. All agent actions are governed

by a structured Human-in-the-Loop (HITL) framework.

Every output is calibrated to the executive's Voice Profile.

## Non-Negotiable Architectural Constraints

These constraints are absolute. No task, optimization, or shortcut overrides them.

1. MODEL AGNOSTIC: All LLM inference routes through InferenceProvider adapter.

No provider SDK (OpenAI, Anthropic, Google, etc.) called directly in business logic.

Provider set via LLM_PROVIDER env var only.

2. API FIRST: All integrations use published REST APIs.

MCP only where no REST API exists. Each MCP exception documented in

docs/01-technical/NYXOR-API-001 Section 6. No undocumented MCP connections.

3. SECRETS IN .ENV ONLY: No credential, API key, or secret in source code,

config files, or version control. .env always in .gitignore.

Pre-commit hook enforced. CI secret scan enforced.

4. HITL IS ARCHITECTURAL: No agent may trigger an external action

(send email, post to Slack, modify calendar) without an approved HITL

queue record. Enforced at application layer via database constraint.

This cannot be bypassed. It cannot be made optional.

5. NO VENDOR LOCK-IN: PostgreSQL-compatible database only.

Provider-agnostic infrastructure. No proprietary managed services

that cannot be migrated. Docker-deployable backend.

## Technology Stack

Frontend: Next.js 14 (App Router) + React 18 + TypeScript

Styling: Tailwind CSS + Shadcn/UI

Backend: Node.js 20 LTS + TypeScript

Database: PostgreSQL 15 via Supabase + Drizzle ORM

Queue: BullMQ + Redis

Auth: NextAuth.js v5 — Google + Microsoft OAuth 2.0

AI Adapter: Custom InferenceProvider (see packages/ai-orchestrator/)

Deployment: Vercel (frontend) + Railway/Fly.io (backend) + Docker

CI/CD: GitHub Actions

Monitoring: OpenTelemetry + Pino structured logging

## Repository Structure

valtara-executive-os/

├── apps/

│ ├── web/ # Next.js frontend

│ └── api/ # Node.js backend API

├── packages/

│ ├── ai-orchestrator/ # InferenceProvider adapter layer

│ ├── integrations/ # Gmail, Outlook, Calendar, Slack adapters

│ ├── database/ # Drizzle schema, migrations

│ ├── audit/ # Audit logging service

│ └── shared/ # Shared types and utilities

├── prompts/ # Versioned Handlebars prompt templates

├── docs/ # All 23 pre-build governance documents

│ ├── 00-foundation/

│ ├── 01-technical/

│ ├── 02-ai-governance/

│ ├── 03-security-compliance/

│ ├── 04-build-governance/

│ └── 05-handoff/

├── .github/workflows/ # CI/CD pipeline definitions

├── docker-compose.yml # Local development stack

├── .env.example # Template — no real values

├── .gitignore # .env always listed

└── CLAUDE.md # This file

## Code Conventions

- TypeScript strict mode throughout. No `any` without justification.

- ESLint + Prettier enforced. Run `npm run lint` before committing.

- All LLM calls: InferenceProvider adapter only. Never direct SDK calls.

- All DB queries: Drizzle ORM. No raw SQL without Engineering Lead approval.

- All prompts: Handlebars templates in /prompts/. No inline prompt strings.

- Logging: Pino JSON only. No console.log. No PII in logs.

- Errors: explicit types. No unhandled rejections.

- Tests: Vitest (unit/integration), Playwright (E2E).

Target: ≥80% branch coverage on business logic.

100% coverage on HITL enforcement code.

## Key Data Entities (Quick Reference)

Executive — id, name, email, organization, title, domain

IntelligenceProfile — id, executive_id, version, time_drains[], tools[]

VoiceProfile — id, executive_id, version, tone, formality, structure

Agent — id, executive_id, name, hitl_mode, status

Task — id, agent_id, prompt, status, context_snapshot

TaskOutput — id, task_id, model, output, tokens, hitl_status

HITLQueueItem — id, task_output_id, status, original, final, actioned_by

AuditLogEntry — id, timestamp, actor_id, action, input_hash, output_hash

MorningBrief — id, executive_id, date, content, generated_at

IntegrationToken — id, executive_id, provider, access_token_enc, scopes[]

## HITL Mode Reference

Auto-Draft→Review: Agent completes → HITL queue → executive approves/edits/rejects

Checkpoint: Agent pauses at milestones → HITL queue → resumes on approval

Autonomous+Report: Agent executes → completion report → executive reviews outcome

HITL mode is configurable per agent. Mode change takes effect on next task.

External actions (send, post, modify) blocked at DB level without approved HITL record.

## API Conventions

Base URL: /api/v1/

Auth: Bearer JWT in Authorization header (httpOnly cookie in browser)

Response: {success: boolean, data: object|null, error: object|null}

Errors: {success: false, error: {code, message, details?}}

Pagination: Cursor-based: {data: [], nextCursor: string|null, total: number}

## .env Variables (Key Subset — see .env.example for full list)

LLM_PROVIDER # openai | anthropic | google | mistral | groq

LLM_MODEL_DEFAULT # Default model for agent tasks

LLM_MODEL_ANALYSIS # Higher-capability model for research/analysis

DATABASE_URL # PostgreSQL connection string

DB_ENCRYPTION_KEY # AES-256-GCM key for field-level encryption

REDIS_URL # Redis connection string

GOOGLE_CLIENT_ID/SECRET # Google OAuth credentials

MICROSOFT_CLIENT_ID/SECRET # Microsoft OAuth credentials

SLACK_CLIENT_ID/SECRET # Slack OAuth credentials

## Decision Log

All significant architectural decisions are logged in:

docs/04-build-governance/NYXOR-DL-001-Decision-Log.docx

Before making a significant design decision, check the Decision Log.

After making one, add an entry. Format: DL-[CATEGORY]-[NUMBER].

## Pre-Build Documentation Suite

23 governance documents in docs/. All completed before Sprint 1.

Key references:

NYXOR-SRS-001 — System behavior specification

NYXOR-SAD-001 — Architecture and technology decisions

NYXOR-API-001 — API contracts and .env template

NYXOR-ETF-001 — Ethical constraints (prohibited behaviors)

NYXOR-SEC-001 — Security controls

NYXOR-DL-001 — Decision log (living document)

## Sprint Plan

Sprint 1: Scaffold, auth, onboarding agent conversation engine

Sprint 2: Agent workforce activation, Voice Profile, HITL engine

Sprint 3: Executive dashboard, morning brief

Sprint 4: Gmail + Google Calendar integration

Sprint 5: Outlook Mail + Calendar integration

Sprint 6: Slack, audit log, compliance export

Sprint 7: Performance hardening, security review, UAT

Sprint 8: Pilot launch, monitoring, on-call

## What Claude Code Must Never Do

- Call an LLM provider SDK directly in business logic

- Put any secret, API key, or credential in source code

- Allow an agent to send/post/modify externally without HITL approval

- Use MCP where a REST API exists without CAO approval and DL entry

- Write raw SQL queries without Engineering Lead approval

- Put console.log or PII in production logging code

- Deploy to production without passing all CI pipeline stages

# 3. Maintenance Policy

CLAUDE.md is a living document. It must be updated when:

- A new technology is added to the stack
- A new architectural constraint is established (add to Decision Log first)
- A new package or module is added to the monorepo
- A new environment variable is required
- The sprint plan changes materially

The docx governance record (NYXOR-CLM-001) must be updated in parallel with the CLAUDE.md markdown file. Both are kept in sync at all times.

# 4. Document Approval

| Role             | Name                                                           |
| ---------------- | -------------------------------------------------------------- |
| Author           | Francis Ogbogu — Chief AI Officer                              |
| Approver         | Francis Ogbogu — Chief AI Officer                              |
| Date Initialized | August 2026                                                    |
| Condition        | Initialized only after all 22 preceding documents are complete |

_NYXOR-CLM-001 · Version 1.0 · August 2026 · Internal — Committed to Repository_
