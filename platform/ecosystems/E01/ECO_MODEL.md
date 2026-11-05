# E01 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
donor_intelligence live 19 tables; SIC loaded, race-relational tables EMPTY

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E01 — Donor Intelligence
| Field | Value |
|---|---|
| **Name** | Donor Intelligence |
| **Band** | 01-Donor-Intelligence (also Brain Pentad member) |
| **Status** | ✅ Live + 🔧 Active enhancement (Phase A DDL complete May 18) |
| **Canonical file** | `backend/python/ecosystems/ecosystem_01_donor_intelligence_complete.py` |
| **Purpose** | Three-dimensional donor grading engine. Produces A++ through D- (13 tiers + U) letter grades across three scopes (state/district/county), intensity scores (1-10, Cat 13 7-component), level preference (F/S/L/FSL), and composite grade. Powers all downstream targeting. Entry point: `grade_donor(rnc_regid)`. Also the canonical home of the two-tower donor embedding (256-dim) under v1.1 architecture. |
| **Feeds into** | E19 (Social Media — Brain Pentad payload `GradedDonor`), E20 (Brain — routing decisions), E21 (ML Clustering — training labels), E23 (Microsegment Intelligence), E24 (Candidate Portal — donor lists), E25 (Donor Portal — giving history display), E30 (Email — grade-gated sends), E31 (SMS — grade-gated sends), E33 (Approval Queue), E41 (Campaign Builder — segment selection), E51 (Nexus — top prospect cultivation) |
| **Fed by** | E00 (person spine), E04 (activist intensity scores), E06 (RFM analytics), E21 (ML cluster assignments), E42 (news exposure signals), E48 (ideological vector), E59 (microsegment assignments), E62 (FEC donation history) |
| **Open-source stack** | PostgreSQL, pgvector (ANN index for embeddings), scikit-learn (percentile ranking), numpy |
| **Surpasses** | DonorPerfect, Bloomerang, WealthEngine, DonorSearch, Blackbaud Raiser's Edge, iWave, DonorAtlas |
| **Brain triggers** | `donor.grade_changed`, `donor.score_recalculated`, `donor.upgrade_opportunity`, `donor.lapsed_detected`, `donor.maxout_approaching`, `donor.vip_threshold_crossed`, `donor.first_gift`, `donor.recurring_started` |
| **Canonical docs** | `docs/E01_Donor_Intelligence_Canonical_Reference.md` (May 19, 2026 — authoritative), `docs/plans/E01_DONOR_PIPELINE_COMPREHENSIVE_PLAN.md` (1,237 lines), `database/schemas/CALCULATE_TRIPLE_GRADES.sql` (Dec 2024 — source of truth for grading) |
| **Notes** | Phase A DDL verified live May 18 22:09 UTC (PR #12): 21 columns + 7 indexes on `core.donor_profile`. Triple Grading live. State grade 100% populated, district/county 82.1%. Canary: cluster 372171 = A++ / A+ / A++. Governing skill: `donor-centric-architecture` v1.1 — donor is primary entity, not (donor, candidate) pair. **Competitor dump shelf 2026-09-04:** DonorAtlas paid-landing architecture scrape parked at `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf` (sha256 `31041950f804930f1fdc7dc20bc3e767ed3d8a0540d6c8d1d54b8cfcd9f91c60`). Collisions: `ECO_CANONICAL/E01/docs/DONORATLAS_COLLISIONS_SORT_LATER_2026-09-04.md`. **NC First adaptation (same sitting):** `ECO_CANONICAL/E01/docs/NC_FIRST_DONORATLAS_ADAPTATION_2026-09-04.md` — taxonomies/directories/Python/Inspinia explorer + dryrun views. Person key remains `cluster_id` INTEGER. Not a new eco. Not E25. Not E102. Do not implement their `donor_id` schema. |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 23
- ECO_CANONICAL/E01/._ecosystem_01_donor_intelligence_complete.py
- ECO_CANONICAL/E01/._ecosystem_01_dual_grading_update.py
- ECO_CANONICAL/E01/__init__.py
- ECO_CANONICAL/E01/contact_file_ingest.py
- ECO_CANONICAL/E01/data_import_master.py
- ECO_CANONICAL/E01/E01_CHRONOLOGICAL_PROGRESSION.html
- ECO_CANONICAL/E01/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA 2.sql
- ECO_CANONICAL/E01/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA.sql
- ECO_CANONICAL/E01/E01_Donor_Intelligence_Canonical_Reference.html
- ECO_CANONICAL/E01/E01_zip4_dedup_merge_20pairs_2026-06-28.sql
- ECO_CANONICAL/E01/ecosystem_01_contact_import.py
- ECO_CANONICAL/E01/ecosystem_01_data_import_engine.py
- ECO_CANONICAL/E01/ecosystem_01_donor_intelligence.py  ⚠ needs_review
- ECO_CANONICAL/E01/ecosystem_01_donor_intelligence_complete.py  ⚠ needs_review
- ECO_CANONICAL/E01/ecosystem_01_donor_intelligence_enhanced.py
- ECO_CANONICAL/E01/ecosystem_01_dual_grading_update.py  ⚠ needs_review
- ECO_CANONICAL/E01/ecosystem_01_platform_social_import.py
- ECO_CANONICAL/E01/ecosystem_01_social_oauth_maximum_capture.py
- ECO_CANONICAL/E01/social_graph_builder.py
- ECO_CANONICAL/E01/social_oauth_capture.py
- ECO_CANONICAL/E01/test_e01_determinism.py
- ECO_CANONICAL/E01/test_e01_grade_distribution.py  ⚠ needs_review
- ECO_CANONICAL/E01/test_e01_match_tier_passthrough.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] pipeline/service: donor_intelligence live 19 tables; SIC loaded, race-relational tables EMPTY

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
