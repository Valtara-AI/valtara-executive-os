**VALTARA AI**

**Nyxor**

**PRIVACY POLICY**

NYXOR-LGL-002 · Version 1.0 (Draft) · August 2026

| Document ID    | NYXOR-LGL-002                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version        | 1.0 — **Draft, not yet published**                                                                                                                                                                                                        |
| Status         | **Requires qualified legal counsel review before publication.** Content is derived from NYXOR's actual data architecture (NYXOR-DMP-001, NYXOR-PCF-001) for factual accuracy, not drafted independently of what the system actually does. |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI (Privacy Officer)                                                                                                                                                                           |
| Depends On     | NYXOR-DMP-001 (Data Management Plan), NYXOR-PCF-001 (Privacy & Compliance Framework)                                                                                                                                                      |
| Classification | Public (once approved) — Draft is Confidential until then                                                                                                                                                                                 |

---

## 1. Who We Are

Valtara Inc., operating as Valtara AI ("**Valtara**," "**we**"), based in Saskatoon, Saskatchewan, Canada, is the data controller for personal information processed through Nyxor ("**NYXOR**"). Our Privacy Officer is Francis Ogbogu, Chief AI Officer, reachable at fcogbogu@gmail.com.

This policy is written to comply with Canada's PIPEDA, and is aligned with the EU's GDPR and California's CCPA for customers in those jurisdictions.

## 2. What We Collect, and Why

| Source                           | What's collected                                                                                                     | Why                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding interview             | Your role, title, organization, industry, stated time drains, delegation preferences, communication style, tool list | To build your Executive Intelligence Profile and Voice Profile, and provision an initial AI agent workforce matched to your role |
| Google account (if connected)    | Gmail thread subjects, sender/recipient metadata, message body; Calendar event titles, times, attendees, locations   | Only what a specific agent task needs, retrieved contextually — never a bulk download of your mailbox or calendar history        |
| Microsoft account (if connected) | Same categories as Google, via Outlook Mail/Calendar/Teams                                                           | Same as above                                                                                                                    |
| Slack (if connected)             | Channel names and message content from channels you specify                                                          | Same as above                                                                                                                    |
| PandaDoc (if connected)          | Document status, recipients, and content for documents you create through NYXOR                                      | Board/investor document creation and send workflows                                                                              |
| Agent task activity              | Task prompts, the text sent to and returned by the AI model, your approve/edit/reject decisions                      | This is the core function of the product, and the record of your human review of every AI output                                 |
| Billing                          | Your subscription tier, billing status, and payment history are managed by Stripe on our behalf                      | Stripe processes your card details directly — Valtara never receives or stores your full card number                             |
| Account/session                  | Email address, name, and a session credential from Google/Microsoft sign-in                                          | To authenticate you and enforce role-based access                                                                                |

We only request the minimum access (OAuth scopes) required for the features you actually use, and we do not collect data speculatively for features you haven't enabled.

## 3. How We Use Your Information

We use your information to: operate and improve NYXOR; generate AI agent outputs for your review; send you transactional notifications (e.g., "an item needs your approval," sent via Resend); process billing (via Stripe); and comply with legal obligations. **We do not sell, rent, or broker your personal information to any third party, and no advertising platform receives any of your data.**

## 4. AI Processing and Human Review

When an agent performs a task, relevant context — which may include content from your connected accounts — is sent to a third-party AI model provider (Anthropic by default) to generate a response. Our agreement with our model providers prohibits using your data to train their models without your separate, explicit consent.

**No AI-generated output is sent, posted, or otherwise acted upon without your (or your Delegate's) explicit approval.** This human-in-the-loop requirement is enforced architecturally, not as a setting you can turn off.

## 5. Who We Share Data With

We share data only with the service providers ("sub-processors") who help us operate NYXOR, each bound by a data processing agreement:

| Sub-processor                                    | What they receive                                                                                  | Purpose                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Anthropic (or configured alternate LLM provider) | Task prompts and relevant context                                                                  | AI inference                                                    |
| Supabase                                         | All database content                                                                               | Primary data storage (PostgreSQL)                               |
| Railway / Vercel                                 | Application code and runtime logs only — no business data                                          | Application hosting                                             |
| Stripe                                           | Billing/subscription information; payment details go directly to Stripe, not through Valtara       | Subscription billing                                            |
| Resend                                           | Your email address and notification content                                                        | Transactional email (approval reminders, task-complete notices) |
| Google / Microsoft / Slack / PandaDoc            | OAuth authorization metadata, and whatever data you've authorized NYXOR to access on that platform | The integrations you've chosen to connect                       |

We do not share your data for marketing purposes, and we do not sell it.

## 6. How We Protect Your Data

- OAuth tokens and your Voice Profile are encrypted at rest with AES-256-GCM, field-level, distinct from ordinary database-level protection.
- All connections use TLS 1.3 in transit.
- Access to your data within NYXOR is role-based and audit-logged; the audit log itself is tamper-evident (cryptographically chained) and cannot be altered, even by system administrators.
- No agent can take an externally-visible action (send, post, modify) without an approval record that a database-level constraint independently verifies exists and is approved.

## 7. Data Retention

| Data                                         | Retention                                                  | What happens after                                      |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Profile, Intelligence Profile, Voice Profile | Duration of your account + 90 days                         | Permanently deleted                                     |
| OAuth tokens                                 | Until you disconnect the integration or close your account | Deleted immediately on disconnect                       |
| Task records and outputs, HITL decisions     | 24 months from creation                                    | Deleted; export available on request beforehand         |
| Audit log                                    | 24 months active, then archived                            | Archival requires compliance-officer approval to access |
| Morning briefs                               | 30 days                                                    | Automatically deleted                                   |
| Application logs                             | 90 days                                                    | Automatically deleted; contain no personal content      |

## 8. Your Rights

You can, at any time: **access** a full export of your data from account settings (JSON/CSV); **correct** your profile, Voice Profile, or agent configuration directly in the dashboard; **delete** your account, which triggers deletion of your personal data per the schedule above; **restrict processing** by disconnecting integrations or deactivating agents; and **object to AI processing** of any specific kind by disabling the relevant agent — nothing an agent produces is ever acted on without your approval in the first place.

We respond to rights requests within 30 days. To exercise any of these rights beyond what's available in-product, contact fcogbogu@gmail.com.

## 9. International Data Transfers

NYXOR is currently deployed for North American customers. Where data is processed by a provider outside your region (e.g., an LLM provider's API), we require a data processing agreement with appropriate safeguards (such as Standard Contractual Clauses where applicable). Database region is configurable for enterprise customers with specific data-residency requirements.

## 10. Children's Privacy

NYXOR is a business tool intended for use by adults in a professional capacity. It is not directed at, and we do not knowingly collect information from, children.

## 11. Changes to This Policy

We will notify active customers by email at least 30 days before any material change takes effect.

## 12. Contact

Privacy Officer: Francis Ogbogu, Chief AI Officer — fcogbogu@gmail.com. If you're not satisfied with our response, Canadian residents may escalate to the Office of the Privacy Commissioner of Canada.

---

_NYXOR-LGL-002 · Version 1.0 (Draft) · August 2026 · Not yet approved for publication_
