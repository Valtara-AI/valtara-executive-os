# 6. Executive Command Center

This should become Nyxor's signature screen.

## Example hierarchy

**Good morning, Alex.**
Executive Pulse — Wednesday, August 19

Then:

| Area           | Information                   |
| -------------- | ----------------------------- |
| Priority Index | What deserves attention       |
| Decisions      | Decisions waiting on CEO      |
| Commitments    | Promises requiring action     |
| Meetings       | Today's critical interactions |
| Signals        | Risks/opportunities detected  |
| Delegation     | Work assigned to others       |
| AI Brief       | Executive summary             |

At the top: **EXECUTIVE PULSE — 84**

Rather than simply reporting activity, Nyxor should continuously answer: **What needs my attention now?**

---

**Implementation note**: this maps closely to the existing dashboard's "Good morning, {name}." header and stat-tile row (HITL queue / Active tasks / Pending decisions / Integrations counts) — the "Executive Pulse" score concept (a single 0–100 composite number) is new and not built. The "Commitments" and "Signals" areas don't have a backing data model yet either. Treat this section as a north star for where the dashboard could grow, not a spec for the current Phase C visual-only refresh.
