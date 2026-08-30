**VALTARA AI**

**Nyxor**

**PRODUCT REQUIREMENTS DOCUMENT**

NYXOR-PRD-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-PRD-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Draft — Internal Review                       |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Product, Engineering, Design, QA, Governance  |
| Date           | August 2026                                   |
| Depends On     | NYXOR-PB-001 (Product Brief)                  |
| Classification | Confidential — Internal Use Only              |

# 1. Purpose & Scope

This Product Requirements Document (PRD) defines the functional and non-functional requirements for Nyxor. It serves as the authoritative specification for the product team, engineering, design, QA, and governance stakeholders. All feature development must be traceable to a requirement defined in this document.

This PRD governs Version 1.0 of NYXOR, covering the Minimum Viable Product (MVP) through the first stable release. Requirements are classified by priority using MoSCoW notation: Must Have (M), Should Have (S), Could Have (C), and Will Not Have (W) for this release.

# 2. Product Overview

NYXOR is a domain-agnostic, AI-powered Executive Operating System. It is not a task manager, a note-taking tool, or a general-purpose AI assistant. It is a governed operating layer that sits between the executive and all the work that should not require their direct involvement.

The product comprises three functional layers:

- Onboarding Agent — discovers the executive's role, maps their workflow, and dynamically provisions a custom agent workforce
- Executive Dashboard — a personalized command center for briefings, decisions, communications, and agent oversight
- Dynamic Agent Workforce — custom AI agents that execute delegated work under a configurable HITL governance model

# 3. User Personas

NYXOR is designed for one primary user type with two secondary user types:

**3.1 Primary Persona — The Executive**

| Attribute             | Detail                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Title                 | CEO, Founder, President, VP, Director, Managing Partner, Principal, Executive Director                 |
| Industry              | Any — technology, finance, healthcare, law, consulting, nonprofit, government, real estate, and others |
| Technical proficiency | Low to moderate. Does not configure systems. Expects the product to adapt to them.                     |
| Primary goal          | Reclaim high-value time; maintain full control with minimal operational involvement                    |
| Key pain points       | Information overload, context switching, delegation without visibility, communication volume           |
| Success definition    | Spends >50% of time on decisions and execution that only they can perform                              |
| Device preference     | Desktop primary (web app); mobile secondary                                                            |
| Tool environment      | Google Workspace or Microsoft 365; may also use Slack, Notion, Salesforce, or domain-specific tools    |

**3.2 Secondary Persona — The Chief of Staff / EA**

| Attribute         | Detail                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Role              | Human delegate who manages the executive's calendar, communications, and priorities                         |
| NYXOR interaction | Reviews agent outputs on behalf of the executive; manages HITL approval queue                               |
| Key need          | Visibility into agent task status; ability to approve, edit, or escalate without full executive involvement |
| Access level      | Delegated — cannot modify agent configuration or workforce structure                                        |

**3.3 Secondary Persona — The IT / Security Administrator**

| Attribute         | Detail                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Role              | Responsible for enterprise deployment, integration configuration, and security compliance |
| NYXOR interaction | Configures SSO, manages .env secrets, sets data residency, reviews audit logs             |
| Key need          | Clear documentation, role-based access controls, audit trail, compliance reporting        |
| Access level      | Administrative — system configuration only; no access to executive content                |

# 4. User Stories & Acceptance Criteria

## 4.1 Onboarding Agent

| ID    | User Story                                                                                                                                   | Acceptance Criteria                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| OA-01 | As an executive, I want to be interviewed by an AI agent on first login so that the system understands my role without manual configuration. | Onboarding interview completes in ≤20 min; Executive Intelligence Profile generated; agent workforce provisioned automatically. |
| OA-02 | As an executive, I want the onboarding agent to identify my top time drains from my responses so the system prioritizes the right agents.    | At least 3 delegation candidates identified and mapped to agent types; confirmed by executive before provisioning.              |
| OA-03 | As an executive, I want to review the proposed agent workforce before it is activated so I retain full control over what is delegated.       | Summary of proposed agents presented with descriptions; executive can accept, modify, or remove before activation.              |
| OA-04 | As an executive, I want to re-run the onboarding process when my role changes so the agent workforce stays relevant.                         | Re-onboarding option available from settings; existing agents preserved unless explicitly removed.                              |

## 4.2 Executive Dashboard

| ID    | User Story                                                                                                                                            | Acceptance Criteria                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB-01 | As an executive, I want a personalized morning brief delivered each day so I start informed without reading through raw sources.                      | Brief generated by 06:00 executive local time; covers calendar, key communications, news relevant to stated priorities, pending agent approvals. |
| DB-02 | As an executive, I want to see all pending agent work requiring my review in one place so I can approve or redirect efficiently.                      | HITL queue displays all pending items; each shows: agent name, task summary, output preview, approve/edit/reject controls.                       |
| DB-03 | As an executive, I want to see the status of all active agent tasks in real time so I have full visibility without asking.                            | Task dashboard shows: agent name, task, status (in-progress/checkpoint/complete), last updated timestamp.                                        |
| DB-04 | As an executive, I want the dashboard to surface decision items that require my input today so nothing falls through the gaps.                        | Decision inbox populated from agent outputs, calendar context, and communication analysis; items sortable by urgency.                            |
| DB-05 | As an executive, I want calendar intelligence that flags scheduling conflicts, over-committed days, and meeting gaps so I can protect deep work time. | Calendar analysis runs daily; flags surfaced in morning brief and dashboard; no autonomous calendar changes without approval.                    |

## 4.3 Agent Workforce

| ID    | User Story                                                                                                                              | Acceptance Criteria                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AW-01 | As an executive, I want each agent to produce outputs in my communication style so all work sounds authentically like me.               | Voice Profile calibrated during onboarding; applied to all agent outputs; executive can provide feedback to refine.                           |
| AW-02 | As an executive, I want to set the HITL mode for each agent independently so I control how much autonomy each has.                      | Three HITL modes configurable per agent: Auto-Draft→Review, Checkpoint, Autonomous with Report; changeable at any time.                       |
| AW-03 | As an executive, I want to assign a task to an agent with a natural language instruction so delegation requires no technical knowledge. | Task assigned via plain English prompt; agent confirms understanding and scope before beginning; confirmation includes estimated output time. |
| AW-04 | As an executive, I want to approve, edit, or reject agent outputs before they are sent or published so I retain final authority.        | All outputs requiring approval held in HITL queue; no output sent or published without explicit executive action; edit mode available inline. |
| AW-05 | As an executive, I want agents to improve their output quality based on my feedback so the system gets smarter over time.               | Feedback captured on every HITL action; applied to agent Voice Profile and task templates within 24 hours.                                    |
| AW-06 | As an executive, I want to add, rename, or retire agents as my role evolves so the workforce stays aligned to current reality.          | Agent management available from settings; add/rename/archive without data loss; archived agents retrievable.                                  |

## 4.4 Integrations

| ID    | User Story                                                                                                                                      | Acceptance Criteria                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN-01 | As an executive, I want NYXOR to connect to my email so agents can read, draft, and (with approval) send communications.                        | Gmail and Outlook connected via API; OAuth 2.0 authentication; read and draft access required; send requires explicit HITL approval.                      |
| IN-02 | As an executive, I want NYXOR to connect to my calendar so agents can inform me of scheduling decisions and prepare meeting briefings.          | Google Calendar and Outlook Calendar connected via API; read access for briefings; write access requires explicit approval per action.                    |
| IN-03 | As an executive, I want to connect additional tools relevant to my role (Slack, Notion, Salesforce, etc.) so agents have the context they need. | Integration framework supports additional API connections; each integration requires explicit executive authorization; scopes documented per integration. |

## 4.5 Security & Access

| ID     | User Story                                                                                                                     | Acceptance Criteria                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | As an administrator, I want SSO authentication so executives log in with existing enterprise credentials.                      | Google Workspace and Microsoft 365 SSO supported via OAuth 2.0; MFA enforced; session timeout configurable.                                     |
| SEC-02 | As an administrator, I want role-based access control so delegates have appropriate but limited access.                        | Three roles defined: Executive (full), Delegate (HITL queue access only), Administrator (system configuration only); roles assignable per user. |
| SEC-03 | As an administrator, I want a complete audit log of all agent actions and executive approvals so I can demonstrate compliance. | Immutable audit log records: timestamp, agent, action, input, output, HITL decision, executive identifier; exportable in CSV and JSON.          |

# 5. Functional Requirements

## 5.1 Onboarding Agent — Functional Requirements

| ID       | Requirement                                                                     | Priority | Notes                                                                              |
| -------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| FR-OA-01 | Conduct structured discovery interview via conversational AI interface          | M        | Minimum 12 discovery questions; branching logic based on role                      |
| FR-OA-02 | Generate Executive Intelligence Profile from interview responses                | M        | Profile stored in Supabase; versioned on re-onboarding                             |
| FR-OA-03 | Propose custom agent workforce based on profile                                 | M        | Minimum 2, maximum 8 agents per executive at onboarding                            |
| FR-OA-04 | Allow executive to review, rename, and modify proposed agents before activation | M        | No agent activated without explicit executive confirmation                         |
| FR-OA-05 | Extract Voice Profile from interview responses and writing samples              | M        | Profile captures: tone, formality level, sentence structure, preferred terminology |
| FR-OA-06 | Support re-onboarding without loss of existing agent data                       | S        | Incremental update; existing agents preserved by default                           |
| FR-OA-07 | Complete full onboarding in ≤20 minutes for a cooperative executive             | M        | Performance requirement; progress indicator displayed throughout                   |

## 5.2 Executive Dashboard — Functional Requirements

| ID       | Requirement                                                                   | Priority | Notes                                                                                             |
| -------- | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| FR-DB-01 | Generate and deliver personalized morning brief by 06:00 executive local time | M        | Brief includes: calendar summary, HITL queue count, key communications, priority flags            |
| FR-DB-02 | Display HITL approval queue with preview, approve, edit, and reject controls  | M        | Queue sorted by urgency; inline editing available; audit log entry created on every action        |
| FR-DB-03 | Display real-time agent task status board                                     | M        | Polling interval ≤30 seconds; status: queued, in-progress, at-checkpoint, complete, failed        |
| FR-DB-04 | Surface decision items requiring executive input                              | M        | Populated from: agent outputs, calendar, email analysis; sortable by urgency and due date         |
| FR-DB-05 | Display calendar intelligence analysis daily                                  | S        | Flag: over-committed days, back-to-back meetings, missing prep time, unprotected deep work blocks |
| FR-DB-06 | Support dark and light display modes                                          | S        | Preference stored per user; applied immediately on toggle                                         |
| FR-DB-07 | Deliver mobile-responsive layout for dashboard                                | S        | Minimum breakpoint: 375px; HITL queue fully operable on mobile                                    |

## 5.3 Agent Workforce — Functional Requirements

| ID       | Requirement                                                                   | Priority | Notes                                                                                  |
| -------- | ----------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| FR-AW-01 | Apply Voice Profile to all agent-generated content                            | M        | Profile applied at generation time; not post-processed                                 |
| FR-AW-02 | Support three HITL modes per agent: Auto-Draft→Review, Checkpoint, Autonomous | M        | Mode configurable independently per agent; change takes effect on next task            |
| FR-AW-03 | Accept task assignments via natural language prompt                           | M        | Agent confirms scope before execution; ambiguous prompts trigger clarification request |
| FR-AW-04 | Hold all outputs requiring approval in HITL queue before any external action  | M        | Hard constraint; no bypass mechanism available to agents                               |
| FR-AW-05 | Capture and apply executive feedback to Voice Profile and task templates      | M        | Feedback captured on approve/edit/reject; applied within 24 hours                      |
| FR-AW-06 | Log all agent actions with full input/output detail to audit trail            | M        | Includes: prompt, model used, output, HITL status, timestamp                           |
| FR-AW-07 | Support multi-step task execution with checkpoint notifications               | S        | Checkpoint triggers HITL queue entry; task paused until executive action               |
| FR-AW-08 | Support parallel execution of multiple agent tasks simultaneously             | S        | Each agent task isolated; no cross-agent data sharing without explicit configuration   |

# 6. Non-Functional Requirements

| ID     | Requirement                           | Category     | Target                                               |
| ------ | ------------------------------------- | ------------ | ---------------------------------------------------- |
| NFR-01 | API response time for dashboard load  | Performance  | ≤2 seconds (p95)                                     |
| NFR-02 | Agent task initiation to first output | Performance  | ≤30 seconds for standard tasks                       |
| NFR-03 | Morning brief generation time         | Performance  | Complete by 06:00 executive local time               |
| NFR-04 | System availability                   | Reliability  | 99.5% uptime SLA (excluding scheduled maintenance)   |
| NFR-05 | Data encryption at rest               | Security     | AES-256 minimum                                      |
| NFR-06 | Data encryption in transit            | Security     | TLS 1.3 minimum                                      |
| NFR-07 | All secrets stored in .env            | Security     | Hard constraint; enforced by CI/CD pipeline check    |
| NFR-08 | PIPEDA compliance                     | Compliance   | Mandatory for Canadian deployment                    |
| NFR-09 | GDPR alignment                        | Compliance   | Required for any EU user data                        |
| NFR-10 | Audit log retention                   | Compliance   | Minimum 24 months; exportable on request             |
| NFR-11 | Model provider switchability          | Architecture | Provider changeable via config with zero code change |
| NFR-12 | Platform-agnostic deployment          | Architecture | No hard dependency on any single cloud provider      |
| NFR-13 | Accessibility standard                | Usability    | WCAG 2.1 AA compliance for dashboard UI              |
| NFR-14 | Concurrent users supported            | Scalability  | 1,000 concurrent sessions at MVP; 10,000 at scale    |

# 7. Out of Scope — Version 1.0

The following are explicitly excluded from NYXOR Version 1.0 and will be considered for future releases:

- Native mobile applications (iOS/Android) — web-responsive design covers mobile use in v1.0
- Real-time voice interface — text-based interaction only in v1.0
- Agent-to-agent autonomous collaboration without executive assignment — all tasks must be initiated by the executive or delegate
- Financial transaction execution — NYXOR may draft financial communications but will not execute transactions
- Direct API integrations beyond Gmail, Outlook, Google Calendar, Outlook Calendar, and Slack in MVP
- White-label or reseller configuration interface
- On-premise self-hosted deployment — cloud-hosted only in v1.0

# 8. Assumptions & Dependencies

| Item       | Detail                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Assumption | Executives have access to either Google Workspace or Microsoft 365 for email and calendar integration |
| Assumption | The executive completes the full onboarding interview before agent workforce is activated             |
| Assumption | At least one LLM provider API key is configured in the .env file before system operation              |
| Dependency | LLM provider APIs (OpenAI, Anthropic, Google, or equivalent) — must be active and credentialed        |
| Dependency | Supabase — for user data, agent profiles, Voice Profile storage, and audit logs                       |
| Dependency | Google OAuth 2.0 and Microsoft OAuth 2.0 — for SSO and integration authentication                     |
| Dependency | NYXOR-SRS-001 (Software Requirements Specification) — for detailed system behavior specification      |
| Dependency | NYXOR-SAD-001 (System Architecture Document) — for technical implementation decisions                 |

# 9. MoSCoW Priority Summary

| Priority          | Count — This Document                |
| ----------------- | ------------------------------------ |
| Must Have (M)     | 22 functional requirements           |
| Should Have (S)   | 9 functional requirements            |
| Could Have (C)    | 0 — deferred to backlog              |
| Will Not Have (W) | 7 — explicitly out of scope for v1.0 |

# 10. Document Approval

| Role        | Name                                                  |
| ----------- | ----------------------------------------------------- |
| Author      | Francis Ogbogu — Chief AI Officer                     |
| Reviewer    | Valtara Product & Engineering Lead                    |
| Approver    | Francis Ogbogu — Chief AI Officer                     |
| Date Issued | August 2026                                           |
| Next Review | Upon material change to product scope or architecture |

_NYXOR-PRD-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
