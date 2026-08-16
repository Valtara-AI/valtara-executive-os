**VALTARA AI**

**Valtara Executive OS**

**DATA MANAGEMENT PLAN**

VEX-OS-DMP-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-DMP-001 |
| --- | --- |
| Version | 1.0 |
| Status | Draft — Internal Review |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | Engineering, Security, Compliance, Data Governance |
| Date | August 2026 |
| Depends On | VEX-OS-SRS-001, VEX-OS-SAD-001 |
| Referenced By | VEX-OS-SEC-001, VEX-OS-PCF-001 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Scope

This Data Management Plan (DMP) defines how data is collected, classified, stored, protected, retained, and disposed of within Valtara Executive OS (VEX-OS). It establishes the governance framework for all data assets throughout their lifecycle, ensuring compliance with applicable privacy regulations and alignment with VEX-OS's security architecture.

This plan applies to all data processed or stored by VEX-OS, including executive profile data, integration data sourced from third-party platforms, AI-generated outputs, audit records, and operational telemetry.

# 2. Data Governance Framework

**2.1 Data Ownership**

| Role | Responsibility |
| --- | --- |
| Data Controller | Valtara Inc. — determines purposes and means of processing executive data |
| Data Processor | Valtara Inc. — processes data on behalf of executive users per agreed terms |
| Executive (Data Subject) | Owns their personal data; has rights to access, correct, export, and delete |
| Chief AI Officer | Accountable for data governance policy; approves this document and all amendments |
| Engineering Lead | Responsible for technical implementation of data controls defined herein |
| LLM Providers (third parties) | Act as sub-processors; governed by their data processing agreements; executive data not used for model training without explicit consent |

**2.2 Data Classification Scheme**

| Classification | Definition | Examples | Controls |
| --- | --- | --- | --- |
| Highly Sensitive | Data whose unauthorized disclosure would cause direct harm to the executive or Valtara | OAuth tokens, executive communications, Voice Profile, task outputs, Executive Intelligence Profile | AES-256 encryption at rest; field-level encryption; access logged; never in application logs; HITL-gated access |
| Sensitive | Data requiring protection but with lower direct harm risk | Agent configurations, morning briefs, HITL decisions, integration metadata | Encrypted at rest (DB-level); role-based access; audit logged on access |
| Internal | Operational data not intended for external disclosure | Task status records, agent definitions, system configuration | Authenticated access only; not individually encrypted beyond DB-level |
| Operational | System health and performance data; no business content | Structured logs, metrics, error events, deployment records | No PII permitted; retained 24 months; separate from application database |

# 3. Data Collection

**3.1 Data Sources**

| Source | Data Collected |
| --- | --- |
| Executive onboarding interview | Role, title, organization, domain, time drains, delegation preferences, communication style, tool list, voice sample text |
| Gmail integration (if connected) | Email thread subjects, sender/recipient metadata, email body (for agent context); no bulk historical download |
| Outlook Mail integration (if connected) | Same as Gmail integration |
| Google Calendar integration (if connected) | Event titles, times, attendees, conference links, location |
| Outlook Calendar integration (if connected) | Same as Google Calendar |
| Slack integration (if connected) | Channel names, message content from specified channels only |
| Agent task interactions | Task prompts, LLM inputs, LLM outputs, HITL decisions, feedback |
| System telemetry | Anonymized performance metrics, error events, API latency; no executive content |

**3.2 Data Minimization Principles**

- Integration adapters request only the minimum OAuth scopes required for stated functionality. No additional scopes requested speculatively.
- Email and calendar data is retrieved contextually (for active agent tasks) rather than bulk-synced to VEX-OS storage.
- Onboarding interview collects only data directly relevant to agent provisioning and Voice Profile construction.
- System logs contain no executive communications, task content, or personally identifiable information beyond user ID.

# 4. Data Storage

**4.1 Storage Architecture**

| Data Type | Storage Location |
| --- | --- |
| Executive profiles and Intelligence Profiles | PostgreSQL via Supabase; dedicated schema |
| Voice Profiles | PostgreSQL; sensitive field classification |
| OAuth tokens (access and refresh) | PostgreSQL; dedicated credentials table |
| Agent definitions and configurations | PostgreSQL; application schema |
| Task records and outputs | PostgreSQL; task schema; outputs stored with reference hash |
| HITL queue and decision records | PostgreSQL; audit-adjacent schema; append-friendly |
| Audit log | PostgreSQL; separate append-only schema; row-level security disables UPDATE/DELETE |
| Morning briefs | PostgreSQL; brief schema; 30-day rolling retention |
| Agent-generated files and attachments | Supabase Storage; signed URLs for access |
| Vector embeddings (semantic context) | pgvector in PostgreSQL |
| Application logs and metrics | Separate operational store; no PII |

**4.2 Encryption Standards**

| Control | Standard |
| --- | --- |
| Encryption at rest | AES-256 minimum for all Highly Sensitive and Sensitive data |
| Field-level encryption | AES-256-GCM for OAuth tokens and Voice Profile; key stored in DB_ENCRYPTION_KEY env var |
| Encryption in transit | TLS 1.3 minimum for all connections between client, application, and database |
| Key management | Encryption keys stored exclusively in .env files; never in code or database; key rotation procedure in VEX-OS-SEC-001 |
| Database connections | SSL required for all database connections; connection strings in .env; never hardcoded |

# 5. Data Retention & Disposal

| Data Type | Retention Period | Disposal Method | Trigger |
| --- | --- | --- | --- |
| Executive profile and Intelligence Profile | Duration of account + 90 days post-deletion | Hard delete from database; deletion confirmed in audit log | Account closure or executive deletion request |
| Voice Profile | Duration of account + 90 days | Hard delete | Account closure or reset request |
| OAuth tokens | Until revoked or account closed | Immediate deletion on revocation; hard delete on account close | Executive revokes integration or closes account |
| Agent definitions | Duration of account + 90 days | Hard delete (archived agents retained until account closure) | Account closure |
| Task records and outputs | 24 months from creation | Hard delete after retention period; export available on request before deletion | Automated retention policy; 24-month rolling window |
| HITL decisions | 24 months | Hard delete after retention; included in compliance export if requested | Automated retention policy |
| Audit log | 24 months active; archived to cold storage after 24 months | Cold storage archival; deletion requires compliance officer approval | Automated archival at 24 months |
| Morning briefs | 30 days rolling window | Automatic deletion at 31 days | Automated daily cleanup job |
| Application logs | 90 days | Automatic deletion | Automated retention policy |
| Operational metrics | 12 months | Automatic deletion | Automated retention policy |

# 6. Data Lineage

VEX-OS maintains traceable data lineage for all AI-generated content to support explainability and compliance requirements.

| Lineage Element | What Is Recorded |
| --- | --- |
| Task inputs | Prompt template version, Voice Profile version, integration data sources used, context window composition |
| LLM inference | Provider, model ID, model version (where available), token counts, inference timestamp |
| Task outputs | Raw output, post-processing applied, output hash, HITL status and outcome |
| HITL decisions | Original output, final output (if edited), decision actor, decision timestamp, rejection reason if applicable |
| Integration data access | Which integration, which data retrieved, timestamp, purpose (which task/agent), data hash |

This lineage chain enables: (a) reproduction of any agent output from its inputs; (b) identification of which integration data informed any output; (c) demonstration of human review for all consequential outputs.

# 7. Data Subject Rights

VEX-OS supports the exercise of data subject rights as required by PIPEDA, GDPR, and CCPA. All rights requests are actioned within 30 days of verified receipt.

| Right | Implementation |
| --- | --- |
| Right of access | Executive can export all stored profile, agent, and task data from account settings in JSON format |
| Right to correction | Executive can update profile, Voice Profile, and agent configurations at any time via dashboard |
| Right to deletion | Account deletion triggers hard delete of all personal data within 90 days; audit records retained per compliance requirements |
| Right to portability | All executive data exportable in JSON and CSV; no proprietary format lock-in |
| Right to restrict processing | Executive can deactivate all integrations and pause all agent processing from dashboard |
| Right to object to AI processing | Executive can disable any agent at any time; HITL governance ensures no AI output is actioned without explicit approval |

# 8. Third-Party Data Sharing

| Third Party | Data Shared |
| --- | --- |
| LLM providers (OpenAI, Anthropic, Google, etc.) | Task prompts including executive context; Voice Profile context |
| Supabase | All database content |
| Vercel / Railway / Fly.io | Application code and runtime logs (no business data) |
| Google (OAuth) | OAuth authorization flow metadata |
| Microsoft (OAuth) | OAuth authorization flow metadata |

VEX-OS does not sell, rent, or broker executive data to any third party for commercial purposes. No advertising platforms receive any data.

# 9. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Reviewer | Valtara Engineering & Compliance Lead |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date Issued | August 2026 |
| Next Review | Annually or upon material change to data architecture or regulatory requirements |

*VEX-OS-DMP-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
