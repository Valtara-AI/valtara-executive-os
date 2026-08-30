**VALTARA AI**

**Nyxor**

**SECURITY ARCHITECTURE DOCUMENT**

NYXOR-SEC-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-SEC-001                                            |
| -------------- | -------------------------------------------------------- |
| Version        | 1.0                                                      |
| Status         | Draft — Internal Review                                  |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI            |
| Audience       | Engineering, DevOps, Security Review, Enterprise Clients |
| Date           | August 2026                                              |
| Depends On     | NYXOR-SAD-001, NYXOR-SRS-001, NYXOR-DMP-001              |
| Classification | Confidential — Restricted Distribution                   |

# 1. Purpose & Scope

This Security Architecture Document defines the security design, controls, threat model, and operational security requirements for Nyxor. It governs all security decisions across the system: authentication, authorization, data protection, secret management, network security, audit logging, vulnerability management, and incident response.

NYXOR processes executive-grade sensitive data. Security is an architectural constraint, not a feature layer. Every security control defined here must be implemented from Sprint 1; no security control may be deferred to a later release without explicit decision log entry and risk acceptance by the Chief AI Officer.

# 2. Threat Model

**2.1 Assets Under Protection**

| Asset                                                               | Classification   |
| ------------------------------------------------------------------- | ---------------- |
| OAuth integration tokens (Gmail, Outlook, Calendar, Slack)          | Highly Sensitive |
| Executive Intelligence Profile and Voice Profile                    | Highly Sensitive |
| Agent task outputs and HITL decisions                               | Highly Sensitive |
| Executive email and calendar content (in-transit for agent context) | Highly Sensitive |
| Audit log                                                           | Sensitive        |
| Agent configurations and Executive Intelligence Profile             | Sensitive        |
| LLM provider API keys                                               | Highly Sensitive |

**2.2 Threat Actors**

| Threat Actor                     | Motivation                                                             |
| -------------------------------- | ---------------------------------------------------------------------- |
| External attacker                | Data theft; credential theft; service disruption                       |
| Compromised third party          | Lateral movement from LLM provider or hosting provider                 |
| Malicious insider (hypothetical) | Data theft or sabotage                                                 |
| Automated scanner / bot          | Credential stuffing; API abuse; cost inflation via excessive LLM calls |

**2.3 Threat Scenarios & Mitigations**

| Threat Scenario                                | Likelihood  | Primary Mitigation                                                                                                         |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| OAuth token theft via storage compromise       | Medium      | Field-level AES-256-GCM encryption; tokens never in logs; decrypted only at point of use                                   |
| API key leakage via committed .env file        | Medium-High | Pre-commit hook blocks .env commit; CI/CD secret scanning; .gitignore enforced from init                                   |
| Prompt injection via malicious email content   | Medium      | Email content sanitized before injection into prompt context; output sanitization before rendering                         |
| JWT token forgery or theft                     | Low         | Short-lived access tokens (1hr); httpOnly cookie storage; RS256 signing; server-side revocation list                       |
| Database breach exposing executive data        | Low         | AES-256 at rest; field-level encryption for highly sensitive data; row-level security on audit tables                      |
| Unauthorized HITL bypass by agent              | Low         | HITL enforced at application layer; database constraint requires approved HITL record before external action; tested in QA |
| LLM provider outage causing service disruption | Medium      | Secondary provider configured; failover automatic; operational status monitoring                                           |
| Dependency vulnerability exploitation          | Medium      | Automated dependency scanning on every build; critical/high CVEs block deployment                                          |

# 3. Authentication & Authorization

**3.1 Authentication Design**

| Control             | Specification                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Primary auth method | OAuth 2.0 SSO via Google Workspace or Microsoft 365; no username/password authentication                                  |
| MFA enforcement     | Enforced at Identity Provider (Google/Microsoft) level; NYXOR does not bypass or override MFA                             |
| JWT structure       | Access token: RS256 signed; 1-hour TTL; payload: {sub, email, role, iat, exp}; stored in httpOnly, SameSite=Strict cookie |
| Refresh token       | RS256 signed; 30-day TTL; stored in httpOnly cookie; server-side revocation table checked on use                          |
| Session termination | Explicit logout: invalidates JWT; revokes refresh token; clears cookies; audit log entry                                  |
| Idle timeout        | Configurable per deployment (default: 8 hours); enforced server-side; client warned at 7h50m                              |

**3.2 Authorization Design — RBAC**

| Role          | Permissions                                                                                                                                          | Access Scope                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Executive     | Full access to own data; create/configure/deactivate agents; approve/reject HITL items; connect/disconnect integrations; export data; delete account | Own profile, agents, tasks, briefs, HITL queue, integrations only                  |
| Delegate      | Read HITL queue; approve/reject/edit HITL items; view task status; view morning brief; no agent configuration; no integration management             | Same executive's data only; read-heavy; no destructive actions                     |
| Administrator | System configuration; SSO setup; audit log export; user role management; no access to executive content                                              | System configuration schema only; explicit prohibition on executive content access |

RBAC is enforced server-side on every API request. Client-side role checks are for UX only and are not trusted as a security boundary.

# 4. Data Protection

**4.1 Encryption at Rest**

| Data                                      | Encryption Method                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Database (all tables)                     | AES-256 managed encryption via Supabase (PostgreSQL); enabled at database level             |
| OAuth tokens (access + refresh)           | AES-256-GCM field-level encryption; key: DB_ENCRYPTION_KEY env var; nonce unique per record |
| Voice Profile sensitive fields            | AES-256-GCM field-level encryption; same key as OAuth tokens                                |
| File storage (agent outputs, attachments) | Supabase Storage managed encryption; AES-256                                                |
| Backup data                               | Encrypted before transmission to backup destination; same standards as primary              |

**4.2 Encryption in Transit**

| Connection                                                 | Standard                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Client to application (HTTPS)                              | TLS 1.3 minimum; TLS 1.1/1.2 disabled; HSTS header enforced                |
| Application to database                                    | TLS required; SSL mode=require enforced in connection string               |
| Application to Redis                                       | TLS required; no plaintext Redis connections in production                 |
| Application to LLM providers                               | TLS 1.2+ (enforced by providers); certificates validated                   |
| Application to integration APIs (Google, Microsoft, Slack) | TLS 1.2+ (enforced by providers)                                           |
| Internal service-to-service (if applicable)                | mTLS for any inter-service communication in future microservice extraction |

**4.3 Secret Management**

| Control               | Implementation                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| .env file policy      | All secrets in .env files; .env.example contains structure with no values; .env always in .gitignore                                                                                                                              |
| Pre-commit hook       | Blocks commits containing .env files or strings matching API key patterns; enforced for all contributors                                                                                                                          |
| CI/CD secret scanning | GitHub Actions pipeline runs secret scanning step before build; fails pipeline on detection                                                                                                                                       |
| Key rotation          | DB_ENCRYPTION_KEY rotatable with documented procedure: (1) generate new key, (2) decrypt all encrypted fields with old key, (3) re-encrypt with new key, (4) update .env, (5) deploy, (6) verify; zero downtime rotation possible |
| Secret access logging | All production .env access events logged (at infrastructure level); anomalous access triggers alert                                                                                                                               |

# 5. Application Security

| Control                  | Specification                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation         | All inputs validated server-side using Zod schema; no client-provided data trusted without validation; parameterized queries only (Drizzle ORM enforces)         |
| Output sanitization      | All LLM outputs HTML-escaped before rendering in UI; no raw LLM output injected into DOM; Content Security Policy headers enforced                               |
| Prompt injection defense | Email/calendar content inserted into prompt context as quoted data blocks, not as instructions; system prompt integrity checked before inference                 |
| CORS policy              | Strict origin whitelist; no wildcard origins; preflight requests validated                                                                                       |
| Rate limiting            | Per-user rate limits on all API endpoints; LLM inference endpoints have stricter limits; 429 responses include Retry-After header                                |
| Security headers         | HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy set on all responses                                                          |
| Dependency management    | Automated vulnerability scanning (npm audit + Snyk or equivalent) on every build; critical/high CVEs block deployment; dependency updates reviewed weekly        |
| Error handling           | No stack traces in production API responses; errors logged internally with full context; user-facing errors are generic with a reference code for support lookup |

# 6. Audit Logging

| Requirement  | Specification                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope        | All authentication events, HITL decisions, integration access, agent task starts and completions, data exports, administrative actions, and policy violations |
| Immutability | Audit log table: row-level security disables UPDATE and DELETE for all roles including Administrator; appends only                                            |
| Integrity    | Each record includes SHA-256 hash of previous record; chain integrity verified by nightly job; break in chain triggers alert                                  |
| Retention    | 24 months active; archived to cold storage after 24 months; deletion requires compliance officer action and is itself audit-logged                            |
| Access       | Executive can view own audit log; Administrator can export full log; no other role has audit log access                                                       |
| PII policy   | Audit log contains actor ID and entity ID (UUIDs) but not PII directly; lookup requires join with user table — join restricted to authorized queries          |

# 7. Incident Response

| Phase                | Action                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detection            | Monitoring alerts (NYXOR-MOP-001) detect anomalies; security events trigger immediate Slack/email alert to engineering lead and CAO                                       |
| Containment          | Affected service isolated within 30 minutes of confirmed incident; OAuth tokens revoked if credential compromise suspected; executive notified                            |
| Assessment           | Scope of breach determined within 4 hours; affected data identified; regulatory notification obligation assessed                                                          |
| Notification         | PIPEDA: notification to Privacy Commissioner and affected individuals within 72 hours if material risk; GDPR: 72-hour notification to supervisory authority if applicable |
| Recovery             | Clean deployment from known-good state; secrets rotated; affected integrations re-authorized by executive                                                                 |
| Post-incident review | Root cause analysis within 5 business days; findings documented in incident log; control gaps addressed before service restoration for affected capability                |

# 8. Document Approval

| Role        | Name                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| Author      | Francis Ogbogu — Chief AI Officer                                      |
| Approver    | Francis Ogbogu — Chief AI Officer                                      |
| Date Issued | August 2026                                                            |
| Next Review | Upon material architecture change or security incident; minimum annual |

_NYXOR-SEC-001 · Version 1.0 · August 2026 · Confidential — Restricted Distribution_
