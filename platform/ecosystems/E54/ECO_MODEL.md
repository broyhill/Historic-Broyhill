# E54 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E54 — Calendar & Scheduling
| Field | Value |
|---|---|
| **Name** | Calendar & Scheduling |
| **Band** | 03-RevOps |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_54_calendar_scheduling_complete.py` |
| **Purpose** | Campaign calendars, event scheduling, filing deadlines, debate dates, media availability, staff coordination. Timezone management, conflict detection, availability polling, automated reminders. Integrates with E12 (campaign milestone tracking) and E34/E37 (event scheduling). |
| **Feeds into** | E12 (campaign operations — milestone calendar), E20 (Brain — deadline alerts), E34/E37 (events — scheduling) |
| **Fed by** | E03 (candidate profile — filing deadlines), E12 (campaign operations — task deadlines) |
| **Open-source stack** | Cal.com (open source), Google Calendar API, iCal |
| **Surpasses** | Calendly, Google Calendar API, Microsoft 365 Calendar, Doodle, Acuity Scheduling, Clockwise |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 3
- ECO_CANONICAL/E54/._ecosystem_54_calendar_scheduling_complete.py
- ECO_CANONICAL/E54/ecosystem_54_calendar_scheduling.py  ⚠ needs_review
- ECO_CANONICAL/E54/ecosystem_54_calendar_scheduling_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** COST CENTER — judged on cost against a service standard, never revenue.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
