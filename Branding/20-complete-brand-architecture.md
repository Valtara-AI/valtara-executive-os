# 20. Complete Brand Architecture

The portfolio can ultimately operate as:

- **vexOS** — master brand
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

**Implementation note**: this is a full sub-brand naming taxonomy — a significant scope decision beyond visual identity, not yet adopted (only the master brand name decision below has been made). The codebase uses **VEX-OS** (capital OS, hyphenated) as the internal engineering identifier throughout (`CLAUDE.md`, all `docs/VEX-OS-*` governance documents, `packages/*` naming like `@vex-os/database`); this system uses **vexOS** (lowercase, no hyphen) as the customer-facing brand name.

**Resolved (DL-PROD-003)**: three names for three audiences, no rename anywhere in the codebase —

- **vexOS** — customer-facing marketing/product brand name (logo, landing page, UI chrome, casual product references). Matches the actual supplied logo's own typography.
- **VEX-OS** — internal engineering identifier (npm package scope, git repo, doc IDs, env var conventions). Unchanged.
- **Valtara Executive OS** — formal legal entity/product name, used only in `docs/06-legal/*` and any contract. Unchanged.

The sub-brand taxonomy above it (VEX/Command/Memory/Pulse/Decisions/Flow/Brief/Connect/VEXION) is a separate, much larger decision — not adopted, captured here for reference only.
