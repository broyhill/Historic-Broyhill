# E27 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E27 — Real-Time Dashboard
| Field | Value |
|---|---|
| **Name** | Real-Time Dashboard (War Room) |
| **Band** | 03-RevOps |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_27_realtime_dashboard_complete.py` |
| **Purpose** | Live war room display. Real-time metrics: donation velocity, email performance, social engagement, volunteer check-ins, news alerts. Auto-refreshing widgets, configurable layouts, alert banners. |
| **Feeds into** | Ed + campaign staff (display only) |
| **Fed by** | E06 (analytics — live metrics), E20 (Brain — alert events), E42 (news — breaking alerts) |
| **Open-source stack** | WebSockets, Chart.js, PostgreSQL LISTEN/NOTIFY |
| **Surpasses** | Datadog (monitoring), Grafana, Geckoboard, Klipfolio, Domo, Power BI |

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
- ECO_CANONICAL/E27/._ecosystem_27_realtime_dashboard_complete.py
- ECO_CANONICAL/E27/ecosystem_27_realtime_dashboard.py  ⚠ needs_review
- ECO_CANONICAL/E27/ecosystem_27_realtime_dashboard_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** unclassified lane — COST CENTER by default until Ed rules.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
