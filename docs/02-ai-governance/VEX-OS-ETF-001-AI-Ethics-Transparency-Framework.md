**VALTARA AI**

**Valtara Executive OS**

**AI ETHICS & TRANSPARENCY FRAMEWORK**

VEX-OS-ETF-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-ETF-001 |
| --- | --- |
| Version | 1.0 |
| Status | Draft — Internal Review |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | All Valtara staff, Engineering, Compliance, Board, Enterprise Clients |
| Date | August 2026 |
| Depends On | VEX-OS-AMC-001, VEX-OS-PRD-001 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Scope

This AI Ethics & Transparency Framework (ETF) defines the ethical principles, design commitments, and governance controls that govern all AI behavior within Valtara Executive OS (VEX-OS). It applies to every AI agent, model, and automated decision within the system.

This framework is not aspirational — it is operational. Every principle is accompanied by a concrete implementation requirement. All engineering and product decisions must be assessed against this framework before deployment.

# 2. Ethical Principles

VEX-OS is governed by seven ethical principles. Each principle is defined, operationalized, and assigned a compliance mechanism.

**Principle 1 — Human Authority**

The executive retains final authority over all consequential actions. AI agents recommend, draft, and prepare. Humans decide and act.

| Operationalization | Compliance Mechanism |
| --- | --- |
| HITL governance enforced at application layer for all external actions | Code review requirement; automated test suite verifies no agent can bypass HITL queue |
| No agent may send communications, post content, or modify external systems without an approved HITL record | Database constraint: external action records require a linked approved HITL entry |
| Executive can pause, modify, or deactivate any agent at any time with immediate effect | Agent deactivation endpoint tested in QA; deactivation propagates to queue within 30 seconds |

**Principle 2 — Transparency**

VEX-OS is transparent about what it is, what it does, and what its limitations are. The executive always knows when they are reviewing AI-generated content.

| Operationalization | Compliance Mechanism |
| --- | --- |
| All AI-generated content is marked as AI-generated in the HITL queue | UI requirement: HITL queue items display "AI-generated" badge; cannot be removed or hidden |
| Voice Profile calibration improves style consistency — it does not create a false impression of human authorship | No VEX-OS marketing or UI language claims that AI outputs are written by the executive |
| Agent capabilities and limitations are disclosed to the executive during onboarding | Onboarding flow includes explicit capability and limitation disclosure screen; completion logged |

**Principle 3 — Explainability**

Every agent action must be explainable. The executive, compliance team, or auditor must be able to understand what the agent did, why, and on what basis.

| Operationalization | Compliance Mechanism |
| --- | --- |
| Full audit log of all agent actions with input context, model used, and output | Audit log schema enforced; all task executions logged before action taken |
| Agent task detail view shows: prompt used, context sources, model, output, HITL decision | Product requirement; task detail UI tested in QA |
| Agents instructed to surface uncertainty and flag assumptions in their outputs | System prompt requirement for all agents; evaluated in output quality review |

**Principle 4 — Fairness & Non-Discrimination**

VEX-OS agents must not produce outputs that discriminate, stereotype, or treat individuals unfairly based on protected characteristics.

| Operationalization | Compliance Mechanism |
| --- | --- |
| Agents prohibited from producing communications that reference or imply bias toward recipients based on protected characteristics | System prompt guardrails; output review process includes bias check |
| Voice Profile captures communication style, not attitudes or biases — style calibration must not reproduce discriminatory patterns from writing samples | Voice Profile extraction prompt explicitly excludes attitudinal and evaluative language; reviewed at profile generation |
| Periodic bias audit of agent outputs across executive cohort (anonymized) | Quarterly review process defined in VEX-OS-ETP-001 |

**Principle 5 — Privacy by Design**

Executive data is processed only to the extent necessary to deliver the service. Privacy is an architectural constraint, not a compliance afterthought.

| Operationalization | Compliance Mechanism |
| --- | --- |
| Minimum necessary data collection — see VEX-OS-DMP-001 for full specification | Integration scopes reviewed at each release; any scope expansion requires DMP amendment |
| Executive data not used for model training without explicit documented consent | Contractual commitment in Terms of Service; DPA with all LLM providers prohibits training use |
| Data residency configurable per deployment | Database and hosting provider selection documented in deployment configuration |

**Principle 6 — Non-Manipulation**

VEX-OS agents must not produce content designed to manipulate, deceive, coerce, or unduly influence the executive or any third party.

| Operationalization | Compliance Mechanism |
| --- | --- |
| Agents prohibited from using persuasion techniques that exploit psychological vulnerabilities, urgency framing, or false scarcity | System prompt guardrails for all communication-producing agents |
| Agent outputs must accurately represent facts and flag uncertainties; fabrication prohibited | Hallucination mitigation: agents instructed to cite sources; HITL review before external use |
| VEX-OS does not use dark patterns in its own UI to increase engagement or dependency | UX review against dark pattern checklist at each release |

**Principle 7 — Accountability**

Every AI action in VEX-OS has a responsible human actor. Accountability is not diluted by automation.

| Operationalization | Compliance Mechanism |
| --- | --- |
| Chief AI Officer accountable for this framework and all material AI governance decisions | Document ownership and approval authority recorded here and in VEX-OS-DL-001 |
| Every approved HITL action records the approving human's identity and timestamp | Database schema enforced; HITL records include actor_id and actioned_at |
| Framework reviewed annually and upon any material incident involving AI outputs | Review schedule recorded in this document; amendments require CAO approval |

# 3. Prohibited Agent Behaviors

The following behaviors are prohibited for all VEX-OS agents regardless of task, executive instruction, or context. These prohibitions are implemented as system prompt guardrails and enforced through output review.

- Fabricating facts, statistics, citations, or quotes not present in the context provided
- Producing communications designed to deceive recipients about their origin (i.e. claiming human authorship where this would be materially misleading)
- Generating content that discriminates against individuals based on race, gender, religion, nationality, disability, sexual orientation, age, or other protected characteristics
- Producing content designed to manipulate recipients through psychological exploitation
- Executing any external action (send email, post content, modify data) without an approved HITL record
- Retaining or sharing executive data beyond the scope of the assigned task
- Generating content that facilitates illegal activity
- Producing content that disparages, defames, or makes false claims about named individuals or organizations

# 4. Transparency Commitments to Executives

VEX-OS makes the following commitments to every executive user:

| Commitment | How It Is Delivered |
| --- | --- |
| You will always know when you are reviewing AI-generated content | HITL queue items carry permanent "AI-generated" label; no mechanism to remove it |
| You can see exactly what data your agents used to produce any output | Task detail view shows context sources used in every inference call |
| You can export all your data at any time in open formats | Data export endpoint available in account settings; JSON and CSV; no proprietary formats |
| Your data is not used to train AI models without your explicit consent | Contractual commitment in Terms of Service; DPA enforced with all providers |
| You can deactivate any agent or revoke any integration immediately | Agent deactivation and integration revocation endpoints available and tested |
| Every action your agents take on your behalf is logged and available to you | Audit log accessible from account settings; 24-month rolling window; exportable |

# 5. Ethics Review Process

**5.1 Pre-Deployment Review**

Before any new agent type, task capability, or integration is deployed to production:

- Engineering lead completes ethics impact checklist (template in VEX-OS-ETP-001)
- Chief AI Officer reviews and approves any capability that introduces new data access, new external action types, or new user-facing AI behavior
- Decision logged in VEX-OS-DL-001 with ethics assessment summary

**5.2 Ongoing Review**

- Quarterly: HITL approval rate review, bias audit of anonymized outputs, prohibited behavior incident log review
- Annually: Full framework review; update if material change to AI capabilities or regulatory environment
- Upon incident: Any output that causes material harm, embarrassment, or compliance concern triggers immediate review and root cause analysis

# 6. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date Issued | August 2026 |
| Review Cycle | Annual; upon material incident or regulatory change |

*VEX-OS-ETF-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
