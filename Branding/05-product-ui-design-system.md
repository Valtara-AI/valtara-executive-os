# 5. Product UI Design System

Name the design system: **VEXION**

## UI philosophy

Dense intelligence, low cognitive load. Rather than filling the screen with widgets, vexOS should progressively reveal information based on executive relevance.

## Core primitives

| Element | Radius        |
| ------- | ------------- |
| Cards   | 12–16px       |
| Buttons | 10–12px       |
| Inputs  | 10px          |
| Panels  | 16–20px       |
| Pills   | fully rounded |

Use subtle borders such as `rgba(100,150,255,0.15)` rather than heavy shadows.

## Primary navigation

- Command
- Today
- Priorities
- Decisions
- Meetings
- People
- Knowledge
- Intelligence
- Automations
- Analytics

The AI assistant remains globally accessible.

---

**Implementation note**: `apps/web/components/ui/{button,card,input}.tsx` currently use Tailwind's default radius scale (`rounded-md`/`rounded-lg`) with no dedicated radius tokens. This gives exact target values to add as `--radius-card`, `--radius-button`, `--radius-input`, `--radius-panel` tokens if adopted. The primary navigation list here (Command/Today/Priorities/Decisions/Meetings/People/Knowledge/Intelligence/Automations/Analytics) is a materially different information architecture than the current dashboard's sections (Morning brief/HITL queue/History/Agents/Agent task activity/Integrations) — treat as aspirational naming to grow into, not a rename to do immediately.
