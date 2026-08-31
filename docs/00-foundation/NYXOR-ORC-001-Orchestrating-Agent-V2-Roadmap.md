**VALTARA AI**

**Nyxor**

**ORCHESTRATING AGENT — V2 ROADMAP (SHELVED)**

NYXOR-ORC-001 · Version 1.0 · August 2026

| Product Name   | Nyxor                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Document Type  | Deferred Feature Roadmap / Scoping Record                                           |
| Document ID    | NYXOR-ORC-001                                                                       |
| Version        | 1.0                                                                                 |
| Status         | **Shelved — not scheduled.** Deferred until v1 has real traction and user feedback. |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                                       |
| Organization   | Valtara Inc. (Valtara AI) — Saskatoon, Saskatchewan, Canada                         |
| Date           | August 2026                                                                         |
| Classification | Confidential — Internal Use Only                                                    |

# 1. Why this document exists

This feature concept was discussed with the CAO before this document existed
and was lost to a context gap in an earlier session — nothing about it had
been captured in the Decision Log, the PRD, the SAD, or any prompt/code
comment, confirmed by an exhaustive repo search. It was re-described by the
CAO and is written down here in full so it cannot be lost a second time,
even though it is explicitly not being built now.

**Status, in the CAO's own words**: v1 (today's onboarding-generated 2–8
static agents) is confirmed sound as-is. This roadmap is "kept in the
cooler for v2" — not to be picked up until v1 has real usage and feedback.

# 2. The concept

An executive interacts via a **persistent chat interface** (not a one-time
onboarding step). They type a free-text task or project request. An
**Orchestrating Agent** reads that request and, per turn:

- **Delegates** the task to an existing agent whose responsibilities
  already cover it, and/or
- **Creates a new agent on the spot**, generating that agent's own system
  prompt from the request — both modes can apply within a single turn, not
  either/or.
- Should support **genuinely parallel execution** when an executive kicks
  off several things at once (e.g. "get the board deck ready, chase the two
  vendors, and set up a launch tracker" in one message) — real
  multitasking, not a one-at-a-time queue.

# 3. What the scoping work found (two research passes + a design pass, August 2026)

**Directly reusable, zero new plumbing**: `packages/ai-orchestrator/src/response-validator.ts`'s
`completeStructured()` (provider-agnostic structured LLM JSON + Zod
validation, with retry) is already the exact mechanism needed for the
delegate-vs-create decision — it's the same primitive onboarding's
workforce generation already uses.

**Adapt, don't copy, the existing precedent**: onboarding's
propose-then-human-confirms agent creation (`apps/api/src/domains/onboarding/engine.ts`)
is the closest analog, but a blocking confirmation screen on every chat turn
would defeat a fast conversational interface. Scoping resolved this as:
create agents immediately, no confirm step, but unconditionally clamp any
orchestrator-proposed `hitlMode` away from `autonomous_report` at creation
time — so a never-reviewed new agent's first output still always lands in
the HITL queue. This doesn't conflict with CLAUDE.md's "HITL is
architectural" constraint, which is scoped to genuinely external actions
(email/Slack/calendar via `external_actions`), not internal agent-creation
DB writes.

**The real cost/risk, and why this is genuinely bigger than a UI layer**:
**parallel task execution does not exist today.** The BullMQ worker's
concurrency is unset (defaults to 1 — exactly one task executes
system-wide at any instant, regardless of queue depth), and the billing
entitlement checks (`assertAgentLimit`/`assertTaskVolume`/`assertCostBudget`
in `packages/billing/src/entitlements.ts`) are non-atomic read-then-compare
calls with no locking — safe today only because normal UI usage naturally
serializes one request at a time. A feature whose entire point is firing
concurrent creates is exactly the workload that turns that into a real,
exploitable race (e.g. three concurrent task-creations at 199/200 monthly
tasks could all pass the check and land at 202/200, silently over budget).

# 4. Recommended phasing, if/when this is picked back up

**Phase 1 — decision logic + chat UI, sequential execution.** Ships the
delegate-vs-create decision (one LLM call returning an _array_ of
decisions — the actual mechanism behind "several things at once", bounded
by a new `MAX_ORCHESTRATOR_FANOUT` constant), a new `orchestrator_sessions`
table (groups everything from one conversational burst — no separate
`projects`/`initiatives` table needed), a new chat UI (extracted/generalized
from onboarding's existing `ChatBubble` pattern, the only conversational UI
precedent in the codebase today), and reuses the existing sequential worker
as-is. A turn naming 3 things will create 3 real task rows that execute one
at a time, not concurrently — explicitly acceptable for this phase.

**Phase 2 — real concurrency, shipped as one unit, not bundled with Phase 1.**
Adds a `concurrency: N` option to the BullMQ worker (small code change;
`executeTask` is already safe to run concurrently, no locks/serialization
exist there today) together with a fix for the entitlement race, using the
same `pg_advisory_xact_lock`-in-a-transaction pattern already established in
`packages/audit/src/audit-logger.ts` (line 53), keyed per-executive. These
two land together because raising concurrency is what makes the race
actually reachable. A new concurrency regression test (fire N simultaneous
entitlement-gated creates, assert exactly one wins) does not exist anywhere
in the repo today and would be mandatory before this ships.

**Explicitly deferred further, beyond even Phase 2**: standing up
`apps/api/dist/worker.js` as its own independently-scaled Railway service
(today only described in a Dockerfile comment, not actually declared in any
IaC in this repo). This is horizontal scale-out/process isolation, not a
prerequisite for "several things happening at once" — that's satisfied by
the concurrency option alone — and carries a real new fixed monthly
infrastructure cost only worth taking on once real usage data says the
single-process concurrency ceiling is the actual bottleneck.

# 5. Cost/complexity summary

| Phase | New tables                                       | Rough scope                                                                                                                 | Complexity                                                                                                                              | Ongoing cost                                                                                                                                                                                                               |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 1 (`orchestrator_sessions`) + 2 columns + 1 enum | ~10-12 files (new domain module, route, prompt template, migration, ~4-5 frontend files)                                    | Medium — the real risk is prompt-engineering the delegate-vs-create decision to be trustworthy across ambiguous free text, not plumbing | Each chat turn is 1 LLM call that can fan out into up to 5 tasks, each itself a further LLM call once executed — will consume the Starter tier's $20/mo cost cap noticeably faster than today's one-task-per-click pattern |
| 2     | 0                                                | ~4 surgical, correctness-critical diffs (worker concurrency option, entitlements advisory-lock wrapper + call-site updates) | Small in size, but a mandatory new concurrency test is non-negotiable before shipping                                                   | No new fixed cost (same process/service) — variable LLM spend arrives faster once concurrent, not larger in total                                                                                                          |

# 6. Pointers for whoever picks this back up

- Full technical plan (file-by-file, exact Zod schemas, exact migration
  shape, test plan) was produced during scoping and is available in this
  session's plan-mode history if still retrievable; this document is the
  durable summary meant to survive regardless.
- Re-read before starting: `apps/api/src/domains/onboarding/engine.ts`,
  `packages/ai-orchestrator/src/response-validator.ts`,
  `packages/billing/src/entitlements.ts`,
  `apps/api/src/queue/agent-task-worker.ts`,
  `packages/database/src/schema/agent.ts`, `packages/audit/src/audit-logger.ts`.
- Confirm, before any Phase 1 work starts, that `apps/api/dist/worker.js`
  is actually running in the deployed environment (Railway dashboard/CLI,
  not just the repo) — `railway.json` only declares the API service today,
  and if the worker isn't actually deployed anywhere, no queued task
  executes at all today for _any_ feature, onboarding included. Pre-existing
  gap, not caused by this feature, but this would be the first feature whose
  entire value depends on task execution completing.

# 7. Document Approval

| Role         | Name                              |
| ------------ | --------------------------------- |
| Author       | Francis Ogbogu — Chief AI Officer |
| Approver     | Francis Ogbogu — Chief AI Officer |
| Opened       | August 2026                       |
| Last Updated | August 2026                       |

_NYXOR-ORC-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
