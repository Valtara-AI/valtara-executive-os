# 8. Mobile / PWA

Mobile should prioritize **executive triage**, not replicate the desktop dashboard.

## Bottom navigation

Today · Ask · Decisions · Inbox · More

The center **Ask** action uses the glowing V mark.

## Home screen

The home screen becomes a vertical executive briefing:

```
08:00 Executive Brief
3 priorities
2 decisions
4 meetings
1 emerging risk
```

Then: **VEX recommends** with one or two actionable recommendations.

## Voice

Support voice as a first-class interaction: _"VEX, brief me before the board meeting."_

---

**Implementation note**: VEX-OS has no mobile/PWA surface today (`apps/web`'s `next.config.mjs` has `output: "standalone"` for server deployment, no PWA manifest/service worker). This section describes a future mobile product, not something in scope for the current landing-page/theme-refresh plan.
