# E01 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 117  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 22 | the shelf — stocked, in-lane |
| **MIGRATION** | 11 | SQL under database/ |
| **LANE DOC** | 13 | lane documentation |
| **ORPHAN** | 20 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 14 | canonical & architecture docs |
| **ARCHIVE** | 12 | reference only — never install from here |
| **OTHER** | 25 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E01/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (22)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E01/ECO_MODEL.md` | 5 |  |
| `ECO_CANONICAL/E01/code/__init__.py` | 1 |  |
| `ECO_CANONICAL/E01/code/contact_file_ingest.py` | 66 |  |
| `ECO_CANONICAL/E01/code/data_import_master.py` | 89 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_contact_import.py` | 65 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_data_import_engine.py` | 88 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_donor_intelligence.py` | 60 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_donor_intelligence_complete.py` | 53 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_donor_intelligence_enhanced.py` | 45 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_dual_grading_update.py` | 14 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_platform_social_import.py` | 54 |  |
| `ECO_CANONICAL/E01/code/ecosystem_01_social_oauth_maximum_capture.py` | 77 |  |
| `ECO_CANONICAL/E01/code/social_graph_builder.py` | 56 |  |
| `ECO_CANONICAL/E01/code/social_oauth_capture.py` | 78 |  |
| `ECO_CANONICAL/E01/frontend/E01_CHRONOLOGICAL_PROGRESSION.html` | 38 |  |
| `ECO_CANONICAL/E01/frontend/E01_Donor_Intelligence_Canonical_Reference.html` | 728 |  |
| `ECO_CANONICAL/E01/sql/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA 2.sql` | 22 |  |
| `ECO_CANONICAL/E01/sql/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA.sql` | 22 |  |
| `ECO_CANONICAL/E01/sql/E01_zip4_dedup_merge_20pairs_2026-06-28.sql` | 6 |  |
| `ECO_CANONICAL/E01/tests/test_e01_determinism.py` | 4 |  |
| `ECO_CANONICAL/E01/tests/test_e01_grade_distribution.py` | 6 |  |
| `ECO_CANONICAL/E01/tests/test_e01_match_tier_passthrough.py` | 4 |  |

## MIGRATION (11)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/E01_zip4_dedup_merge_20pairs_2026-06-28.sql` | 6 |  |
| `database/migrations/dryrun/315_ispe_issue_heat.sql` | 5 | `RED` |
| `database/migrations/dryrun/DRYRUN_ACXIOM_SPINE_WELD_2026-07-26.sql` | 6 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_FEC_NEXUS_CANON_LOCK_2026-07-26.sql` | 3 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_IRS527_SPINE_WELD_2026-07-26.sql` | 4 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_PAC_INDIV_SPINE_WELD_2026-07-26.sql` | 4 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_PERSON_DISTRICT_MAP_2026-06-13.sql` | 5 | `GREEN` |
| `database/migrations/dryrun/full_load_2026-07-10/00_regid_repair.sql` | 7 | `GREEN` |
| `database/migrations/dryrun/full_load_2026-07-10/01_syndicated_ddl.sql` | 28 | `AMBER` |
| `database/migrations/dryrun/full_load_2026-07-10/02_datatrust_propagate.sql` | 11 | `AMBER` |
| `database/migrations/dryrun/full_load_2026-07-10/06_wizard_tags_materialize.sql` | 13 | `AMBER` |

## LANE DOC (13)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/DIAMOND_VAULT_LIBRARY/docs/GEMINI_FRONTEND_ECOSYSTEM_AUDIT_E01_E35_E42_E51.md` | 279 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/BGOP_PLATFORM_PLAN_VOLUME_II_DONOR_INTELLIGENCE_2026-06-12.md` | 106 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/DONOR_INTELLIGENCE_LOGIC_OWNERSHIP_2026-06-14.md` | 3 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/DONOR_PSYCHOGRAPHIC_ARCHETYPES_APR2026.md` | 69 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/E01_Donor_Intelligence_Canonical_Reference.md` | 44 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/E01_SPECIFICATION.md` | 4 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/IACC_TIERED_LTV_SPEC_2026-06-19.md` | 2 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/SECTION_1_E01_GRADING_CONSOLIDATION_DESIGN.md` | 9 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.html` | 728 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.pdf` | 417 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_TRIPLE_GRADING_INTEGRATION.docx` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E01_DONOR_INTELLIGENCE.docx` | 28 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/REGISTRY/E01_DOC_REGISTRY.md` | 16 |  |

## ORPHAN (20)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/2026-05-25_DONOR_MICROSEGMENT_FRAMEWORK_claude_v1.md` | 29 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/CLAUDE_SESSION_TRANSCRIPT_2026-05-15_TRIPLE-GRADES-BUILDOUT.md` | 11 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/CORRECTIONS.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/AI_ML_ALGORITHMS_DATATRUST_UPDATED.md` | 40 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/AI_POWERED_DONOR_PLATFORM_ARCHITECTURE.md` | 26 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_DONOR_RECRUITMENT_STRATEGY.md` | 17 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/GEMINI_FRONTEND_ECOSYSTEM_AUDIT_E01_E35_E42_E51.md` | 279 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/JAY_FAISON_CULTIVATION_CAMPAIGN_ARCHITECTURE.md` | 31 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/JAY_FAISON_SPEAKER_INTRODUCTION_STRATEGY.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/THREE_WAY_CLASSIFICATION_GUIDE.md` | 16 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/TWO_WAY_CONVERSION_SYSTEM_GUIDE.md` | 16 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/VIP_DONOR_INTRODUCTION_TEMPLATE_LIBRARY.md` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/ecosystem_profile_enhancements_complete.py` | 47 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/E01_CHRONOLOGICAL_PROGRESSION.html` | 38 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/E01_Donor_Intelligence_Canonical_Reference.pdf` | 417 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/E01_TRIPLE_GRADING_INTEGRATION.docx` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/NC_FIRST_SEARCH_ENGINE_V9_DESIGN.md` | 32 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/Perplexity-Session-Final-Agreements 2.md` | 24 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/SUPPORTER_CULTIVATION_REFRAME_INTEGRATION_PLAN.md` | 17 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/agent_messages_full.md` | 156 |  |

## DOC (14)

| Part | KB | Grade |
|---|---:|---|
| `docs/E01/E01_DONOR_PIPELINE_COMPREHENSIVE_PLAN.md` | 38 |  |
| `docs/E01/ECOSYSTEM_BUILDOUT_TODO_2026-05-15.md` | 49 |  |
| `docs/E01/donor_pipeline_measurement_workbook.xlsx` | 40 |  |
| `docs/ECOSYSTEM_DRIFT_AUDIT_E00_E01_E21_2026-06-27.md` | 6 |  |
| `docs/architecture/2026-02-21_E01-Donor-Intelligence-Inspinia-Technical-Scheme.md` | 14 |  |
| `docs/architecture/SECTION_1_E01_GRADING_CONSOLIDATION_DESIGN.md` | 9 |  |
| `docs/canonical/2026-02-19_Perplexity-E01-E02-Schema-Reconciliation.md` | 10 |  |
| `docs/canonical/E01_Donor_Intelligence_Canonical_Reference.md` | 44 |  |
| `docs/canonical/E01_SEQUENTIAL_LIBRARY_INDEX.md` | 18 |  |
| `docs/canonical/Perplexity-E01-E02-Blueprint.txt` | 87 |  |
| `docs/canonical/grand-audit/CAT2/E01_E06_DONOR_INTEL_ANALYTICS_DOSSIER.md` | 2 |  |
| `docs/handoffs/frontend/E01_Donor_Intelligence.md` | 5 |  |
| `docs/plans/E01_DONOR_PIPELINE_COMPREHENSIVE_PLAN.md` | 69 |  |
| `docs/wizard/E68_E01_DONOR_PIPELINE_DEPENDENCY_2026-06-28.md` | 2 |  |

## ARCHIVE (12)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/E01_CHRONOLOGICAL_PROGRESSION.html` | 38 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/E01_DEPLOY/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA 2.sql` | 22 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.html` | 728 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.pdf` | 417 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E01_TRIPLE_GRADING_INTEGRATION.docx` | 23 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E01_DONOR_INTELLIGENCE.docx` | 28 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.html` | 728 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E01_Donor_Intelligence_Canonical_Reference.pdf` | 417 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/platform/shared/platform-search-index/ecos/E01.json` | 2 |  |
| `archive/diamonds/GEMINI_FRONTEND_ECOSYSTEM_AUDIT_E01_E35_E42_E51.md` | 279 |  |
| `archive/recovered/2026-06-27/nexus/E01_COMPLETE_PACKAGE/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA.sql` | 22 |  |
| `archive/recovered/2026-06-27/nexus/E01_Donor_Intelligence_Canonical_Reference.md` | 44 |  |

## OTHER (25)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E01_GRADING_ENGINE_RUN_2026-07-11.md` | 11 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/AGENT_BOOT/ECOSYSTEM FILES/E01/BGOP_PLATFORM_PLAN_VOLUME_II_DONOR_INTELLIGENCE_2026-06-12.md` | 106 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/AGENT_BOOT/ECOSYSTEM FILES/E01/DONOR_INTELLIGENCE_LOGIC_OWNERSHIP_2026-06-14.md` | 3 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/AGENT_BOOT/ECOSYSTEM FILES/E01/E01_Donor_Intelligence_Canonical_Reference.md` | 44 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/canonical/E01_Donor_Intelligence_Canonical_Reference.md` | 44 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E01_Donor_Intelligence.md` | 5 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/E01-Donor-Intelligence-Inspinia-Technical-Scheme.md` | 14 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-06-27_ecosystem-definitions/E01_Donor_Intelligence.md` | 9 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-06-27_ecosystem-definitions/E01_E13_BRAIN_WAREHOUSE_SEPARATION.md` | 6 |  |
| `E01_DEPLOY/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA.sql` | 22 |  |
| `ECOSYSTEM_REPORTS/E01_DONOR_INTELLIGENCE.docx` | 28 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/architecture/SECTION_1_E01_GRADING_CONSOLIDATION_DESIGN.md` | 9 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e01_determinism.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e01_grade_distribution.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e01_match_tier_passthrough.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/SECTION_1_E01_GRADING_CONSOLIDATION_DESIGN.md` | 9 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e01_determinism.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e01_grade_distribution.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e01_match_tier_passthrough.py` | 4 |  |
| `UNDEPLOYED BROYHILLGOP CODE/_status/superseded/E01-grading_2026-07-11_GRADING_ENGINE_RUN.md` | 1 |  |
| `audit/2026-05-08/cellular/E01.json` | 15 |  |
| `sql/E01_DATA_IMPORT_CONTROL_PANEL_SCHEMA.sql` | 22 |  |
| `tests/test_e01_determinism.py` | 4 |  |
| `tests/test_e01_grade_distribution.py` | 6 |  |
| `tests/test_e01_match_tier_passthrough.py` | 4 |  |

## SHELF — 2026-09-04 DonorAtlas competitor dump (Cursor absorb)

Additive pointer. The generated counts above were not regenerated. Files live under `ECO_CANONICAL/E01/docs/` (standard ECO_MODEL slot). Not installable. Not SQL.

| Part | Role |
|---|---|
| `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf` | Bit-identical upload; sha256 `31041950f804930f1fdc7dc20bc3e767ed3d8a0540d6c8d1d54b8cfcd9f91c60` |
| `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.md` | Normalized extract + provenance |
| `ECO_CANONICAL/E01/docs/DONORATLAS_COLLISIONS_SORT_LATER_2026-09-04.md` | Collision / do-not-rebuild list |

## SHELF — 2026-09-04 donor UI scan (Cursor absorb)

Scan only. `:8081` donor-search.html does not match `:8282` `api/donor_search_api.py`. `atlas.v_gift` is **not** in git.

| Part | Role |
|---|---|
| `ECO_CANONICAL/E01/docs/UI_SCAN_DONOR_SEARCH_PROFILE_2026-09-04.md` | Bit-identical upload; sha256 `6044e44e5d0ee8eafff98fc44b5cc0e0194d8747bae15a08f8d4dfd81dd70698` |
| `ECO_CANONICAL/E100/ABSORB_ECO_STATE_AND_UI_SCAN_2026-09-04.md` | Absorb receipt (paired with E100 eco-state snapshot) |

## SHELF — 2026-09-04 NC First adaptation (DonorAtlas → E01)

Working adapters. Person key `cluster_id` INTEGER. SQL is dryrun `PENDING_AUTHORIZATION` — not applied.

| Part | Role |
|---|---|
| `ECO_CANONICAL/E01/docs/NC_FIRST_DONORATLAS_ADAPTATION_2026-09-04.md` | 13-section map |
| `ECO_CANONICAL/E01/taxonomies/nc_first.yaml` | Entities, NC issue families, 100 counties, triggers |
| `ECO_CANONICAL/E01/directories/nc_first_directories.yaml` | Donor / org / partner directories |
| `ECO_CANONICAL/E01/config/nc_first_stack.yaml` | Tech stack + API (`/e01/nc-first`) |
| `ECO_CANONICAL/E01/code/nc_first_donor_explorer.py` | Read-only explorer |
| `ECO_CANONICAL/E01/tests/test_nc_first_donor_explorer.py` | Unit tests (no Hetzner) |
| `ECO_CANONICAL/E01/frontend/E01_NC_FIRST_DONOR_EXPLORER.html` | Inspinia explorer (canonical) |
| `frontend/candidate-portal/e01-nc-first-donor-explorer.html` | Vercel public door `/e01/nc-first` (copy; `.vercelignore` excludes `ECO_CANONICAL`) |
| `database/migrations/dryrun/DRYRUN_E01_NC_FIRST_DONOR_EXPLORER_VIEWS_2026-09-04.sql` | Additive views |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
