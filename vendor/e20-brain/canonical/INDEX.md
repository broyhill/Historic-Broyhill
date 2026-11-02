# E20 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 91  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 9 | the shelf — stocked, in-lane |
| **LIVE CODE** | 1 | deployed / runnable |
| **MIGRATION** | 10 | SQL under database/ |
| **LANE DOC** | 13 | lane documentation |
| **ORPHAN** | 23 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 10 | canonical & architecture docs |
| **ARCHIVE** | 16 | reference only — never install from here |
| **OTHER** | 9 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E20/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

**Additive 2026-08-31 (not a generated-table edit).** Founding D365 sync fabric is referenced, not installed: `ECO_CANONICAL/E20/007_BRAIN_CRM_POINTER.md` → read copy `database/schemas/007_brain_crm.sql`. Fails the six-gate entry rule (unqualified `search_path` to `brain_control`). Do not copy into `sql/`.

## CANONICAL (9)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E20/ECO_MODEL.md` | 3 |  |
| `ECO_CANONICAL/E20/code/E20_BRAIN_CENTRIC_ARCHITECTURE.py` | 44 |  |
| `ECO_CANONICAL/E20/code/E20_volunteer_integration_update.py` | 14 |  |
| `ECO_CANONICAL/E20/code/ecosystem_20_intelligence_brain.py` | 33 |  |
| `ECO_CANONICAL/E20/code/ecosystem_20_intelligence_brain_complete.py` | 33 |  |
| `ECO_CANONICAL/E20/code/ecosystem_20_intelligence_brain_v2.py` | 51 |  |
| `ECO_CANONICAL/E26/sql/DRYRUN_E26_NURTURE_ROUTING_RULES_2026-06-20.sql` | 7 | `AMBER` |
| `ECO_CANONICAL/E48/sql/DRYRUN_E48_VIDEO_QUEUE_2026-06-20.sql` | 12 | `AMBER` |
| `ECO_CANONICAL/E79/sql/DRYRUN_E79_E80_WIRING_2026-07-08.sql` | 9 | `AMBER` |

## LIVE CODE (1)

| Part | KB | Grade |
|---|---:|---|
| `backend/python/ecosystems/E20_volunteer_integration_update.py` | 14 |  |

## MIGRATION (10)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/dryrun/2026-06-13_DRYRUN_BRAIN_ACTION_EXECUTORS.sql` | 5 | `AMBER` |
| `database/migrations/dryrun/2026-06-13_DRYRUN_PROSPECT_PIPELINE_STAGE_ENUM.sql` | 7 | `AMBER` |
| `database/migrations/dryrun/2026-06-14_KEYSTONE_ACTION_EXECUTORS.sql` | 7 | `RED` |
| `database/migrations/dryrun/DRYRUN_BRAIN_905_TRIGGER_LIBRARY_SEED_2026-07-08.sql` | 49 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_MULTICHANNEL_FATIGUE_CAPS_2026-06-20.sql` | 8 | `RED` |
| `database/migrations/dryrun/DRYRUN_NC_FIRST_PIPELINE_BUILD_SPEC_2026-06-20.sql` | 13 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_PROSPECT_PIPELINE_STAGE_ENUM_2026-06-13.sql` | 8 | `AMBER` |
| `database/migrations/dryrun/DRYRUN_R3_WITHDRAWN_FLAG_2132854_DECEASED_2026-07-27.sql` | 3 | `GREEN` |
| `database/migrations/dryrun/DRYRUN_THOMPSON_BANDIT_ALLOCATION_2026-06-20.sql` | 9 | `RED` |
| `database/migrations/dryrun/OBSERVE_LOOP_CLOSURE_372171_SPEC.sql` | 6 | `AMBER` |

## LANE DOC (13)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BGOP_PLATFORM_PLAN_VOLUME_IV_BRAIN_DEPLOYMENT_2026-06-12.md` | 67 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BGOP_PLATFORM_PLAN_VOLUME_V_E20_BRAIN_2026-06-12.md` | 219 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BGOP_PLATFORM_PLAN_VOLUME_XI_TRIGGERS_2026-06-12.md` | 29 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BGOP_TRIGGER_ARCHITECTURE_2026-06-07.md` | 28 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BRAIN_ARCHITECTURE_LP_ENGINE_FEB2026.docx` | 579 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/BRAIN_PENTAD_CONTRACTS.md` | 14 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/DONATION_ASK_EVENT_RATIFICATION_2026-06-14.md` | 9 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/E20_Brain_Canonical_Reference.md` | 219 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/E20_SPECIFICATION.md` | 10 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/MULTI_AGENT_DISPATCH_PATTERN_2026-06-16.md` | 9 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/UNIFIED_TRIGGER_FABRIC_2026-06-15.md` | 14 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E20_Brain_Audit_Report 2.docx` | 9 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E20_INTELLIGENCE_BRAIN.docx` | 23 |  |

## ORPHAN (23)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2025-12-29_BROYHILLGOP_COMPLETE_TECHNICAL_ARCHITECTURE_ed_v1.txt` | 30 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-06_Ruflo-Phase1-Two-Track-Mission.md` | 7 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-07_BARS_VS_UNIVERSES_BRIDGE_claude_v1.md` | 6 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-08_E20_LIFECYCLE_claude_v1.md` | 7 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-08_PROMETHEUS_MASTER_MAP_nexus_v1.txt` | 422 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-08_PROMETHEUS_TAG_CATALOG_nexus_v1.md` | 40 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-14_E20_INTELLIGENCE_BRAIN_UPGRADE_claude_v1.md` | 74 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/2026-05-19-2230-session-brief.md` | 3 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/BROYHILLGOP_ADDICTIVE_DESIGN_COMPLETE_FINAL.md` | 40 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/control_panel_enhanced.py` | 54 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/master_control_panel.py` | 76 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/DONOR_MERGE_ARCHITECTURE.md` | 13 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/E70_ECOSYSTEM_SEARCH_SPEC.md` | 13 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/ECOSYSTEM_VIDEO_SOUND_E20_BRAIN_ANALYSIS.md` | 20 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/MATCHING_ALGORITHM_COMPLETE_ARCHITECTURE.md` | 45 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/NEXUS_SLEEP_2026-05-23_brain-rescue-and-e20-blast-radius.md` | 39 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/RASA_CRITIQUE_AND_BROYHILLCALM_ALTERNATIVE copy.md` | 57 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/SESSION_REPORT_2026-05-13_to_14_claude_v1.md` | 89 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/architecture-recon-phase-1.md` | 51 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/broyhillgop_ai_copilot_demo.html` | 50 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/docs/ARSENAL_COMPLETE_CANONICAL_2026-06-07.md` | 11 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/docs/CROSS_ECOSYSTEM_DEPENDENCY_HEATMAP_2026-06-05.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/feb 15 BroyhillGOP Supabase Audit - Recommendations & To-Do List 2.md` | 66 |  |

## DOC (10)

| Part | KB | Grade |
|---|---:|---|
| `docs/NEXUS_TO_CLAUDE_E20_RECOMPOSITION_DIRECTIVE.md` | 40 |  |
| `docs/canonical/BGOP_PLATFORM_PLAN_VOLUME_V_E20_BRAIN_2026-06-12.md` | 219 |  |
| `docs/canonical/E20_Brain_Canonical_Reference.md` | 219 |  |
| `docs/canonical/E20_SEQUENTIAL_LIBRARY_INDEX.md` | 15 |  |
| `docs/canonical/grand-audit/CAT3/E20_E22_BRAIN_AB_DOSSIER.md` | 3 |  |
| `docs/ecosystems/E20_INTELLIGENCE_BRAIN_SPEC.md` | 20 |  |
| `docs/handoffs/ECOSYSTEM_E20_INTEGRATION_AUDIT_2026-05-24.md` | 9 |  |
| `docs/handoffs/NEXUS_SLEEP_2026-05-23_brain-rescue-and-e20-blast-radius.md` | 39 |  |
| `docs/handoffs/frontend/E20_Intelligence_Brain_dashboard_page.md` | 5 |  |
| `docs/research/strategy/E20_MCP_GAP_MATRIX_2026-06-04.md` | 14 |  |

## ARCHIVE (16)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E20_Brain_Audit_Report 2.docx` | 9 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E20_Brain_Audit_Report.docx` | 9 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/_unpacked/SESSION_BUNDLE_2026-05-13_to_14/SESSION_BUNDLE_2026-05-13_to_14/01_architecture/2026-05-14_E20_INTELLIGENCE_BRAIN_UPGRADE_claude_v1.md` | 74 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E20_Brain_Audit_Report 2.docx` | 9 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E20_Brain_Audit_Report.docx` | 9 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E20_INTELLIGENCE_BRAIN.docx` | 23 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/database/migrations/dryrun/401_e14_lettrlabs_brain_triggers.sql` | 3 | `AMBER` |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/database/migrations/dryrun/DRYRUN_LOSS_ANALYSIS_LEDGER_VIEWS_2026-06-20.sql` | 3 | `GREEN` |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/architecture/2026-05-14_E20_INTELLIGENCE_BRAIN_UPGRADE_claude_v1.md` | 74 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/ecosystems/2026-05-08_E20_LIFECYCLE_claude_v1.md` | 7 |  |
| `AGENT_BOOT/recovery/PY_LOST_AND_FOUND_2026-07-12/extracted/PY Lost and Found/E20_volunteer_integration_update.py` | 14 |  |
| `AGENT_BOOT/recovery/PY_LOST_AND_FOUND_2026-07-12/extracted/__MACOSX/PY Lost and Found/._E20_volunteer_integration_update.py` | 0 |  |
| `archive/lost-and-found/E20_volunteer_integration_update.py` | 14 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/DRYRUN_NC_FIRST_PIPELINE_BUILD_SPEC_2026-06-20.sql` | 13 | `AMBER` |
| `archive/recovered/2026-06-27/nexus/E20_Brain_Canonical_Reference.md` | 219 |  |
| `archive/recovered/2026-06-27/nexus/ECOSYSTEM_VIDEO_SOUND_E20_BRAIN_ANALYSIS.md` | 20 |  |

## OTHER (9)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E20_Intelligence_Brain_dashboard_page.md` | 5 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-07-19-20_ten-ecosystem-masterpiece/Doctrine-Drafts-Bundle--2026-07-20-from-E20-finding.zip` | 15 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/E20_BRAIN_ML_ARCHAEOLOGICAL_AUDIT_2026-06-01.md` | 8 |  |
| `E20_Brain_Audit_Report.docx` | 9 |  |
| `ECOSYSTEM_REPORTS/E20_INTELLIGENCE_BRAIN.docx` | 23 |  |
| `STRANDED_RESCUE_2026-05-23/from-google-drive/brain-files-2026-01-26/E20_BRAIN_CENTRIC_ARCHITECTURE.py` | 44 |  |
| `STRANDED_RESCUE_2026-05-23/from-mac-priority/docs/architecture/2026-05-14_E20_INTELLIGENCE_BRAIN_UPGRADE_claude_v1.md` | 74 |  |
| `audit/2026-05-08/cellular/E20.json` | 14 |  |
| `session-tasks/03-backend-finalization-spec/DRYRUN_BACKEND_FINALIZATION_TABLES_2026-06-28.sql` | 8 | `GREEN` |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
