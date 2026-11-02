# E59 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
e59 live: 198,353 assignments; hierarchy/wizard_launch_context EMPTY

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E59 — Microsegment Intelligence
| Field | Value |
|---|---|
| **Name** | Microsegment Intelligence |
| **Band** | 01-Donor-Intelligence |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_59_microsegment_intelligence.py` |
| **Purpose** | Hidden small-group donor patterns — donors who behave alike but don't fit obvious demographic buckets. Powers the 80-segment named canon and 12-dimension microsegment taxonomy. Feeds E01 segment assignments. |
| **Feeds into** | E01 (donor intelligence — segment label), E21 (ML clustering — segment training labels), E41 (campaign builder — segment targeting) |
| **Fed by** | E01 (donor grade), E21 (ML clustering), E42 (news heat — segment heat modulation) |
| **Open-source stack** | scikit-learn, HDBSCAN (density clustering), pgvector |
| **Surpasses** | Salesforce Einstein segments, Adobe Audience Manager |
| **Notes** | Governing skill: `microsegment-selection`. |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 29
- ECO_CANONICAL/E59/._ecosystem_59_microsegment_intelligence.py
- ECO_CANONICAL/E59/001_agent_mesh_schema.sql
- ECO_CANONICAL/E59/2026-07-14_E59_DISTRICT_RANKING_PHASE2_LIVE.sql
- ECO_CANONICAL/E59/305_e59_microsegment_intensity_log.sql
- ECO_CANONICAL/E59/306_e59_page_config.sql
- ECO_CANONICAL/E59/308_e59_microsegment_hierarchy.sql
- ECO_CANONICAL/E59/309_e59_taxonomy_extension_queue.sql
- ECO_CANONICAL/E59/310_e59_wizard_launch_context.sql
- ECO_CANONICAL/E59/311_e59_donor_segment_assignment.sql
- ECO_CANONICAL/E59/312_e59_district_ranking.sql
- ECO_CANONICAL/E59/312_e59_sic_waterfall_segments.sql
- ECO_CANONICAL/E59/__init__.py
- ECO_CANONICAL/E59/_decode_transfer.py
- ECO_CANONICAL/E59/base_agent.py
- ECO_CANONICAL/E59/brain_integration.py
- ECO_CANONICAL/E59/control_api.py
- ECO_CANONICAL/E59/control_panel.html
- ECO_CANONICAL/E59/cost_tracker.py
- ECO_CANONICAL/E59/DRYRUN_E59_BIND_AND_BURST_2026-07-14.sql
- ECO_CANONICAL/E59/DRYRUN_E59_DISTRICT_RANKING_PHASE1_2026-07-14.sql
- ECO_CANONICAL/E59/DRYRUN_E59_ISSUE_PROFILE_SEED_2026-07-14.sql
- ECO_CANONICAL/E59/E59_MICROSEGMENT_ENGINE_INSTALL_2026-07-08.sql
- ECO_CANONICAL/E59/E59_WIZARD_PRELAUNCH_VALIDATION_2026-06-30.sql
- ECO_CANONICAL/E59/ecosystem_59_microsegment_intelligence.py  ⚠ needs_review
- ECO_CANONICAL/E59/index.html
- ECO_CANONICAL/E59/mockSearchDonors.js
- ECO_CANONICAL/E59/notifier.py
- ECO_CANONICAL/E59/rule_engine.py
- ECO_CANONICAL/E59/supervisor.py

## GAPS — fill-in-the-blank
- [ ] pipeline/service: e59 live: 198,353 assignments; hierarchy/wizard_launch_context EMPTY

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
