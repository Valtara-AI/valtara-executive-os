**VALTARA AI**

**Valtara Executive OS**

**DECISION LOG**

VEX-OS-DL-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-DL-001 |
| --- | --- |
| Version | 1.0 — Living Document |
| Status | Active — Updated continuously throughout build |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Date Opened | August 2026 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Usage

The Decision Log is a living document that records every significant architectural, product, AI governance, and ethical decision made during the build of Valtara Executive OS (VEX-OS). It provides an auditable trail of why the system is built the way it is — not just what was built.

Every engineer, product manager, and governance reviewer must add an entry to this log for any decision that: (a) establishes a constraint on the system; (b) selects a technology, framework, or vendor; (c) resolves a significant design trade-off; or (d) overrides a default specified in the pre-build documentation suite.

| Decision ID Format | DL-[CATEGORY]-[NUMBER]: DL-ARCH (architecture), DL-PROD (product), DL-AI (AI/governance), DL-SEC (security), DL-INFRA (infrastructure) |
| --- | --- |
| Status values | Proposed → Under Review → Decided → Implemented → Superseded |
| Entry ownership | Decision maker owns the entry; Engineering Lead reviews all DL-ARCH entries; CAO reviews all DL-AI and DL-SEC entries |

# 2. Decision Log Entries

The following decisions are logged at document creation, representing the foundational architectural and governance choices established during pre-build documentation.

**DL-ARCH-001 — Architecture Pattern — Layered Monolith for MVP**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | VEX-OS v1.0 will be built as a layered monolith with clean internal boundaries, not a microservices architecture. |
| Options Considered | (A) Microservices from day one. (B) Layered monolith with extraction path. (C) Serverless functions. |
| Rationale | Microservices add operational complexity (service discovery, distributed tracing, deployment orchestration) that is disproportionate to the team size and product maturity at MVP. A well-structured monolith with clean layer boundaries provides the same architectural optionality while moving faster. Option C (serverless) introduces cold-start latency incompatible with the ≤2s dashboard load requirement. |
| Consequences | Faster development velocity at MVP. Simpler local development (Docker Compose). Service extraction possible in v2 without breaking changes if clean boundaries are maintained from Sprint 1. Engineering must enforce boundary discipline — cross-layer direct dependencies are prohibited. |
| Status | Decided |

**DL-ARCH-002 — LLM Provider Strategy — Provider-Agnostic Adapter Required**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | All LLM inference in VEX-OS must route through a provider-agnostic adapter layer. No provider SDK may be called directly in business logic. |
| Options Considered | (A) Direct OpenAI SDK calls. (B) Use LangChain as abstraction layer. (C) Custom provider-agnostic adapter. |
| Rationale | Option A creates hard dependency on OpenAI — unacceptable given the model-agnostic principle. Option B (LangChain) adds a large dependency with its own abstractions, update cadence, and occasional breaking changes; it also obscures what the system is doing. Option C gives full control, is transparent, and is straightforwardly testable with mock providers. The adapter interface is simple (see VEX-OS-API-001). |
| Consequences | Provider switching requires only .env change. Additional providers added by implementing the InferenceProvider interface. All LLM calls are uniformly testable with mock providers. No LangChain or third-party abstraction dependency. |
| Status | Decided |

**DL-ARCH-003 — Integration Method — REST API First; MCP Only With Justification**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | All third-party integrations use published REST APIs. MCP connections permitted only where no REST API exists, with mandatory documentation in VEX-OS-API-001 Section 6. |
| Options Considered | (A) MCP for all integrations. (B) REST APIs only. (C) REST APIs primary; MCP where justified. |
| Rationale | Option A (MCP everywhere) introduces unnecessary dependency on MCP server availability and adds complexity without proportional benefit at this scale. REST APIs are stable, well-documented, directly auditable, and do not require a running MCP server process. Option C is selected: REST provides control, auditability, and independence; MCP is reserved for cases where no REST API exists. At MVP, no such exception exists. |
| Consequences | All integrations in VEX-OS-API-001 use REST. MCP exception register in Section 6 is empty at v1.0. Any future MCP integration requires documented justification and CAO sign-off. |
| Status | Decided |

**DL-ARCH-004 — Database — PostgreSQL via Supabase**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | PostgreSQL 15+ via Supabase as the primary database. Drizzle ORM for schema management. |
| Options Considered | (A) MongoDB. (B) PostgreSQL via Supabase. (C) PlanetScale (MySQL-compatible). (D) Self-hosted PostgreSQL. |
| Rationale | PostgreSQL is the open standard for relational data with pgvector support for semantic retrieval. Supabase provides managed operations (backups, connection pooling, RLS) without lock-in — it is PostgreSQL-compatible and fully migratable to any PG host. MongoDB introduces document model complexity without benefit for VEX-OS's relational data structure. PlanetScale is MySQL-compatible (no pgvector). Self-hosted PostgreSQL adds operational overhead without proportional benefit at MVP. |
| Consequences | Database is self-hostable (plain PostgreSQL). Migrations managed by Drizzle. pgvector available for semantic context retrieval. Row-level security enforced for audit log immutability. |
| Status | Decided |

**DL-ARCH-005 — HITL Enforcement Point — Application Layer**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | HITL governance is enforced at the application layer. Agents cannot bypass the HITL queue regardless of task type or instruction. |
| Options Considered | (A) Enforce HITL within agent logic (trust agents to self-enforce). (B) Enforce at application layer with database constraint. |
| Rationale | Option A (agent self-enforcement) is unreliable — an incorrectly prompted agent or a future prompt change could inadvertently bypass HITL. HITL is a hard safety requirement, not a behavioral guideline. Option B (application layer + database constraint) makes bypass architecturally impossible: no external action record can be created without a linked approved HITL queue record. This is enforced regardless of what the agent logic does. |
| Consequences | Absolute HITL guarantee. Agents can be retrained, re-prompted, or modified without risk of bypassing the governance layer. HITL compliance is testable independently of AI behavior. |
| Status | Decided |

**DL-ARCH-006 — Secret Management — .env Files with Pre-Commit Hook**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | All secrets stored in .env files. Pre-commit hook blocks accidental commits. CI/CD pipeline enforces secret scanning. |
| Options Considered | (A) HashiCorp Vault or AWS Secrets Manager. (B) .env files with git controls. (C) Environment variables injected at deployment. |
| Rationale | Option A (dedicated secrets manager) is appropriate at enterprise scale but adds operational complexity and cost disproportionate to MVP. Option B provides the same security guarantees with simpler operations: .env files are local, auditable, and the pre-commit hook + CI secret scanning provides the enforcement layer. Option C is complementary (deployment platforms inject .env values as environment variables in production) and is how .env values are consumed in production. |
| Consequences | Simple developer experience. Zero risk of accidental commit with hooks in place. Migration to Vault or equivalent possible in v2 by changing how env vars are sourced — application code is unchanged. |
| Status | Decided |

**DL-PROD-001 — Frontend Framework — Next.js 14 (App Router)**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | VEX-OS frontend built with Next.js 14 using the App Router, React 18, TypeScript, Tailwind CSS, and Shadcn/UI. |
| Options Considered | (A) Vite + React SPA (no SSR). (B) Next.js 14 App Router. (C) Remix. |
| Rationale | Next.js provides SSR for initial dashboard load (improves perceived performance without client-side hydration delay), file-based routing, and excellent TypeScript support. The App Router enables server components where appropriate. Shadcn/UI provides accessible, unstyled component primitives that are fully customizable and introduce no proprietary dependency. Next.js is deployable on Vercel (fast) and via Docker on any host (portable). |
| Consequences | SSR-enabled dashboard. Accessible component library. TypeScript throughout. Docker-deployable to any host. Not dependent on Vercel for operation. |
| Status | Decided |

**DL-PROD-002 — Job Queue — BullMQ with Redis**

| Date | August 2026 | Decision Maker | Francis Ogbogu — CAO |
| --- | --- | --- | --- |
| Decision | Agent task execution and morning brief generation managed via BullMQ job queue backed by Redis. |
| Options Considered | (A) In-process async execution. (B) BullMQ + Redis. (C) Cloud-managed queue (SQS, Cloud Tasks). |
| Rationale | Option A (in-process) loses tasks on server restart and cannot support concurrent users at scale. Option C (cloud-managed queue) adds vendor dependency and cost complexity. BullMQ is production-grade, self-hostable, supports scheduling (for morning briefs), retry logic, and priority queues. Redis persistence (AOF) ensures tasks survive restarts. |
| Consequences | Reliable task execution with retry. Scheduled morning brief generation. Portable (Redis self-hostable). Observable via BullMQ dashboard in development. |
| Status | Decided |

# 3. Pending Decisions

The following decisions are required before Sprint 1 begins. Each must be logged as a completed entry before implementation starts.

| Decision Required | Target Date |
| --- | --- |
| DL-ARCH-007: API server framework — Hono vs Express 5 | Sprint 1 kickoff |
| DL-INFRA-001: Backend hosting selection — Railway vs Fly.io for v1.0 | Sprint 1 kickoff |
| DL-INFRA-002: Redis hosting — Upstash vs self-hosted on backend host | Sprint 1 kickoff |
| DL-AI-001: Default LLM provider and models for v1.0 MVP | Sprint 1 kickoff |
| DL-AI-002: Vector embedding model selection | Sprint 2 kickoff |

# 4. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Opened | August 2026 |
| Last Updated | August 2026 |

*VEX-OS-DL-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
