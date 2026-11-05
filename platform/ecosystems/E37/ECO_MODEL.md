# E37 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E37 — Event Management (Logistics)
| Field | Value |
|---|---|
| **Name** | Event Management — Logistics |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_37_event_management_complete.py` |
| **Purpose** | Behind-the-scenes event production: venue selection, vendor coordination, budget tracking, floor plans, catering, AV, day-of runsheets. Operationally distinct from E34 (attendee-facing). Coordinates volunteer staffing via E38. |
| **Feeds into** | E34 (events — logistics status), E05 (volunteer management — event staffing needs) |
| **Fed by** | E03 (candidate profile — event preferences), E11 (budget — event allocation), E34 (events — event record) |
| **Open-source stack** | PostgreSQL, calendar integration |
| **Surpasses** | Cvent (logistics), Social Tables, AllSeated, Tripleseat, Planning Pod, Eventmobi |

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
- ECO_CANONICAL/E37/._ecosystem_37_event_management_complete.py
- ECO_CANONICAL/E37/ecosystem_37_event_management.py  ⚠ needs_review
- ECO_CANONICAL/E37/ecosystem_37_event_management_complete.py  ⚠ needs_review

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
