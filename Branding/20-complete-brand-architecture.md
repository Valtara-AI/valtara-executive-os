# 20. Complete Brand Architecture

The portfolio can ultimately operate as:

- **Nyxor** — master brand
- **VEX** — executive AI
- **Command** — executive dashboard
- **Memory** — second brain
- **Pulse** — intelligence/analytics
- **Decisions** — decision system
- **Flow** — automation/delegation
- **Brief** — executive briefings
- **Connect** — integrations
- **VEXION** — design system

That creates a scalable naming system without fragmenting the master brand.

---

**Implementation note**: this is a full sub-brand naming taxonomy — a significant scope decision beyond visual identity, not yet adopted (only the master brand name decision below has been made). The codebase uses **NYXOR** (capital OS, hyphenated) as the internal engineering identifier throughout (`CLAUDE.md`, all `docs/NYXOR-*` governance documents, `packages/*` naming like `@nyxor/database`); this system uses **Nyxor** (lowercase, no hyphen) as the customer-facing brand name.

**Resolved (DL-PROD-003)**: three names for three audiences, no rename anywhere in the codebase —

- **Nyxor** — customer-facing marketing/product brand name (logo, landing page, UI chrome, casual product references). Matches the actual supplied logo's own typography.
- **NYXOR** — internal engineering identifier (npm package scope, git repo, doc IDs, env var conventions). Unchanged.
- **Nyxor** — formal legal entity/product name, used only in `docs/06-legal/*` and any contract. Unchanged.

The sub-brand taxonomy above it (VEX/Command/Memory/Pulse/Decisions/Flow/Brief/Connect/VEXION) is a separate, much larger decision — not adopted, captured here for reference only.
