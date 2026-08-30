**VALTARA AI**

**Nyxor**

**AI MODEL CARD**

NYXOR-AMC-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-AMC-001                                     |
| -------------- | ------------------------------------------------- |
| Version        | 1.0                                               |
| Status         | Draft — Internal Review                           |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI     |
| Audience       | Engineering, Ethics Review, Compliance, Investors |
| Date           | August 2026                                       |
| Depends On     | NYXOR-SRS-001, NYXOR-SAD-001                      |
| Classification | Confidential — Internal Use Only                  |

# 1. Purpose

This AI Model Card documents the selection rationale, intended use, operational scope, limitations, and governance controls for the AI models deployed in Nyxor. It follows the Model Card framework (Mitchell et al., 2019) adapted for a multi-model, provider-agnostic deployment context.

NYXOR does not depend on any single AI model or provider. All models are accessed via a provider-agnostic adapter layer. This document governs the selection criteria and operational parameters that apply regardless of which provider is configured.

# 2. Model Deployment Strategy

**2.1 Multi-Model Architecture**

NYXOR deploys different models for different task types, balancing cost, capability, and latency requirements. No single model handles all tasks.

| Task Type                                    | Model Tier Required                             |
| -------------------------------------------- | ----------------------------------------------- |
| Onboarding interview and profile generation  | High-capability (e.g. Claude Sonnet, GPT-4o)    |
| Executive Intelligence Profile analysis      | High-capability                                 |
| Agent task execution — research and analysis | High-capability                                 |
| Agent task execution — drafting              | Mid-capability (e.g. Claude Haiku, GPT-4o-mini) |
| Morning brief generation                     | Mid-capability                                  |
| Voice Profile extraction                     | High-capability                                 |
| HITL checkpoint summaries                    | Mid-capability                                  |

**2.2 Provider Selection Criteria**

Any LLM provider configured in NYXOR must meet the following criteria before deployment:

- Published API with documented uptime SLA and rate limits
- Data Processing Agreement (DPA) available; customer data not used for model training by default
- Model version pinning supported (no silent model updates)
- JSON-mode or structured output support for schema-validated responses
- Token counting available for budget enforcement
- Compliance with applicable data residency requirements for the deployment context

# 3. Intended Use

| Intended Use Case                         | Scope                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Executive onboarding interviews           | Conversational AI to discover executive role, workflow, and delegation preferences               |
| Executive Intelligence Profile generation | Structured synthesis of onboarding data into a versioned profile document                        |
| Voice Profile extraction                  | Style analysis of executive writing samples to calibrate agent output tone and structure         |
| Agent task execution                      | Delegated work production: research briefs, communication drafts, summaries, analysis memos      |
| Morning brief generation                  | Daily synthesis of calendar, email, and agent status data into a personalized executive briefing |
| HITL checkpoint summaries                 | Structured progress summaries for multi-step tasks at defined checkpoints                        |

**3.1 Explicitly Out-of-Scope Use**

- Medical, legal, or financial advice as a primary service — NYXOR may assist executives in those fields with their own work, but does not provide professional advice as a product
- Autonomous execution of financial transactions — NYXOR agents cannot initiate payments or transfers
- Generation of content intended to deceive, manipulate, or misrepresent the executive to their stakeholders
- Processing of data belonging to individuals other than the authenticated executive without explicit consent
- Training data collection from executive interactions without explicit documented consent

# 4. Performance & Limitations

| Limitation                                                                                  | Mitigation in NYXOR                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hallucination — models may generate plausible but incorrect information                     | HITL governance ensures executive reviews all outputs before use; agents instructed to flag uncertainty explicitly; research tasks require source citation |
| Context window constraints — long conversations or large documents may exceed model limits  | Token budget enforcement at orchestration layer; long inputs summarized or chunked; context assembly prioritizes most relevant recent data                 |
| Temporal knowledge cutoff — models have training data cutoffs                               | Agents use integration data (email, calendar) for current context; research agents instructed to note when information may be outdated                     |
| Style calibration drift — Voice Profile may not perfectly capture executive style initially | Executive feedback on every HITL decision used to refine profile; incremental improvement over first 30 interactions                                       |
| Domain-specific expertise gaps — models may lack depth in highly specialized fields         | Onboarding discovery identifies specialized domains; agent prompts include domain context; executive HITL review catches errors                            |
| Bias in generated content                                                                   | All outputs reviewed by executive before use; bias assessment included in periodic output quality review; documented in NYXOR-ETF-001                      |

# 5. Evaluation & Monitoring

| Metric                                      | Measurement Method                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| HITL approval rate (output accepted as-is)  | Tracked per agent and task type; target ≥75%; declining rate triggers prompt review                    |
| Edit distance on approved-with-edit outputs | Levenshtein distance between original and final; high edit distance signals Voice Profile misalignment |
| Task completion rate                        | Tasks completing successfully vs. failing; target ≥95% for standard task types                         |
| Executive satisfaction (CSAT)               | Periodic in-product survey; target ≥4.7/5.0                                                            |
| Token cost per task type                    | Tracked per model and task; used for cost optimization decisions                                       |
| Latency p95 per task type                   | Tracked per model; feeds into SLA monitoring                                                           |

# 6. Model Update Policy

- Model version is pinned per deployment; no automatic model updates in production without explicit change management action
- Provider model deprecation notices trigger evaluation of replacement models against the criteria in Section 2.2
- Model changes in production require: decision log entry, staging environment validation, HITL approval rate baseline comparison, and engineering lead approval
- This document is updated whenever the model deployment strategy changes materially

# 7. Document Approval

| Role        | Name                                   |
| ----------- | -------------------------------------- |
| Author      | Francis Ogbogu — Chief AI Officer      |
| Approver    | Francis Ogbogu — Chief AI Officer      |
| Date Issued | August 2026                            |
| Next Review | Upon model strategy change or annually |

_NYXOR-AMC-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
