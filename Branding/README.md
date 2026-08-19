# vexOS Brand System

Source: shared ChatGPT conversation, https://chatgpt.com/s/t_6a85b7e5ab9081918fb605db728f9043 (fetched and digested 2026-08-19). This is a full brand-identity system built around the logo the CAO provided (dark "Midnight" background, orbital "V" mark, blue → cyan → violet gradient).

This folder holds the system broken out by section, matching the source document's own structure.

**Naming — resolved (DL-PROD-003)**: this system refers to the product as **vexOS** / **VEX** throughout (lowercase v, capital OS). That's now the adopted customer-facing brand name. The codebase's internal identifiers (**VEX-OS**, hyphenated — npm packages, doc IDs, repo name) and the legal entity/product name (**Valtara Executive OS**, used only in `docs/06-legal/*`) are unchanged — three names for three audiences, not a rename. See `20-complete-brand-architecture.md` for the full reasoning.

## Contents

- [00-positioning-and-promise.md](00-positioning-and-promise.md) — core positioning, brand promise
- [01-brand-foundation.md](01-brand-foundation.md) — category, personality, archetype, audience
- [02-core-visual-system.md](02-core-visual-system.md) — **color palette (hex values) + typography** — the two files most directly needed for `apps/web`'s `globals.css`/`tailwind.config.ts`
- [03-logo-architecture.md](03-logo-architecture.md) — logo family, clear space, do-nots
- [04-website-theme.md](04-website-theme.md) — marketing site hero/homepage structure
- [05-product-ui-design-system.md](05-product-ui-design-system.md) — "VEXION" design system: radii, borders, primary nav
- [06-executive-command-center.md](06-executive-command-center.md) — signature dashboard screen concept
- [07-ai-assistant-surfaces.md](07-ai-assistant-surfaces.md) — "VEX" AI identity, modes, status language
- [08-mobile-pwa.md](08-mobile-pwa.md)
- [09-data-visualization.md](09-data-visualization.md) — chart color semantics, "Executive Orbit" motif
- [10-social-media-system.md](10-social-media-system.md)
- [11-presentation-system.md](11-presentation-system.md)
- [12-sales-collateral.md](12-sales-collateral.md)
- [13-onboarding.md](13-onboarding.md)
- [14-email-system.md](14-email-system.md)
- [15-documentation.md](15-documentation.md)
- [16-launch-identity.md](16-launch-identity.md)
- [17-iconography.md](17-iconography.md)
- [18-motion-language.md](18-motion-language.md)
- [19-brand-voice.md](19-brand-voice.md) — tone rules with before/after copy examples
- [20-complete-brand-architecture.md](20-complete-brand-architecture.md) — master brand + sub-product naming system
- [21-north-star-visual.md](21-north-star-visual.md) — closing single-paragraph synthesis

## What's immediately actionable for the current build

The approved landing-page/theme-refresh plan (`/Users/mac/.claude/plans/modular-wobbling-kite.md`) needs, at minimum:

- **Section 2** (`02-core-visual-system.md`) — the hex palette and typeface stack, to replace the plan's placeholder `--accent`/`--surface` proposal and Inter-only font default.
- **Section 3** (`03-logo-architecture.md`) — clear-space rule and do-nots, to inform how the provided logo file gets used in `apps/web/components/brand/logo.tsx`.
- **Section 19** (`19-brand-voice.md`) — directly informs landing-page and dashboard copywriting tone.

Everything else (Command Center redesign, AI assistant "VEX" persona, mobile/PWA, sales collateral, presentation decks, etc.) is a much larger scope than the currently-approved plan and is captured here for reference, not because it's all in scope now.

## Logo asset

Saved at `apps/web/public/vexos-logo.png` (1536×1024 PNG, the "Primary Horizontal Lockup" per `03-logo-architecture.md`). This is the only logo family member that exists today — reversed/monochrome variants, the standalone V mark, favicon, app icon, and motion logo (all listed in `03-logo-architecture.md`) still need to be derived from it. In particular, this file is a wide lockup with a lot of negative space around the mark - not suitable to use directly as a favicon at 16–32px; it needs a cropped/simplified version before that works legibly.
