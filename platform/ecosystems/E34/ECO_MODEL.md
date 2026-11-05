# E34 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E34 — Events (Attendee-Facing)
| Field | Value |
|---|---|
| **Name** | Events — Attendee Experience |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_34_events_complete.py` |
| **Purpose** | Political fundraisers, town halls, rallies, meet-and-greets. Event creation, ticket sales, RSVP tracking, check-in processing, post-event follow-up automation. Integrates E37 (logistics), E05 (volunteer staffing), E20 (automated follow-up). |
| **Feeds into** | E01 (donor grade — event attendance signal), E06 (analytics — event metrics), E20 (Brain — attendee follow-up triggers), E37 (event management — logistics handoff) |
| **Fed by** | E05 (volunteer management — event staffing), E15 (contact — RSVP contact check), E20 (Brain — post-event follow-up GO decisions), E37 (logistics — venue/vendor status) |
| **Open-source stack** | PostgreSQL, QR code generation (qrcode library), Stripe (ticket payments) |
| **Surpasses** | Eventbrite, Splash, Cvent, Mobilize, Bizzabo, Hopin, Luma, Partiful |
| **Brain triggers** | `event.created`, `event.rsvp_received`, `event.ticket_sold`, `event.check_in`, `event.no_show`, `event.capacity_reached`, `event.post_event_followup`, `event.cancelled` |
| **Notes** | Governing skill: `event-fundraiser-pipeline` — 9-phase pipeline from $500 home reception to $200K principal-gift event. The Hall-Moore April 9, 2026 event is the calibration anchor. |

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
- ECO_CANONICAL/E34/._ecosystem_34_events_complete.py
- ECO_CANONICAL/E34/ecosystem_34_events.py  ⚠ needs_review
- ECO_CANONICAL/E34/ecosystem_34_events_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** REVENUE CENTER — judged on dollars raised at the point of fire.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
