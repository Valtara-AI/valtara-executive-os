# 13. Onboarding

Turn onboarding into: **Initialize your Nyxor**

## Progress language

- **01 — Identity** — Your role and organization
- **02 — Priorities** — What matters most
- **03 — Intelligence** — Connect knowledge sources
- **04 — Operating Rhythm** — Meetings and routines
- **05 — Delegation** — Team and responsibilities
- **06 — VEX** — Configure your executive assistant

**Completion**: Your Executive OS is ready.

---

**Implementation note**: NYXOR's real onboarding flow (`apps/web/app/onboarding/page.tsx` + `apps/api/src/domains/onboarding/`) is a conversational interview (≥12 questions) producing an Executive Intelligence Profile, Voice Profile, and proposed agent workforce for review/confirm — a different shape than this 6-step wizard framing. The step _language_ ("Identity," "Priorities," "Delegation") could relabel sections of the existing flow without restructuring it.
