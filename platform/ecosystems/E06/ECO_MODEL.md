# E06 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E06 — Analytics Engine
| Field | Value |
|---|---|
| **Name** | Analytics Engine |
| **Band** | 00-Foundation |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_06_analytics_engine_complete.py` |
| **Purpose** | Centralized metrics warehouse. 403+ KPIs across all ecosystems: fundraising velocity, email open rates, volunteer retention, event attendance, ad ROI. Real-time attribution chains connecting communications to downstream actions. Powers E27/E28/E29 dashboards. Feeds E21 ML clustering with training data. |
| **Feeds into** | E21 (ML training data), E22 (A/B test outcomes), E27 (real-time dashboard), E28 (financial dashboard), E29 (analytics dashboard), E51 (Nexus — briefings) |
| **Fed by** | All ecosystems emit events consumed here |
| **Open-source stack** | PostgreSQL time-series, pandas, matplotlib |
| **Surpasses** | Google Analytics, Mixpanel, Tableau, Looker, HubSpot Analytics, Civis Analytics, Hawkfish |
| **Brain triggers** | `analytics.goal_achieved`, `analytics.anomaly_detected`, `analytics.report_generated`, `analytics.kpi_threshold_breached`, `analytics.attribution_chain_complete`, `analytics.daily_digest_ready` |

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
- ECO_CANONICAL/E06/._ecosystem_06_analytics_engine_complete.py
- ECO_CANONICAL/E06/ecosystem_06_analytics_engine.py  ⚠ needs_review
- ECO_CANONICAL/E06/ecosystem_06_analytics_engine_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** SUPPORT/SERVICE CENTER (ALLOCATED) — cost allocated to the fires it informs.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
