**VALTARA AI**

**Nyxor**

**PROJECT BUILD TEMPLATE**

NYXOR-PBT-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-PBT-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Active                                        |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Engineering, QA, DevOps                       |
| Date           | August 2026                                   |
| Classification | Confidential — Internal Use Only              |

# 1. Sprint Structure

NYXOR uses two-week sprints. Sprint 1 begins only after all 23 pre-build documents are completed and CLAUDE.md is initialized.

| Sprint   | Primary Focus                                                        |
| -------- | -------------------------------------------------------------------- |
| Sprint 1 | Project scaffold, auth, onboarding agent conversation engine         |
| Sprint 2 | Agent workforce activation, Voice Profile extraction, HITL engine v1 |
| Sprint 3 | Executive dashboard, morning brief generation                        |
| Sprint 4 | Gmail + Google Calendar integration                                  |
| Sprint 5 | Outlook Mail + Calendar integration                                  |
| Sprint 6 | Slack integration, audit log, compliance export                      |
| Sprint 7 | Performance hardening, security review, UAT                          |
| Sprint 8 | Pilot launch, monitoring, first production incident playthrough      |

# 2. Definition of Done

A task is Done when all of the following are true:

- Code reviewed and approved by at least one other engineer
- Unit tests written and passing; coverage meets target for the component
- Integration tests passing in CI
- No new critical or high CVEs introduced in dependencies
- Secret scan passing — no credentials in code
- Relevant documentation updated (API spec, CLAUDE.md if applicable)
- Decision log entry created for any material design decision made during implementation
- Deployed to staging environment and smoke-tested

# 3. Branching & Version Control

| Convention            | Specification                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Main branch           | main — production-ready at all times; protected; requires PR + review                          |
| Development branch    | develop — integration branch; feature branches merge here first                                |
| Feature branches      | feature/[ticket-id]-[short-description] — e.g. feature/NYXOR-001-onboarding-agent              |
| Fix branches          | fix/[ticket-id]-[short-description]                                                            |
| Release branches      | release/v[major].[minor].[patch]                                                               |
| Commit message format | [TYPE]([scope]): [description] — e.g. feat(onboarding): add voice profile extraction           |
| PR requirements       | All PRs require: description, linked ticket, test coverage note, reviewer approval, CI passing |
| .gitignore            | .env, .env.*, node_modules/, .DS_Store, *.log — enforced from init                             |

# 4. Code Standards

| Standard            | Specification                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Language            | TypeScript throughout; strict mode enabled; no any types without documented justification          |
| Linting             | ESLint with @typescript-eslint; Prettier for formatting; enforced in pre-commit hook and CI        |
| Import order        | External packages → internal packages → relative imports; enforced by eslint-plugin-import         |
| Error handling      | Explicit error types; no unhandled promise rejections; errors logged with context before surface   |
| Logging             | Pino structured JSON; no console.log in production code; no PII in logs                            |
| Testing             | Vitest for unit tests; Playwright for E2E; minimum 80% branch coverage on business logic           |
| File naming         | kebab-case for files; PascalCase for components and classes; camelCase for functions and variables |
| No direct LLM calls | LLM inference only through InferenceProvider adapter; enforced in code review                      |
| No raw SQL          | Drizzle ORM for all queries; raw SQL requires Engineering Lead approval and SQL injection review   |

# 5. Environment Setup

New developer environment setup (also see NYXOR-DOG-001 Developer Onboarding Guide):

- Clone repository; install Node.js 20 LTS
- Copy .env.example to .env; populate with development credentials
- Run npm install from root (monorepo); installs all workspace dependencies
- Run docker-compose up -d to start PostgreSQL and Redis locally
- Run npm run db:migrate to apply database migrations
- Run npm run dev to start frontend and API in development mode
- Run npm test to verify all tests pass
- Install pre-commit hook: npm run prepare (runs husky setup)

# 6. Document Approval

| Role     | Name                              |
| -------- | --------------------------------- |
| Author   | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date     | August 2026                       |

_NYXOR-PBT-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
