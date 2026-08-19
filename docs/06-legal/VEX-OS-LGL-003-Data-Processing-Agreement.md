**VALTARA AI**

**Valtara Executive OS**

**DATA PROCESSING AGREEMENT**

VEX-OS-LGL-003 · Version 1.0 (Draft) · August 2026

| Document ID    | VEX-OS-LGL-003                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version        | 1.0 — **Draft, not yet published**                                                                                                                                                                                                                                                                                                                                                            |
| Status         | **Requires qualified legal counsel review before execution with any customer.** Structured against GDPR Article 28 processor-obligation requirements and VEX-OS-PCF-001's cross-border-transfer framework; not a substitute for jurisdiction-specific legal review (this DPA will need to satisfy Canadian, and potentially EU/UK and US state, requirements depending on customer location). |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI                                                                                                                                                                                                                                                                                                                                                 |
| Depends On     | VEX-OS-LGL-002 (Privacy Policy), VEX-OS-DMP-001, VEX-OS-PCF-001                                                                                                                                                                                                                                                                                                                               |
| Audience       | Enterprise customers requiring a signed DPA as a condition of purchase                                                                                                                                                                                                                                                                                                                        |
| Classification | Public template (once approved) — Draft is Confidential until then                                                                                                                                                                                                                                                                                                                            |

---

This Data Processing Agreement ("**DPA**") forms part of the Terms of Service (VEX-OS-LGL-001) between Valtara Inc., operating as Valtara AI ("**Processor**," "**Valtara**"), and the customer entity that has agreed to VEX-OS's Terms of Service ("**Controller**," "**Customer**"), and applies to the extent Valtara processes personal data on the Customer's behalf in the course of providing Valtara Executive OS ("**the Service**").

## 1. Definitions

Terms such as "personal data," "processing," "controller," "processor," "data subject," and "sub-processor" have the meanings given in applicable data protection law (including GDPR Article 4, where applicable, and PIPEDA's equivalent concepts). "**Personal Data**" means any data relating to an identified or identifiable natural person processed by Valtara on Customer's behalf under the Terms of Service — in practice, the categories described in Section 2 of VEX-OS-LGL-002 (Privacy Policy).

## 2. Subject Matter and Duration

2.1. Valtara processes Personal Data solely to provide the Service to Customer, for the duration of the Customer's subscription plus the retention period described in VEX-OS-LGL-002 §7 and VEX-OS-DMP-001 §5.

2.2. The nature and purpose of processing, categories of data subjects (Customer's executives and their invited Delegates), and categories of Personal Data are as described in VEX-OS-LGL-002 §2.

## 3. Processor Obligations

Valtara shall:

3.1. Process Personal Data only on Customer's documented instructions (which include operating the Service as described in VEX-OS-LGL-001), unless required otherwise by law, in which case Valtara will inform Customer before processing unless legally prohibited from doing so.

3.2. Ensure persons authorized to process Personal Data are bound by confidentiality obligations.

3.3. Implement the technical and organizational security measures described in Section 6 below.

3.4. Not engage a new sub-processor without providing Customer prior notice and an opportunity to object, per Section 5.

3.5. Assist Customer, insofar as reasonably possible, in responding to data subject rights requests (access, correction, deletion, portability, restriction, objection) — in practice, most of these are self-serve in-product per VEX-OS-LGL-002 §8, with Valtara providing direct assistance for anything not available there.

3.6. Notify Customer without undue delay, and in any case within 72 hours of becoming aware, of any Personal Data breach affecting Customer's data, per VEX-OS-PCF-001 §2.2's breach-notification commitment.

3.7. At Customer's choice, delete or return all Personal Data at the end of the engagement, except where retention is required by law, consistent with the retention schedule in VEX-OS-DMP-001 §5.

3.8. Make available to Customer information reasonably necessary to demonstrate compliance with this DPA, and allow for audits, including inspections, conducted by Customer or an auditor mandated by Customer, subject to reasonable notice and confidentiality.

## 4. Controller Obligations

Customer warrants that it has a lawful basis for the Personal Data it causes to be processed through the Service (e.g., its executives' consent, or contractual necessity for their employment relationship with Customer), and that its instructions to Valtara comply with applicable law.

## 5. Sub-processors

5.1. Customer provides general authorization for Valtara to engage the sub-processors listed in VEX-OS-LGL-002 §5 (currently: Anthropic or the configured LLM provider, Supabase, Railway/Vercel, Stripe, Resend, and the third-party integration platforms — Google, Microsoft, Slack, PandaDoc — Customer's own executives choose to connect).

5.2. Valtara will notify Customer of any intended addition or replacement of a sub-processor with material access to Personal Data, giving Customer the opportunity to object on reasonable grounds. If unresolved, Customer may terminate the affected part of the Service.

5.3. Valtara remains liable for each sub-processor's performance of its data protection obligations, via a written agreement imposing materially equivalent obligations to this DPA.

## 6. Security Measures

Per VEX-OS-SEC-001 and VEX-OS-DMP-001 §4.2:

- AES-256-GCM field-level encryption for OAuth tokens and Voice Profile data; AES-256 minimum at rest for all Sensitive and Highly Sensitive data categories.
- TLS 1.3 minimum for all connections between client, application, and database.
- Role-based access control enforced server-side on every request, independent of any client-side UI restriction.
- An append-only, cryptographically hash-chained audit log that cannot be altered or deleted by any role, including administrators.
- A database-level constraint (not merely an application setting) that prevents any agent action with external visibility from executing without a recorded, approved human-review decision.
- Encryption keys stored exclusively in environment configuration, never in source code or the database itself.

## 7. International Transfers

Where Personal Data is transferred outside Customer's region (for example, to an LLM provider's API infrastructure), Valtara ensures appropriate safeguards are in place — currently, sub-processor agreements including no-training-on-customer-data commitments, with Standard Contractual Clauses incorporated where the transfer is subject to GDPR. Database region is configurable for Customers with specific data-residency requirements; contact fcogbogu@gmail.com to arrange.

## 8. Liability

_[Placeholder — requires counsel: DPA liability provisions are typically tied to, or carve out from, the main Terms of Service's limitation of liability (VEX-OS-LGL-001 §11). Needs to be finalized alongside that section.]_

## 9. Term and Termination

This DPA remains in effect for as long as Valtara processes Personal Data on Customer's behalf under the Terms of Service, and survives termination to the extent Valtara continues to hold Personal Data during the post-termination retention/deletion window described in Section 3.7.

## 10. Contact

Data protection inquiries under this DPA: Francis Ogbogu, Chief AI Officer and Privacy Officer — fcogbogu@gmail.com.

---

_VEX-OS-LGL-003 · Version 1.0 (Draft) · August 2026 · Not yet approved for publication_
