**VALTARA AI**

**Valtara Executive OS**

**DEVELOPER ONBOARDING GUIDE**

VEX-OS-DOG-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-DOG-001 |
| --- | --- |
| Version | 1.0 |
| Status | Active |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | New developers joining the VEX-OS build |
| Date | August 2026 |
| Goal | New developer fully operational within one working day |
| Classification | Confidential — Internal Use Only |

# 1. Before You Start

Read these three documents before touching any code. They define the constraints you must operate within:

1. CLAUDE.md (repository root) — architecture constraints, stack, conventions, what never to do

2. VEX-OS-SRS-001 (docs/01-technical/) — system behavior specification

3. VEX-OS-DL-001 (docs/04-build-governance/) — decision log; understand why key decisions were made

If any instruction you receive conflicts with CLAUDE.md or the pre-build documentation, flag it to the Engineering Lead before proceeding. Documentation is the source of truth.

# 2. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20 LTS |
| npm | 10+ |
| Docker Desktop | Latest stable |
| Git | 2.40+ |
| VS Code or Cursor | Latest |
| Claude Code (VS Code extension) | Latest |

# 3. Environment Setup

**Step 1 — Clone the repository**

git clone https://github.com/blu-geek/valtara-executive-os.git

cd valtara-executive-os

**Step 2 — Install dependencies**

npm install

**Step 3 — Configure environment**

cp .env.example .env

Open .env and populate with development credentials. Request development API keys from the Engineering Lead. Never use production credentials in development.

**Step 4 — Install pre-commit hook**

npm run prepare

This installs Husky. The pre-commit hook will block commits containing .env files or secret-pattern strings. It runs lint and type-check on staged files.

**Step 5 — Start local infrastructure**

docker-compose up -d

This starts PostgreSQL and Redis locally. Confirm both containers are running:

docker-compose ps

**Step 6 — Run database migrations**

npm run db:migrate

**Step 7 — Start development servers**

npm run dev

This starts the Next.js frontend (port 3000) and the Node.js API (port 3001) concurrently. Both hot-reload on file changes.

**Step 8 — Verify setup**

npm test

All tests should pass on a clean clone. If any fail, stop and notify the Engineering Lead before proceeding.

# 4. Opening in VS Code / Cursor with Claude Code

From the repository root:

code .

or

cursor .

Claude Code reads CLAUDE.md from the repository root automatically on session start. It will have full context of the architecture, constraints, and conventions. You do not need to explain the project to it — CLAUDE.md does that.

- If Claude Code proposes something that violates a constraint in CLAUDE.md, reject it and reference the constraint explicitly.
- If Claude Code asks which provider to use, the answer is always: use the InferenceProvider adapter; never a direct SDK call.

# 5. Codebase Orientation

**5.1 Where to Find Key Things**

| What you're looking for | Where it lives |
| --- | --- |
| InferenceProvider adapter (LLM calls) | packages/ai-orchestrator/src/providers/ |
| Prompt templates | prompts/ — Handlebars .hbs files, versioned |
| Integration adapters (Gmail, Outlook, etc.) | packages/integrations/src/adapters/ |
| Database schema | packages/database/src/schema.ts |
| Database migrations | packages/database/migrations/ |
| HITL engine | apps/api/src/services/hitl/ |
| API route handlers | apps/api/src/routes/ |
| Audit logger | packages/audit/src/ |
| Frontend dashboard pages | apps/web/src/app/ |
| Environment variable types | packages/shared/src/env.ts |
| All governance documents | docs/ — organized by folder |

**5.2 The HITL Flow (Critical to Understand)**

Every agent task that produces content for external use goes through this flow:

1. Agent task assigned via POST /api/v1/agents/:agentId/tasks

2. Task queued in BullMQ; worker picks it up; executes via InferenceProvider

3. Output stored in TaskOutput table; HITLQueueItem created (status: pending)

4. Executive reviews in dashboard HITL queue

5. Executive approves → HITLQueueItem.status = approved → downstream action triggered

6. Executive edits → original and final both stored → downstream action triggered

7. Executive rejects → HITLQueueItem.status = rejected → agent optionally retries

The database constraint that blocks external actions without an approved HITL record is in packages/database/src/schema.ts. Do not modify or remove it.

# 6. Development Workflow

**6.1 Starting a New Task**

1. Check the Decision Log (VEX-OS-DL-001) — has this been decided already?

2. Create a feature branch: git checkout -b feature/VEX-[ticket]-[description]

3. Make changes; run npm run lint and npm test frequently

4. If you make a significant design decision, add a Decision Log entry

5. Open a PR to develop; fill in the PR template; request review

**6.2 Common npm Scripts**

| Script | What it does |
| --- | --- |
| npm run dev | Start frontend + API in development mode with hot reload |
| npm test | Run all unit and integration tests |
| npm run test:e2e | Run Playwright E2E tests (requires dev server running) |
| npm run lint | Run ESLint + Prettier check |
| npm run lint:fix | Auto-fix lint issues |
| npm run type-check | TypeScript strict type check across all packages |
| npm run db:migrate | Apply pending database migrations |
| npm run db:studio | Open Drizzle Studio (database visual browser) |
| npm run build | Production build of all apps |
| npm run prepare | Install Husky pre-commit hooks |

# 7. Key Contacts

| Role | Contact |
| --- | --- |
| Chief AI Officer / Project Owner | Francis Ogbogu — fcogbogu@gmail.com |
| GitHub Organization | github.com/blu-geek (Valtara org) |
| LinkedIn | linkedin.com/in/francis-ogbogu |

# 8. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date | August 2026 |

*VEX-OS-DOG-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
