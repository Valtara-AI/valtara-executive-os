**VALTARA AI**

**Nyxor**

**CPMAI PROCESS DOCUMENT**

NYXOR-CPM-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-CPM-001                                  |
| -------------- | ---------------------------------------------- |
| Version        | 1.0                                            |
| Status         | Draft — Internal Review                        |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI  |
| Framework      | CPMAI (Cognitive Project Management for AI) v2 |
| Audience       | Engineering, AI Governance, Product, QA        |
| Date           | August 2026                                    |
| Depends On     | NYXOR-PRD-001, NYXOR-AMC-001, NYXOR-ETF-001    |
| Classification | Confidential — Internal Use Only               |

# 1. Purpose & Framework Overview

This document maps Nyxor development to the CPMAI (Cognitive Project Management for AI) framework — a structured methodology for managing AI projects through their full lifecycle. CPMAI extends traditional CRISP-DM with AI-specific phases covering model governance, deployment, and continuous evaluation.

NYXOR applies CPMAI's six-phase iterative model. Because NYXOR is a platform (not a single ML model), this document addresses CPMAI at the system level: the onboarding agent, the agent orchestration layer, the Voice Profile system, and agent task execution are each treated as discrete AI components within the broader CPMAI lifecycle.

| CPMAI Phase                       | NYXOR Application                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Phase 1 — Business Understanding  | Define the executive productivity problem, success criteria, and value metrics for each AI component |
| Phase 2 — Data Understanding      | Define what data each AI component requires, where it comes from, and what quality is needed         |
| Phase 3 — Data Preparation        | Define how executive data is assembled, cleaned, and structured before AI inference                  |
| Phase 4 — Model Development       | Define how AI components are prompted, configured, and validated before deployment                   |
| Phase 5 — Evaluation              | Define how each AI component's output quality is measured against defined success criteria           |
| Phase 6 — Deployment & Monitoring | Define how AI components are deployed, monitored, updated, and retired                               |

# 2. Phase 1 — Business Understanding

**2.1 Business Objectives**

| AI Component             | Business Objective                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Onboarding Agent         | Accurately discover executive role and provision a relevant agent workforce without manual configuration |
| Voice Profile System     | Capture executive communication style such that agent outputs require minimal editing                    |
| Agent Task Execution     | Produce task outputs that executives approve without editing in ≥75% of cases                            |
| Morning Brief Generation | Deliver a daily brief that executives report as useful and complete                                      |

**2.2 Constraints**

- Model agnosticism: success criteria must be achievable with any compliant LLM provider, not optimized for a single model
- HITL requirement: no AI component success definition can rely on autonomous external action without HITL approval
- Privacy constraint: no AI component may require bulk historical data access to achieve its objective; contextual data access only

# 3. Phase 2 — Data Understanding

**3.1 Data Requirements by AI Component**

| AI Component             | Input Data Required                                                                                                                            | Data Quality Requirements                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Onboarding Agent         | Executive responses to discovery questions (text); optional: writing samples                                                                   | Minimum 12 question responses; responses must be complete sentences; incomplete responses trigger clarification prompt |
| Voice Profile System     | Onboarding interview text; executive writing samples (optional); feedback from HITL decisions                                                  | Minimum 500 words of executive-authored text for initial extraction; quality improves with HITL feedback volume        |
| Agent Task Execution     | Task prompt (text); Voice Profile; integration data (email/calendar context if relevant); prior task outputs for context                       | Voice Profile must be version ≥1; integration data freshness ≤30 min for brief tasks; ≤5 min for real-time tasks       |
| Morning Brief Generation | Calendar events (today + tomorrow); email thread summaries (last 24h); HITL queue count; active task status; executive-defined priority topics | Calendar data: ≤30 min old at generation time; email data: ≤30 min old; missing data surfaced as explicit gap in brief |

**3.2 Data Gaps & Mitigation**

| Gap                                             | Mitigation                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Executive provides minimal onboarding responses | Agent asks follow-up questions; minimum viable profile generated; agent workforce proposed with lower confidence — surfaced to executive |
| No writing samples provided                     | Voice Profile extracted from onboarding interview text only; executive notified that profile will improve with more feedback             |
| Integration not connected at onboarding         | Morning brief sections dependent on disconnected integration marked "Not available — connect [integration] to enable"; no fabrication    |
| Stale integration data at brief generation time | Stale data flagged in brief with timestamp; agent does not use data older than 60 minutes for real-time tasks                            |

# 4. Phase 3 — Data Preparation

**4.1 Context Assembly Process**

Before every LLM inference call, the ContextAssembler module performs the following steps in order:

- Step 1 — Retrieve Executive Intelligence Profile (current version) from database
- Step 2 — Retrieve Voice Profile (current version) from database
- Step 3 — Retrieve agent-specific context: agent name, description, responsibilities, task history summary (last 5 tasks)
- Step 4 — Retrieve task-specific context: integration data relevant to the task (email threads, calendar events) fetched fresh from APIs
- Step 5 — Assemble context block: serialize profile, Voice Profile, agent context, and task context into structured prompt sections
- Step 6 — Apply token budget: if assembled context exceeds budget, summarize or truncate lower-priority sections (task history first, then integration data); never truncate Voice Profile or agent definition
- Step 7 — Select and render prompt template for task type; inject context block into system prompt

**4.2 Data Validation Before Inference**

| Validation                                            | Action on Failure                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Voice Profile version ≥1 exists                       | Use default communication style profile; flag to executive that Voice Profile needs calibration                           |
| Executive Intelligence Profile exists and is complete | Block agent task execution; route executive to onboarding completion                                                      |
| Integration data freshness within threshold           | Fetch fresh data; if fetch fails, use cached data with staleness flag; if no cached data, omit section with explicit note |
| Token budget not exceeded after assembly              | Apply summarization/truncation cascade; log which sections were truncated for monitoring                                  |

# 5. Phase 4 — Model Development

**5.1 Prompt Engineering Standards**

- All prompts stored as versioned Handlebars templates in /prompts directory; no inline prompt strings in application code
- Every prompt template includes: role definition, task instruction, Voice Profile injection point, output format specification, uncertainty handling instruction
- Prompt changes require: staging validation, HITL approval rate baseline comparison, decision log entry, version increment
- Prompt templates are reviewed for bias, hallucination risk, and prohibited behavior potential before deployment

**5.2 Model Configuration**

| Parameter         | Standard Configuration                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Temperature       | 0.3 for structured tasks (research, analysis, briefs); 0.5 for drafts; 0.7 for creative communications                  |
| Max output tokens | Defined per task type in configuration; enforced at orchestration layer; not modifiable by agent                        |
| Response format   | JSON mode for structured outputs (profile generation, task metadata); text for draft generation                         |
| Retry policy      | Max 3 retries on validation failure; exponential backoff on rate limit; permanent failure logged and surfaced           |
| Provider failover | Automatic retry with secondary provider on 5xx or 429; failover event logged; alert triggered if failover rate >5%/hour |

# 6. Phase 5 — Evaluation

**6.1 Evaluation Metrics**

| Metric                        | Measurement Method                             | Target                                     |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Onboarding agent accuracy     | Executive confirmation rate of proposed agents | ≥80% of proposed agents confirmed relevant |
| Voice Profile alignment       | HITL edit rate for approved-with-edit items    | ≤25% edit rate within 30 interactions      |
| Agent output acceptance rate  | HITL approve-as-is rate                        | ≥75% at steady state                       |
| Task completion rate          | Tasks completing without failure               | ≥95%                                       |
| Morning brief satisfaction    | In-product CSAT rating                         | ≥4.5/5.0                                   |
| Brief read rate               | Briefs opened within 4 hours of delivery       | ≥85%                                       |
| Bias incidents                | Reported outputs containing biased content     | 0 confirmed incidents per quarter          |
| Prohibited behavior incidents | Outputs violating ETF prohibited behaviors     | 0 per quarter                              |

**6.2 Evaluation Cadence**

- Daily: Automated monitoring of task completion rate and HITL queue throughput
- Weekly: HITL approval rate review per agent type; prompt performance flagging if approval rate drops >5% week-over-week
- Monthly: Voice Profile alignment review; morning brief satisfaction review; token cost per task review
- Quarterly: Full bias audit; prohibited behavior incident review; provider performance comparison
- Per incident: Any output that causes a material complaint triggers immediate root cause analysis and prompt review

# 7. Phase 6 — Deployment & Monitoring

**7.1 Deployment Gates**

Each AI component must pass the following gates before production deployment:

- Staging validation: component tested with synthetic executive profiles; HITL approval rate measured against baseline
- Prompt version review: all prompt templates reviewed for quality, bias, and prohibited behavior potential
- Ethics impact assessment: completed per NYXOR-ETF-001 Section 5.1
- Decision log entry: architectural and prompt decisions recorded in NYXOR-DL-001
- Engineering lead sign-off: QA validation complete; monitoring configured before deployment

**7.2 Post-Deployment Monitoring**

Ongoing monitoring is defined in NYXOR-MOP-001. CPMAI-specific monitoring requirements:

- HITL approval rate tracked per agent, per task type, and per model — degradation triggers prompt review
- Token cost per task type tracked — unexpected increases trigger context assembly audit
- Provider error rates tracked — failover event rate above threshold triggers provider health review
- Voice Profile feedback volume tracked per executive — executives with low feedback volume flagged for proactive calibration prompt

**7.3 Model Retirement**

An AI component is flagged for revision or retirement when:

- HITL approval rate falls below 60% for two consecutive weeks despite prompt revision
- Three or more confirmed prohibited behavior incidents in a rolling 90-day period
- LLM provider deprecates the configured model with less than 60 days notice
- A new model tier is available that demonstrates measurable improvement in evaluation metrics at equal or lower cost

# 8. Document Approval

| Role         | Name                                                 |
| ------------ | ---------------------------------------------------- |
| Author       | Francis Ogbogu — Chief AI Officer                    |
| Approver     | Francis Ogbogu — Chief AI Officer                    |
| Date Issued  | August 2026                                          |
| Review Cycle | Per sprint; major revision at each product milestone |

_NYXOR-CPM-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
