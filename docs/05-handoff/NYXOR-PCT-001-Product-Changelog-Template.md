**VALTARA AI**

**Nyxor**

**PRODUCT CHANGELOG TEMPLATE**

NYXOR-PCT-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-PCT-001                                                        |
| -------------- | -------------------------------------------------------------------- |
| Version        | 1.0                                                                  |
| Status         | Active — Populated from Sprint 1 onward                              |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                        |
| Audience       | Engineering, Product, Enterprise Clients, Compliance                 |
| Date           | August 2026                                                          |
| Classification | Confidential — Internal Use Only (select versions shared externally) |

# 1. Purpose & Usage

This Product Changelog records all version releases for Nyxor from Sprint 1 onward. It follows Keep a Changelog (keepachangelog.com) conventions adapted for an AI product with governance obligations.

Every release must have a changelog entry before deployment to production. The entry is written by the Engineering Lead, reviewed by the CAO, and committed to the repository at the same time as the release tag.

# 2. Change Categories

| Category   | Definition                                                                       |
| ---------- | -------------------------------------------------------------------------------- |
| Added      | New features, capabilities, or integrations available to executives              |
| Changed    | Changes to existing behavior, UI, or AI output characteristics                   |
| Fixed      | Bug fixes; corrections to unintended behavior                                    |
| Deprecated | Features that will be removed in a future release; executives notified           |
| Removed    | Features removed in this release; previously deprecated                          |
| Security   | Security fixes, control improvements, or vulnerability remediations              |
| AI/Model   | Changes to AI model configuration, prompt templates, or Voice Profile behavior   |
| Compliance | Changes affecting data handling, privacy controls, or regulatory alignment       |
| Breaking   | Changes that require executive or administrator action to maintain functionality |

# 3. Version Numbering

NYXOR uses Semantic Versioning (semver.org): MAJOR.MINOR.PATCH

| Increment | When                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| MAJOR     | Breaking change that requires executive or admin action; complete architectural overhaul |
| MINOR     | New feature or capability added in a backward-compatible manner                          |
| PATCH     | Bug fix, security patch, or minor improvement; no behavioral change visible to executive |

Pre-release versions use suffix: 1.0.0-beta.1, 1.0.0-rc.1

# 4. Release Entry Template

Copy this block for each release. Fill in all fields. Do not leave placeholders.

## Version [X.Y.Z] — [YYYY-MM-DD] — [Release Type: Patch | Minor | Major]

[One sentence summary of the most significant change in this release.]

### Added

- [FEATURE] Description of new feature

### Changed

- [CHANGE] Description of changed behavior

### Fixed

- [FIX] Description of bug fixed; reference issue ID if applicable

### Security

- [SECURITY] Description of security fix; CVE reference if applicable

### AI/Model

- [AI] Description of model configuration or prompt change

### Compliance

- [COMPLIANCE] Description of compliance-related change

### Breaking Changes

- [BREAKING] Description; migration steps required

### Deprecated

- [DEPRECATED] Feature name; planned removal version; alternative

### Removed

- [REMOVED] Feature removed; was deprecated in version X.Y.Z

**Sprint:** [Sprint number]

**Released by:** [Name]

**Reviewed by:** [Name — CAO for Major/Security releases]

# 5. Release Log

Entries below appear in reverse chronological order (most recent first). This section is populated from Sprint 1 onward.

**Version 1.0.0-beta.1** · TBD — Sprint 8 · Pre-Release

_First beta release for pilot executives. Core onboarding, dashboard, and Gmail/Google Calendar integration available._

**[Added] **Onboarding Agent — full discovery interview and Executive Intelligence Profile generation

**[Added] **Agent workforce provisioning from onboarding output

**[Added] **Voice Profile extraction and application

**[Added] **Executive Dashboard — morning brief, HITL queue, task status board

**[Added] **Gmail integration — read, draft, send (HITL-gated)

**[Added] **Google Calendar integration — read, create/update (HITL-gated)

**[Added] **HITL engine — Auto-Draft→Review and Checkpoint modes

**[Added] **Immutable audit log

**[Added] **Google Workspace and Microsoft 365 SSO

**[Added] **Compliance data export endpoint

**[AI/Model] **Initial prompt templates for onboarding, Voice Profile, agent tasks, morning brief

**[Compliance] **PIPEDA-aligned data handling; consent management; right-to-delete implementation

**Version 0.1.0** · TBD — Sprint 1 · Initial Scaffold

_Project scaffold, authentication, and repository structure established. No user-facing features._

**[Added] **Monorepo structure: apps/web, apps/api, packages/ai-orchestrator, packages/integrations, packages/database, packages/audit, packages/shared

**[Added] **Next.js 14 (App Router) frontend with Tailwind CSS and Shadcn/UI

**[Added] **Node.js 20 TypeScript API server

**[Added] **PostgreSQL via Supabase + Drizzle ORM schema and migrations

**[Added] **BullMQ + Redis job queue

**[Added] **Google and Microsoft OAuth 2.0 authentication via NextAuth.js v5

**[Added] **InferenceProvider adapter skeleton (OpenAI, Anthropic providers)

**[Added] **GitHub Actions CI/CD pipeline: lint, type-check, secret scan, test, build, deploy

**[Added] **Pre-commit hook: secret scanning, lint-staged

**[Added] **Docker Compose for local development

**[Added] **CLAUDE.md initialized in repository root

**[Security] **.env enforcement: pre-commit hook + CI secret scan blocking .env commits

# 6. Release Checklist

Required before every production release:

- [ ] Changelog entry written and reviewed
- [ ] All CI pipeline stages passing on release commit
- [ ] Staging deployment validated with smoke tests
- [ ] For Major releases: CAO review and sign-off
- [ ] For Security releases: CAO notification; CVE reference documented
- [ ] For AI/Model releases: evaluation harness run; HITL approval rate baseline confirmed
- [ ] Git tag created: git tag -a v[X.Y.Z] -m "Release v[X.Y.Z]"
- [ ] Tag pushed: git push origin v[X.Y.Z]
- [ ] Post-deploy smoke tests passing
- [ ] Pilot executives notified of significant changes (Minor and Major releases)

# 7. Document Approval

| Role     | Name                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| Author   | Francis Ogbogu — Chief AI Officer                                                  |
| Approver | Francis Ogbogu — Chief AI Officer                                                  |
| Date     | August 2026                                                                        |
| Note     | This document is populated continuously from Sprint 1 onward; it is never complete |

_NYXOR-PCT-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
