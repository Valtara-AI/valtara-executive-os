# 2. Core Visual System

## Primary palette

| Token             | Hex       | Primary use                   |
| ----------------- | --------- | ----------------------------- |
| Nyxor Midnight    | `#020A28` | Primary dark background       |
| Executive Navy    | `#061643` | Cards, navigation, dashboards |
| Nyxor Blue        | `#064DFF` | Primary actions               |
| Orbit Blue        | `#008CFF` | Interactive states / data     |
| Intelligence Cyan | `#00DDF2` | AI / system signals           |
| Violet Pulse      | `#6A16FF` | AI accents / gradients        |
| Cloud White       | `#F7FAFF` | Light surfaces                |
| Slate             | `#66718C` | Secondary copy                |
| Signal Green      | `#20D997` | Success                       |
| Attention Amber   | `#FFB547` | Warning                       |
| Critical Red      | `#FF5263` | Critical states               |

## Signature gradient

`#00DDF2 → #008CFF → #064DFF → #6A16FF`

This is the **Nyxor Intelligence Gradient**. Use it selectively — on the logo, AI states, important metrics, launch graphics, and premium interactions — **not on every UI element**.

## Typography

- **Primary**: Manrope
- **Interface**: Inter
- **Technical/data**: IBM Plex Mono

### Recommended hierarchy

| Role               | Weight            |
| ------------------ | ----------------- |
| Display            | Manrope 700       |
| H1                 | Manrope 700       |
| H2                 | Manrope 650       |
| Body               | Inter 400–500     |
| UI                 | Inter 500–600     |
| Metrics            | Manrope 600–700   |
| System/data labels | IBM Plex Mono 500 |

---

**Implementation note for `apps/web`**: the app currently has only 7 raw HSL-triplet tokens (`--background`/`--foreground`/`--border`/`--primary`/`--primary-foreground`/`--muted`/`--muted-foreground`) and no font configured. This palette and type system directly replaces the placeholder `--accent`/`--surface` amber proposal from the approved landing-page plan. Convert each hex above to an HSL triplet to match the existing raw-HSL-triplet convention in `globals.css` before wiring into `tailwind.config.ts`. Manrope + Inter both need `next/font/google` entries (IBM Plex Mono only where technical/data labels appear — likely not needed for v1 marketing page).
