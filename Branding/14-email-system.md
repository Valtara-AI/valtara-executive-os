# 14. Email System

Three families:

- **Executive Brief** — daily/weekly intelligence
- **System Signals** — alerts and recommendations
- **Product Communications** — onboarding/releases

## Subject style

> Your Morning Executive Brief — Aug 19

## Header

vexOS logo → **EXECUTIVE BRIEF**

Email should remain extremely scannable: `3 priorities · 2 decisions · 1 risk`, then short sections with direct actions.

---

**Implementation note**: `packages/notifications` (Resend-based) currently sends two email types — a HITL review-request notification and a task-completion notification (autonomous_report mode) — plainer than this "Executive Brief" digest concept. Directly relevant to the Morning Brief feature already built (`apps/api/src/domains/morning-brief/`), which generates brief content but doesn't currently email it — this section is a good spec for that gap if/when it's prioritized.
