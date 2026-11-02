# E59 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 117  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 29 | the shelf — stocked, in-lane |
| **LIVE CODE** | 1 | deployed / runnable |
| **MIGRATION** | 13 | SQL under database/ |
| **LANE DOC** | 27 | lane documentation |
| **ORPHAN** | 6 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 9 | canonical & architecture docs |
| **ARCHIVE** | 20 | reference only — never install from here |
| **OTHER** | 12 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E59/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (29)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E59/ECO_MODEL.md` | 3 |  |
| `ECO_CANONICAL/E59/code/__init__.py` | 1 |  |
| `ECO_CANONICAL/E59/code/_decode_transfer.py` | 0 |  |
| `ECO_CANONICAL/E59/code/base_agent.py` | 26 |  |
| `ECO_CANONICAL/E59/code/brain_integration.py` | 13 |  |
| `ECO_CANONICAL/E59/code/control_api.py` | 18 |  |
| `ECO_CANONICAL/E59/code/cost_tracker.py` | 11 |  |
| `ECO_CANONICAL/E59/code/ecosystem_59_microsegment_intelligence.py` | 81 |  |
| `ECO_CANONICAL/E59/code/notifier.py` | 11 |  |
| `ECO_CANONICAL/E59/code/rule_engine.py` | 12 |  |
| `ECO_CANONICAL/E59/code/supervisor.py` | 12 |  |
| `ECO_CANONICAL/E59/frontend/control_panel.html` | 60 |  |
| `ECO_CANONICAL/E59/frontend/index.html` | 32 |  |
| `ECO_CANONICAL/E59/frontend/mockSearchDonors.js` | 7 |  |
| `ECO_CANONICAL/E59/sql/001_agent_mesh_schema.sql` | 29 |  |
| `ECO_CANONICAL/E59/sql/2026-07-14_E59_DISTRICT_RANKING_PHASE2_LIVE.sql` | 5 |  |
| `ECO_CANONICAL/E59/sql/305_e59_microsegment_intensity_log.sql` | 7 |  |
| `ECO_CANONICAL/E59/sql/306_e59_page_config.sql` | 10 |  |
| `ECO_CANONICAL/E59/sql/308_e59_microsegment_hierarchy.sql` | 7 |  |
| `ECO_CANONICAL/E59/sql/309_e59_taxonomy_extension_queue.sql` | 4 |  |
| `ECO_CANONICAL/E59/sql/310_e59_wizard_launch_context.sql` | 7 |  |
| `ECO_CANONICAL/E59/sql/311_e59_donor_segment_assignment.sql` | 6 |  |
| `ECO_CANONICAL/E59/sql/312_e59_district_ranking.sql` | 6 |  |
| `ECO_CANONICAL/E59/sql/312_e59_sic_waterfall_segments.sql` | 20 |  |
| `ECO_CANONICAL/E59/sql/DRYRUN_E59_BIND_AND_BURST_2026-07-14.sql` | 5 |  |
| `ECO_CANONICAL/E59/sql/DRYRUN_E59_DISTRICT_RANKING_PHASE1_2026-07-14.sql` | 5 |  |
| `ECO_CANONICAL/E59/sql/DRYRUN_E59_ISSUE_PROFILE_SEED_2026-07-14.sql` | 5 |  |
| `ECO_CANONICAL/E59/sql/E59_MICROSEGMENT_ENGINE_INSTALL_2026-07-08.sql` | 96 |  |
| `ECO_CANONICAL/E59/sql/E59_WIZARD_PRELAUNCH_VALIDATION_2026-06-30.sql` | 9 |  |

## LIVE CODE (1)

| Part | KB | Grade |
|---|---:|---|
| `frontend/inspinia/commander-portal/e59-prototype/E59_PROTOTYPE_README.md` | 5 |  |

## MIGRATION (13)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/2026-07-14_E59_DISTRICT_RANKING_PHASE2_LIVE.sql` | 5 |  |
| `database/migrations/312_e59_sic_waterfall_segments.sql` | 20 |  |
| `database/migrations/E59_MICROSEGMENT_ENGINE_INSTALL_2026-07-08.sql` | 96 |  |
| `database/migrations/dryrun/305_e59_microsegment_intensity_log.sql` | 7 | `GREEN` |
| `database/migrations/dryrun/306_e59_page_config.sql` | 10 | `GREEN` |
| `database/migrations/dryrun/308_e59_microsegment_hierarchy.sql` | 7 | `GREEN` |
| `database/migrations/dryrun/309_e59_taxonomy_extension_queue.sql` | 4 | `GREEN` |
| `database/migrations/dryrun/310_e59_wizard_launch_context.sql` | 7 | `GREEN` |
| `database/migrations/dryrun/311_e59_donor_segment_assignment.sql` | 6 | `GREEN` |
| `database/migrations/dryrun/312_e59_district_ranking.sql` | 6 | `GREEN` |
| `database/migrations/dryrun/DRYRUN_E59_BIND_AND_BURST_2026-07-14.sql` | 5 |  |
| `database/migrations/dryrun/DRYRUN_E59_DISTRICT_RANKING_PHASE1_2026-07-14.sql` | 5 |  |
| `database/migrations/dryrun/DRYRUN_E59_ISSUE_PROFILE_SEED_2026-07-14.sql` | 5 |  |

## LANE DOC (27)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E59/2026-05-07_BARS_VS_UNIVERSES_BRIDGE_claude_v1.md` | 6 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/BGOP_PLATFORM_PLAN_VOLUME_XIII_MICROSEGMENT_WIZARD_2026-06-12.md` | 111 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/BROYHILLGOP_MICROSEGMENTATION_SCHEMA.md` | 63 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/BROYHILLGOP_VARIABLE_SCORING_ENGINE_SCHEMA.md` | 53 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/CATEGORY_38_MICROSEGMENT_BEHAVIORAL_RESPONSE_INTENSITY_v1.md` | 34 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/COMPOSITE_VARIABLE_REGISTRY_v1_2026-06-17.md` | 224 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/DATATRUST_ACXIOM_SCORING_STANDARD_2026-06-17.md` | 6 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/DISTRICT_TAG_MATRIX_REVELATION_2026-06-02.md` | 8 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v1_2026-05-26.md` | 43 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v2_2026-05-26.md` | 130 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/E59_SPECIFICATION.md` | 5 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/MICROSEGMENT_HEAT_MAP_CANON_16_2026-06-16.md` | 38 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/MICROSEGMENT_RESPONSIVENESS_LOOP_2026-06-14.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/PERSONICX_BESPOKE_DONOR_DEFINITION_MATRIX_2026-05-13.md` | 71 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/REPUBLICAN_CLASSIFICATION_SYSTEM_V1.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/XYZ_MICROSEGMENT_ENGINE_SPEC_2026-05-25.md` | 90 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_APPENDIX_D_RESEARCH_SOURCES.docx` | 22 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_APPENDIX_E_LEGISLATIVE_FEEDS.docx` | 22 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_CANDIDATE_KNOWLEDGE_ARSENAL.docx` | 32 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/BROYHILLGOP_MICROSEGMENTATION_SCHEMA.md` | 63 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/BROYHILLGOP_VARIABLE_SCORING_ENGINE_SCHEMA.md` | 53 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/COMPOSITE_VARIABLE_REGISTRY_v1_2026-06-17.md` | 224 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v1_2026-05-26.md` | 43 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v2_2026-05-26.md` | 130 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/PERSONICX_BESPOKE_DONOR_DEFINITION_MATRIX_2026-05-13.md` | 71 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/XYZ_MICROSEGMENT_ENGINE_SPEC_2026-05-25.md` | 90 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/REGISTRY/E59_DOC_REGISTRY.md` | 8 |  |

## ORPHAN (6)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/2026-05-14_FULL_SCOPE_MICROSEGMENTS_FUNNELS_TRIGGERS_claude_v1.md` | 71 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/E59-microsegments_2026-07-10_E59_BIND_AND_BURST.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/E59_APPENDIX_D_RESEARCH_SOURCES.docx` | 22 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/E59_APPENDIX_E_LEGISLATIVE_FEEDS.docx` | 22 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/E59_CANDIDATE_KNOWLEDGE_ARSENAL.docx` | 32 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E59/NONDEPLOYED_ORPHANS/legislative-microsegment-explorer.html` | 15 |  |

## DOC (9)

| Part | KB | Grade |
|---|---:|---|
| `docs/audits/deep87/DEEP_RESEARCH_BATCH4_E45_E59_2026-07-23.md` | 9 |  |
| `docs/canonical/CHRS_GAP_ANALYSIS_VS_E59_2026-06-19.md` | 32 |  |
| `docs/canonical/CONSUMER_READINESS_AUDIT_E64_E59_E68_2026-07-14.md` | 4 |  |
| `docs/canonical/E59_MICROSEGMENT_ASSIGNMENT_STATE_2026-06-30.md` | 4 |  |
| `docs/canonical/E59_MICROSEGMENT_CLOSEOUT_AND_WEAPON_FIRE_BLOCKERS_2026-07-02.md` | 7 |  |
| `docs/canonical/E59_SEQUENTIAL_LIBRARY_INDEX.md` | 26 |  |
| `docs/canonical/E59_SIC_WATERFALL_EXECUTION_TRAIL_AND_REPLAY_RULING_2026-07-02.md` | 6 |  |
| `docs/canonical/grand-audit/CAT2/E21_E59_ML_MICROSEG_DOSSIER.md` | 3 |  |
| `docs/ecosystems/E59_MICROSEGMENT_INTELLIGENCE_SPEC.md` | 8 |  |

## ARCHIVE (20)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_APPENDIX_D_RESEARCH_SOURCES.docx` | 22 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_APPENDIX_E_LEGISLATIVE_FEEDS.docx` | 22 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E59_CANDIDATE_KNOWLEDGE_ARSENAL.docx` | 32 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/2026-05-07_BARS_VS_UNIVERSES_BRIDGE_claude_v1.md` | 6 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/BROYHILLGOP_MICROSEGMENTATION_SCHEMA.md` | 63 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/BROYHILLGOP_VARIABLE_SCORING_ENGINE_SCHEMA.md` | 53 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/CATEGORY_38_MICROSEGMENT_BEHAVIORAL_RESPONSE_INTENSITY_v1.md` | 34 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/COMPOSITE_VARIABLE_REGISTRY_v1_2026-06-17.md` | 224 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v1_2026-05-26.md` | 43 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/DONOR_MICROSEGMENT_CANONICAL_DIRECTORY_v2_2026-05-26.md` | 130 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/PERSONICX_BESPOKE_DONOR_DEFINITION_MATRIX_2026-05-13.md` | 71 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E59/XYZ_MICROSEGMENT_ENGINE_SPEC_2026-05-25.md` | 90 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/platform/shared/platform-search-index/ecos/E59.json` | 2 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/305_e59_microsegment_intensity_log.sql` | 7 | `DUPE` → `305_e59_microsegment_intensity_log.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/306_e59_page_config.sql` | 10 | `DUPE` → `306_e59_page_config.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/308_e59_microsegment_hierarchy.sql` | 7 | `DUPE` → `308_e59_microsegment_hierarchy.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/309_e59_taxonomy_extension_queue.sql` | 4 | `DUPE` → `309_e59_taxonomy_extension_queue.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/310_e59_wizard_launch_context.sql` | 7 | `DUPE` → `310_e59_wizard_launch_context.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/311_e59_donor_segment_assignment.sql` | 6 | `DUPE` → `311_e59_donor_segment_assignment.sql` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/312_e59_district_ranking.sql` | 6 | `DUPE` → `312_e59_district_ranking.sql` |

## OTHER (12)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E59_BIND_AND_BURST_2026-07-10.md` | 7 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/AGENT_BOOT/ECOSYSTEM FILES/E59/MICROSEGMENT_HEAT_MAP_CANON_16_2026-06-16.md` | 38 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/AGENT_BOOT/ECOSYSTEM FILES/REGISTRY/E59_DOC_REGISTRY.md` | 8 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/canonical/CHRS_GAP_ANALYSIS_VS_E59_2026-06-19.md` | 32 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/frontend/inspinia/commander-portal/e59-prototype/E59_PROTOTYPE_README.md` | 5 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-06-27_ecosystem-definitions/E59_Heat_Map.md` | 9 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-06-27_ecosystem-definitions/E59_VOLUME_KNOB_SPEC.md` | 13 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/E59_AFFINITY_ACCURACY_BRIEF_2026-06-30.md` | 4 |  |
| `UNDEPLOYED BROYHILLGOP CODE/_status/deployed/E59-microsegments_2026-07-10_E59_BIND_AND_BURST.md` | 1 |  |
| `audit/2026-05-08/cellular/E59.json` | 10 |  |
| `nexus-claude-cursor/E59_WIZARD_INGESTION_PIPELINE_AUDIT_2026-06-30.md` | 9 |  |
| `nexus-claude-cursor/E59_WIZARD_PRELAUNCH_VALIDATION_2026-06-30.sql` | 9 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
