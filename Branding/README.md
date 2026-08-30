# Nyxor Brand System

Source: shared ChatGPT conversation, https://chatgpt.com/s/t_6a85b7e5ab9081918fb605db728f9043 (fetched and digested 2026-08-19). This is a full brand-identity system built around the logo the CAO provided (dark "Midnight" background, orbital "V" mark, blue → cyan → violet gradient).

This folder holds the system broken out by section, matching the source document's own structure.

**Naming — resolved (DL-PROD-005, supersedes DL-PROD-003)**: this system refers to the product as **Nyxor** everywhere — logo, marketing copy, internal identifiers (npm packages, doc IDs), and the legal entity/product name in `docs/06-legal/*`. DL-PROD-003's original "three names for three audiences" (vexOS / VEX-OS / Valtara Executive OS) is retired: it was a workable compromise for a cosmetic naming mismatch, not for an actual trademark conflict (Vexos Corporation holds a registered US mark on "VEXOS"). One name, no split. See `20-complete-brand-architecture.md` for the full reasoning, and `docs/04-build-governance/VEX-OS-DL-001-Decision-Log.md`'s DL-PROD-005 entry for the conflict details. Note: the bare "VEX" AI-persona name, "VEXION" design-system name, and "Vex Glyph" icon family below are still unadopted reference material (see line 42) and still carry the retired root — they weren't touched by this rename and need their own naming pass before ever being adopted.

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

DL-PROD-005: replaced the original vexOS-branded lockup with a real Nyxor
lockup (orbital "N," not "V" - the mark's letter changed with the rebrand,
not just its color/wordmark). Two source renders live here:
`nyxor-logo-source-light-bg.png` (1672×941, dark-navy wordmark, designed
for light surfaces) and `nyxor-logo-source-dark-bg.png` (2172×724, blue
wordmark, designed for dark surfaces) - a deliberate light/dark pair, not
one image recolored.

Derived, production assets (chroma-keyed to transparency, cropped tight)
live in `apps/web/public/`: `nyxor-logo-light.png` and `nyxor-logo-dark.png`
(the two "full" lockups, theme-swapped via `components/brand/logo.tsx`),
plus `nyxor-mark.png` (the standalone orbital N, cropped from the dark-bg
source - its gradient is consistent between both sources so one crop
serves both themes) also used for `apps/web/app/icon.png`'s favicon.
Verified directly at real display size (16-32px) before shipping - unlike
this section's prior claim about the old lockup, this isn't an assumption.

One non-obvious pitfall worth recording: Next.js's `next/image` optimizer
re-encoded these as 8-bit indexed/palette PNGs by default, which visibly
dithers/bands a smooth gradient at small sizes - looked identical to a
"detail doesn't survive downscaling" problem but was actually a re-encoding
bug. Fixed with the `unoptimized` prop in `logo.tsx`, not by simplifying
the art. Reversed/monochrome variants, app icon (PWA), and a motion logo
are still unbuilt.
