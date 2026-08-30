**VALTARA AI**

**Nyxor**

**RISK REGISTER**

NYXOR-RR-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-RR-001                                                             |
| -------------- | ------------------------------------------------------------------------ |
| Version        | 1.0 — Living Document                                                    |
| Status         | Active — Updated per review cadence                                      |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                            |
| Review Cadence | Monthly; updated immediately on new risk identification or status change |
| Date           | August 2026                                                              |
| Classification | Confidential — Internal Use Only                                         |

# 1. Purpose & Scope

This Risk Register is a living document that identifies, assesses, and tracks risks to Nyxor across technical, operational, ethical, legal, and commercial dimensions. It is updated monthly and immediately upon identification of a material new risk or change in risk status.

Risk likelihood and impact are scored 1–5. Risk rating is the product of likelihood × impact, classified as: High (≥12), Medium (6–11), Low (≤5). All High risks require active mitigation plans with assigned owners.

# 2. Risk Summary

| Rating           | Count at Document Creation |
| ---------------- | -------------------------- |
| High (≥12)       | 4                          |
| Medium (6–11)    | 8                          |
| Low (≤5)         | 4                          |
| Total Identified | 16                         |

# 3. Risk Register

Scoring: Likelihood (L) and Impact (I) rated 1 (Very Low) to 5 (Very High). Rating = L × I.

| ID    | Category         | Risk Description                                                                                           | L   | I   | Rating | Mitigation                                                                                                                | Owner       | Status |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------------------- | --- | --- | ------ | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| TR-01 | Technical        | LLM provider API outage causes NYXOR service disruption; executive briefings and agent tasks fail          | 3   | 4   | High   | Secondary provider configured in .env; automatic failover; status monitoring; 99.5% SLA target                            | Engineering | Open   |
| TR-02 | Technical        | OAuth token compromise gives attacker full access to executive email and calendar                          | 2   | 5   | High   | Field-level AES-256-GCM encryption; tokens never logged; short-lived access tokens; revocation endpoint                   | Engineering | Open   |
| TR-03 | Technical        | API key committed to GitHub repository; leaked credentials allow unauthorized API access and cost exposure | 3   | 4   | High   | Pre-commit hook; CI/CD secret scanning; .gitignore enforced; immediate rotation procedure documented                      | Engineering | Open   |
| TR-04 | Technical        | Database breach exposes executive profiles, Voice Profiles, and task outputs                               | 2   | 5   | High   | AES-256 at rest; field-level encryption; minimal data; row-level security; penetration testing plan                       | Engineering | Open   |
| TR-05 | Technical        | Prompt injection via malicious email content manipulates agent behavior                                    | 3   | 3   | Medium | Email content quoted and sandboxed in prompt context; output validation; prohibited behavior detection                    | Engineering | Open   |
| TR-06 | Technical        | LLM model deprecation by provider requires urgent migration with service disruption risk                   | 3   | 3   | Medium | Model version pinned; 60-day deprecation notice policy required from providers; migration runbook prepared                | Engineering | Open   |
| TR-07 | Technical        | Context window overflow causes loss of critical executive context in complex agent tasks                   | 3   | 2   | Medium | Token budget enforcement; context assembly priority order defined; overflow logged and monitored                          | Engineering | Open   |
| TR-08 | Technical        | Redis queue failure causes loss of pending agent tasks and morning brief generation                        | 2   | 3   | Medium | Redis persistence (AOF) enabled; task records in PostgreSQL before queue; replay mechanism                                | Engineering | Open   |
| AI-01 | AI/Governance    | AI agent produces hallucinated content that executive approves and sends, causing reputational harm        | 3   | 4   | High   | HITL mandatory review; agents instructed to flag uncertainty; source citation required for research outputs               | CAO         | Open   |
| AI-02 | AI/Governance    | Voice Profile captures biased language patterns from executive writing samples                             | 2   | 3   | Medium | Voice Profile extraction prompt excludes attitudinal content; periodic bias audit; executive can reset profile            | CAO         | Open   |
| AI-03 | AI/Governance    | Executive over-reliance on AI output without adequate review increases HITL approval rate artificially     | 2   | 3   | Medium | Edit rate monitored alongside approval rate; declining edit rate with high approval triggers review advisory              | CAO         | Open   |
| LC-01 | Legal/Compliance | Material data breach triggers PIPEDA notification obligations and reputational damage                      | 2   | 4   | Medium | Incident response plan in NYXOR-SEC-001; 72-hour notification procedure; legal counsel on retainer                        | CAO         | Open   |
| LC-02 | Legal/Compliance | Regulatory change (new AI Act or privacy law) requires material product changes on short timeline          | 2   | 3   | Medium | Privacy & compliance framework reviewed annually; regulatory monitoring; architecture designed for policy configurability | CAO         | Open   |
| LC-03 | Legal/Compliance | LLM provider changes data processing terms in ways that conflict with NYXOR data commitments               | 2   | 3   | Medium | Provider-agnostic architecture allows rapid provider switch; DPA terms reviewed at renewal; secondary provider ready      | CAO         | Open   |
| CM-01 | Commercial       | Slow executive onboarding completion rate limits agent workforce activation and early value delivery       | 3   | 2   | Medium | Onboarding UX tested for completion rate; target ≤20 minutes; partial completion saves progress                           | Product     | Open   |
| CM-02 | Commercial       | Executive churns after 30-day trial if HITL approval rate does not reach target threshold                  | 2   | 2   | Low    | Voice Profile refinement feedback loop; onboarding quality improvement; proactive calibration prompts at day 7 and 14     | Product     | Open   |
| CM-03 | Commercial       | LLM inference costs exceed pricing model assumptions as usage scales                                       | 2   | 2   | Low    | Per-task token cost monitoring; model tier routing optimized for cost; cost alerts at defined thresholds                  | Engineering | Open   |
| CM-04 | Commercial       | A major competitor releases a direct equivalent product with greater distribution advantage                | 2   | 2   | Low    | NYXOR moat: Voice Profile, dynamic onboarding, HITL governance, domain-agnosticism; differentiation maintained            | CAO         | Open   |

# 4. Risk Review Cadence

| Cadence   | Activity                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Monthly   | Full register review; risk ratings updated; mitigations assessed for effectiveness; new risks added         |
| Quarterly | Risk register presented to CAO; High risks require written status update; closed risks archived             |
| On event  | New risk identified, material status change, or incident — register updated within 5 business days          |
| Annually  | Full risk framework review; scoring methodology assessed; register scope reviewed against product evolution |

# 5. Document Approval

| Role         | Name                              |
| ------------ | --------------------------------- |
| Author       | Francis Ogbogu — Chief AI Officer |
| Approver     | Francis Ogbogu — Chief AI Officer |
| Initial Date | August 2026                       |
| Last Updated | August 2026                       |
| Next Review  | September 2026                    |

_NYXOR-RR-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
