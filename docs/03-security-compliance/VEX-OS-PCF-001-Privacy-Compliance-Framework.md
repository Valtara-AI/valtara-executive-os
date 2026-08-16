**VALTARA AI**

**Valtara Executive OS**

**PRIVACY & COMPLIANCE FRAMEWORK**

VEX-OS-PCF-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-PCF-001 |
| --- | --- |
| Version | 1.0 |
| Status | Draft — Internal Review |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | Legal, Compliance, Engineering, Enterprise Clients |
| Date | August 2026 |
| Depends On | VEX-OS-DMP-001, VEX-OS-SEC-001 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Scope

This Privacy & Compliance Framework defines VEX-OS's approach to privacy regulation compliance, data subject rights fulfillment, and privacy-by-design implementation. It governs how VEX-OS collects, processes, stores, and protects personal data in compliance with PIPEDA (Canada), GDPR (European Union), and CCPA (California), and establishes the framework for future regulatory alignment as the product expands to new jurisdictions.

# 2. Regulatory Framework

## 2.1 PIPEDA — Personal Information Protection and Electronic Documents Act (Canada)

PIPEDA governs the collection, use, and disclosure of personal information in the course of commercial activities in Canada. As a Canadian company processing data of Canadian individuals, PIPEDA compliance is the primary regulatory obligation for VEX-OS.

| PIPEDA Principle | VEX-OS Implementation |
| --- | --- |
| 1. Accountability | Chief AI Officer designated as privacy officer; privacy responsibilities documented; this framework constitutes the privacy management program |
| 2. Identifying purposes | Data collection purposes identified and documented in VEX-OS-DMP-001; purposes disclosed to executives at onboarding |
| 3. Consent | Explicit consent obtained at onboarding for each data category; OAuth consent screens used for integration authorization; consent records maintained |
| 4. Limiting collection | Data minimization enforced — only data necessary for stated purpose collected; minimum OAuth scopes requested; documented in VEX-OS-DMP-001 |
| 5. Limiting use, disclosure, retention | Data used only for VEX-OS service delivery; not shared or sold; retention periods defined in VEX-OS-DMP-001 |
| 6. Accuracy | Executive can update profile and integration data at any time; feedback mechanism for correcting AI-generated content |
| 7. Safeguards | Encryption, access controls, and audit logging defined in VEX-OS-SEC-001 |
| 8. Openness | Privacy policy published; this framework available to enterprise clients; practices disclosed on request |
| 9. Individual access | Data export available from account settings; response to access requests within 30 days |
| 10. Challenging compliance | Complaints directed to privacy officer (fcogbogu@gmail.com); OPC escalation path documented |

## 2.2 GDPR Alignment

GDPR applies to VEX-OS where it processes personal data of individuals in the European Union, regardless of where Valtara is established. Current v1.0 deployment targets North America; GDPR alignment is established now to support EU expansion.

| GDPR Requirement | VEX-OS Implementation |
| --- | --- |
| Lawful basis for processing | Contractual necessity (service delivery) and explicit consent (optional data categories); documented per data type in VEX-OS-DMP-001 |
| Data subject rights (Articles 15–22) | Access, rectification, erasure, portability, restriction, and objection rights implemented; response within 30 days |
| Data Protection by Design (Article 25) | Privacy-by-design enforced architecturally; minimum data collection; encryption by default |
| Records of processing activities (Article 30) | VEX-OS-DMP-001 serves as the processing activity record |
| Data breach notification (Article 33) | 72-hour notification to supervisory authority on confirmed breach with material risk; individual notification if high risk to rights |
| Data transfers outside EEA | LLM provider DPAs include Standard Contractual Clauses where applicable; data residency configurable |
| DPA with processors | Data Processing Agreements required with all sub-processors (Supabase, LLM providers, hosting providers) |

## 2.3 CCPA Alignment

CCPA applies to VEX-OS for California residents if revenue or data processing thresholds are met. Alignment is established proactively.

| CCPA Requirement | VEX-OS Implementation |
| --- | --- |
| Right to know | Categories of data collected disclosed in privacy policy and this framework; specific data accessible via export |
| Right to delete | Account deletion triggers data deletion per retention schedule in VEX-OS-DMP-001 |
| Right to opt-out of sale | VEX-OS does not sell personal information; opt-out mechanism not applicable but stated clearly |
| Non-discrimination | Service quality not degraded for exercising privacy rights |

# 3. Consent Management

| Consent Event | Method |
| --- | --- |
| Initial data collection at onboarding | Explicit in-product consent screen; checkboxes for each data category; timestamp recorded |
| Gmail/Outlook integration | Google/Microsoft OAuth consent screen; scopes explicitly listed |
| Google/Outlook Calendar integration | Same as email integration |
| Slack integration | Slack OAuth consent screen |
| Marketing communications (if applicable) | Opt-in only; separate from service consent |

# 4. Privacy Impact Assessment

A Privacy Impact Assessment (PIA) is required before deploying any new feature that:

- Introduces a new category of personal data collection
- Expands the scope of an existing integration beyond its currently consented scopes
- Introduces a new third-party processor with access to executive personal data
- Changes data retention periods or disposal methods
- Enables any new form of automated decision-making with material effect on individuals

PIAs are conducted using the Office of the Privacy Commissioner of Canada's PIA framework. Completed PIAs are stored in the compliance document archive and referenced in VEX-OS-DL-001.

# 5. Cross-Border Data Transfers

| Scenario | Control |
| --- | --- |
| LLM provider inference (data sent to provider API) | Provider DPA with no-training clause; provider selected to meet data residency requirements of deployment; data residency configurable |
| Database hosting (Supabase) | Region selection configurable; Canadian region available; enterprise deployments can specify required region |
| Application hosting (Vercel/Railway) | Application code only; business data not stored at hosting layer; logs contain no PII by policy |

# 6. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date Issued | August 2026 |
| Review Cycle | Annual; upon entry to new jurisdiction; upon material regulatory change |

*VEX-OS-PCF-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
