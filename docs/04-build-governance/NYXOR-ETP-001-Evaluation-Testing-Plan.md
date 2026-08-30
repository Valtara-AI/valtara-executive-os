**VALTARA AI**

**Nyxor**

**EVALUATION & TESTING PLAN**

NYXOR-ETP-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-ETP-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Active                                        |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Engineering, QA, AI Governance                |
| Date           | August 2026                                   |
| Depends On     | NYXOR-SRS-001, NYXOR-PRD-001, NYXOR-CPM-001   |
| Classification | Confidential — Internal Use Only              |

# 1. Purpose & Scope

This Evaluation & Testing Plan defines the testing strategy, test types, coverage requirements, AI output evaluation criteria, and quality gates for Nyxor. It applies to all layers of the system: application code, integrations, AI components, and the HITL governance engine.

# 2. Testing Strategy

| Test Type                     | Tool                                  |
| ----------------------------- | ------------------------------------- |
| Unit tests                    | Vitest                                |
| Integration tests             | Vitest + test database                |
| End-to-end tests              | Playwright                            |
| AI output quality tests       | Custom evaluation harness             |
| Performance tests             | k6                                    |
| Security tests                | OWASP ZAP + npm audit + manual review |
| Accessibility tests           | axe-core + manual                     |
| User Acceptance Testing (UAT) | Manual with pilot executives          |

# 3. AI Output Evaluation

**3.1 Evaluation Harness**

A custom evaluation harness runs against each prompt template version using synthetic executive profiles and predefined test cases. The harness measures:

- Structural compliance: does the output match the expected format specification?
- Voice Profile alignment: does the output style match the provided Voice Profile? (Scored by a secondary LLM call using a rubric)
- Factual accuracy: for research outputs, are all stated facts present in the provided context? (No hallucinations)
- Prohibited behavior: does the output contain any content matching the prohibited behavior list in NYXOR-ETF-001?
- Uncertainty flagging: for tasks with incomplete context, does the agent flag gaps appropriately?

**3.2 Evaluation Gates**

| Gate                          | Pass Criteria                                                      |
| ----------------------------- | ------------------------------------------------------------------ |
| Structural compliance         | 100% of test cases produce structurally valid output               |
| Voice Profile alignment score | ≥7/10 average across test cases (LLM-scored rubric)                |
| Hallucination check           | 0 facts stated that are not present in provided context            |
| Prohibited behavior check     | 0 outputs match any prohibited behavior pattern                    |
| Uncertainty flagging          | ≥90% of under-context test cases include explicit uncertainty flag |

# 4. Critical Test Cases

**4.1 HITL Enforcement Tests (Must Pass: 100%)**

- TC-HITL-01: Attempt to call Gmail send endpoint without approved HITL record → expect 403 rejection
- TC-HITL-02: Attempt to call Outlook send without approved HITL record → expect 403 rejection
- TC-HITL-03: Attempt to post to Slack without approved HITL record → expect 403 rejection
- TC-HITL-04: Agent task in Autonomous mode completes → confirm external action record has approved HITL entry
- TC-HITL-05: Agent task in Checkpoint mode reaches checkpoint → confirm task pauses and HITL queue item created

**4.2 Security Tests (Must Pass: 100%)**

- TC-SEC-01: Authenticate as Executive; attempt to access another executive's profile → expect 403
- TC-SEC-02: Authenticate as Delegate; attempt to access agent configuration → expect 403
- TC-SEC-03: Unauthenticated request to any /api/v1/ endpoint → expect 401
- TC-SEC-04: Inject SQL in user-facing input fields → confirm parameterized queries prevent injection
- TC-SEC-05: Confirm .env values are not present in any API response body or log output
- TC-SEC-06: Confirm audit log table rejects UPDATE and DELETE at database level

**4.3 Performance Tests**

- TC-PERF-01: 1,000 concurrent authenticated sessions; dashboard load p95 ≤2.0s
- TC-PERF-02: 500 concurrent HITL queue loads; response p95 ≤1.0s
- TC-PERF-03: Morning brief generation completes for 100 executives within 30-minute generation window
- TC-PERF-04: Agent task initiation to first token: p95 ≤30s for standard tasks

# 5. Ethics Impact Checklist

Completed before deployment of any new agent type, task capability, or integration:

| Question                                                                                | Required Response                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Does this capability introduce a new category of personal data collection?              | If yes: DMP amendment required; PIA conducted; CAO sign-off                                       |
| Does this capability enable any new form of external action on behalf of the executive? | If yes: HITL enforcement for the new action type must be implemented and tested (TC-HITL pattern) |
| Does this capability produce outputs that could affect third parties?                   | If yes: bias review of prompt template; prohibited behavior check added to evaluation harness     |
| Does this capability use a new LLM provider or model?                                   | If yes: provider criteria check (NYXOR-AMC-001 Section 2.2); DPA review; decision log entry       |
| Does this capability change data retention or processing?                               | If yes: DMP amendment; PCF review                                                                 |

# 6. Sprint 7 Test Execution Results

Section 4's test cases (TC-HITL-_, TC-SEC-_, TC-PERF-*) were defined before any of them had actually been run. Sprint 7 (security hardening, security review, performance) executed them for the first time; results below. "Automated" means a Vitest test proves the case on every CI run going forward, not a one-time manual check.

**6.1 HITL Enforcement (TC-HITL-01 through 05)**

| Case                                                                          | Result           | Evidence                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-HITL-01/02/03 (Gmail/Outlook/Slack send without approved HITL → rejected)  | PASS (automated) | `gmail-adapter.test.ts`, `microsoft/mail-adapter.test.ts`, `slack/slack-adapter.test.ts` - each proves the Postgres trigger rejects the insert and the provider API is never called |
| TC-HITL-04 (Autonomous mode → external_action carries an approved HITL entry) | PASS (automated) | `execute-task.test.ts`: "autonomous_report: no HITL queue item; output is auto-approved; task complete"                                                                             |
| TC-HITL-05 (Checkpoint mode → task pauses, HITL item created)                 | PASS (automated) | `execute-task.test.ts`: "checkpoint: creates a pending HITL queue item and marks the task at_checkpoint, not complete"                                                              |

**6.2 Security (TC-SEC-01 through 06)**

| Case                                                    | Result                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-SEC-01 (cross-executive access denied)               | PASS (automated) — implemented as 404, not 403 | `agents.test.ts`: "isolates agents between two different executives - cross-access returns 404, not the other executive's data." Deliberate deviation from this doc's literal wording: 404 avoids confirming the other executive's resource even exists, which is the stronger property; 403 would leak that.                                                                                                                                     |
| TC-SEC-02 (Delegate denied agent config)                | PASS (automated)                               | `agents.test.ts`: "rejects unauthenticated and non-Executive-role requests"                                                                                                                                                                                                                                                                                                                                                                       |
| TC-SEC-03 (unauthenticated → 401)                       | PASS (automated)                               | Present in essentially every route test file written across Sprints 1-7                                                                                                                                                                                                                                                                                                                                                                           |
| TC-SEC-04 (parameterized queries, no injection surface) | PASS (structural audit)                        | Every query goes through Drizzle's query builder. Repo-wide grep for raw ``sql` `` template usage found exactly one hit (`audit-logger.ts`'s advisory-lock call), interpolating a hardcoded bigint constant, not user input - and Drizzle's `sql` tag parameterizes interpolations regardless. No hand-built query strings anywhere in business logic.                                                                                            |
| TC-SEC-05 (no .env values in responses or logs)         | PASS (structural audit)                        | `error-handler.ts` never puts `err.stack` in the response body (logs only); response `details` only include `err.message`, and only outside `NODE_ENV=production`. `logger.ts` is Pino JSON exclusively. Repo-wide grep for `console.log` found none in served request-handling code (only `packages/database`'s `seed.ts`/`migrate.ts` CLI scripts use `console.warn`/`console.error`, both ESLint-allowed and outside the running API process). |
| TC-SEC-06 (audit log RLS blocks UPDATE/DELETE)          | PASS (automated, newly added)                  | `packages/database/src/__tests__/audit-log-immutability.test.ts` - this case had no test until Sprint 7. Confirmed by hand against local Postgres first: an UPDATE/DELETE against `audit_log_entries` doesn't raise an exception, it silently matches zero rows (RLS filters the row out of the command's view before it can act) - the test asserts the row is unchanged/still present, not that the attempt throws.                             |

**6.3 Performance (TC-PERF-01 through 04)**

| Case                                                          | Result                              | Notes                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-PERF-01 (1,000 concurrent sessions, dashboard p95 ≤2.0s)   | NOT VALIDATED                       | Requires real deployment infrastructure sizing; not checkable from a single local process. Scoped down instead (see below).                                                                                                                                                                                                          |
| TC-PERF-02 (500 concurrent HITL loads, p95 ≤1.0s)             | Directionally PASS at reduced scale | `apps/api/src/scripts/perf-smoke-test.ts` (`npm run perf:smoke --workspace=apps/api`), 20 concurrent / 200 requests against a local server + real Postgres + one seeded executive: `GET /hitl/queue` p95 17ms against the 1000ms target. Real number, small scale - not a substitute for TC-PERF-02's literal 500-concurrent figure. |
| TC-PERF-03 (100-executive brief generation within the window) | NOT VALIDATED                       | Needs 100 real executives with real integrations; not checkable locally.                                                                                                                                                                                                                                                             |
| TC-PERF-04 (task initiation to first token ≤30s)              | NOT VALIDATED                       | Needs a real Anthropic API key making live calls; not exercised in this pass.                                                                                                                                                                                                                                                        |
| SRS §6 general target (non-AI endpoints, p95 ≤300ms)          | PASS at reduced scale               | Same smoke test: `GET /health` p95 100ms, `GET /dashboard/summary` p95 117ms, both well under 300ms at 20-way concurrency. Directional evidence the Sprint 7 middleware additions (security headers, CORS, rate limiting) didn't introduce meaningful latency - not a claim that the 1,000-session target is met.                    |

Blocked items (TC-PERF-01/03/04) require a real deployment and are deferred to Sprint 8 pilot launch, where actual infrastructure and a real LLM key exist to test against honestly.

# 7. Document Approval

| Role         | Name                               |
| ------------ | ---------------------------------- |
| Author       | Francis Ogbogu — Chief AI Officer  |
| Approver     | Francis Ogbogu — Chief AI Officer  |
| Date         | August 2026                        |
| Review Cycle | Per sprint; major revision at v2.0 |

_NYXOR-ETP-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
