# E30 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 90  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 28 | the shelf — stocked, in-lane |
| **LIVE CODE** | 3 | deployed / runnable |
| **MIGRATION** | 3 | SQL under database/ |
| **LANE DOC** | 10 | lane documentation |
| **ORPHAN** | 8 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 6 | canonical & architecture docs |
| **ARCHIVE** | 5 | reference only — never install from here |
| **OTHER** | 27 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E30/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (28)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E30/ECO_MODEL.md` | 3 |  |
| `ECO_CANONICAL/E30/code/__init__.py` | 1 |  |
| `ECO_CANONICAL/E30/code/compliance.py` | 13 |  |
| `ECO_CANONICAL/E30/code/config.py` | 4 |  |
| `ECO_CANONICAL/E30/code/contracts.py` | 5 |  |
| `ECO_CANONICAL/E30/code/deliverability.py` | 11 |  |
| `ECO_CANONICAL/E30/code/e30-send-worker.py` | 6 |  |
| `ECO_CANONICAL/E30/code/e30_enterprise_email_sender.py` | 27 |  |
| `ECO_CANONICAL/E30/code/ecosystem_30_email.py` | 89 |  |
| `ECO_CANONICAL/E30/code/ecosystem_30_email_complete.py` | 67 |  |
| `ECO_CANONICAL/E30/code/ecosystem_30_email_dual_grading.py` | 8 |  |
| `ECO_CANONICAL/E30/code/grading_router.py` | 6 |  |
| `ECO_CANONICAL/E30/code/ml_loop.py` | 17 |  |
| `ECO_CANONICAL/E30/code/pipeline.py` | 15 |  |
| `ECO_CANONICAL/E30/code/providers.py` | 12 |  |
| `ECO_CANONICAL/E30/code/sender.py` | 11 |  |
| `ECO_CANONICAL/E30/code/sequences.py` | 16 |  |
| `ECO_CANONICAL/E30/code/tenant.py` | 7 |  |
| `ECO_CANONICAL/E30/code/tracking.py` | 15 |  |
| `ECO_CANONICAL/E30/sql/2026-07-05_DRYRUN_E30_ENTERPRISE_EMAIL.sql` | 25 | `GREEN` |
| `ECO_CANONICAL/E30/sql/323_e30_consent_send_suppression.sql` | 8 |  |
| `ECO_CANONICAL/E30/sql/e30_hetzner_teardown.sql` | 5 |  |
| `ECO_CANONICAL/E30/tests/test_e30_canspam.py` | 2 |  |
| `ECO_CANONICAL/E30/tests/test_e30_consent.py` | 4 |  |
| `ECO_CANONICAL/E30/tests/test_e30_fec_disclaimer.py` | 2 |  |
| `ECO_CANONICAL/E30/tests/test_e30_match_tier_gate.py` | 3 |  |
| `ECO_CANONICAL/E30/tests/test_e30_pentad_contract.py` | 8 |  |
| `ECO_CANONICAL/E30/tests/test_e30_suppression.py` | 2 |  |

## LIVE CODE (3)

| Part | KB | Grade |
|---|---:|---|
| `ecosystems/e30_enterprise_email_sender.py` | 27 |  |
| `scripts/e30-send-worker.py` | 6 |  |
| `tools/e30_hetzner_teardown.sql` | 5 |  |

## MIGRATION (3)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/323_e30_consent_send_suppression.sql` | 8 |  |
| `database/migrations/dryrun/2026-07-05_DRYRUN_E30_ENTERPRISE_EMAIL.sql` | 25 | `DUPE` → `2026-07-05_DRYRUN_E30_ENTERPRISE_EMAIL.sql` |
| `database/migrations/dryrun/DRYRUN_E30_DELETE_DISABLED_DUPLICATE_2026-07-27.sql` | 1 |  |

## LANE DOC (10)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E30/E30_SPECIFICATION.md` | 5 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/E35_CONVERSATION_NOTIFICATION_FABRIC_2026-06-13.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/E35_IVR_RESPONSE_MATRIX_CANON_18_2026-06-16.md` | 8 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/EMAIL_DELIVERABILITY_ARCHITECTURE.md` | 10 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/PERSONALIZED_COMMUNICATION_ENGINE_CANON_19_2026-06-17.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/SYMPHONY_DOCTRINE_CANON_17_2026-06-16.md` | 13 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E30_EMAIL_CAMPAIGNS.docx` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E30_SUPPRESS_BRIDGE_DRYRUN_cursor_v1.md` | 2 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E30_SUPPRESS_BRIDGE_PROOF_cursor_v1.md` | 2 |  |

## ORPHAN (8)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/BROYHILLGOP_WEAPON_PERFORMANCE_VARIABLES_LP_FOUNDATION.md` | 37 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_COMMUNICATION_FRAMEWORK_LIBRARY.md` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/EMAIL_SYSTEM_QUICK_ANSWER.md` | 5 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/EMAIL_SYSTEM_STATUS_ANALYSIS.md` | 26 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/VIP_DONOR_INTRODUCTION_TEMPLATE_LIBRARY.md` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/WORLD_CLASS_POLITICAL_EMAIL_PLATFORM_ARCHITECTURE.md` | 76 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/RECOMMENDATIONS.md` | 6 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E30/NONDEPLOYED_ORPHANS/docs/GUN_BATTERY_FINAL_2026-06-06.md` | 6 |  |

## DOC (6)

| Part | KB | Grade |
|---|---:|---|
| `docs/architecture/SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md` | 12 |  |
| `docs/audits/deep87/DEEP_RESEARCH_BATCH3_E30_E44_2026-07-23.md` | 9 |  |
| `docs/canonical/E30_SEQUENTIAL_LIBRARY_INDEX.md` | 15 |  |
| `docs/canonical/grand-audit/CAT4/E30_E31_E32_E17_BUILT_GUNS_DOSSIER.md` | 4 |  |
| `docs/ecosystems/missing/E30_MISSING.md` | 1 |  |
| `docs/handoffs/frontend/E30_Email_System.md` | 5 |  |

## ARCHIVE (5)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E30_EMAIL_CAMPAIGNS.docx` | 18 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E30_SUPPRESS_BRIDGE_DRYRUN_cursor_v1.md` | 2 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E30_SUPPRESS_BRIDGE_PROOF_cursor_v1.md` | 2 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/323_e30_consent_send_suppression.sql` | 8 |  |
| `archive/recovered/2026-07-01/claude-session-fade/RAW_PASTED_TEXT_CLAUDE_E61_E72_BRAIN_E30_2026-07-01.txt` | 8 |  |

## OTHER (27)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E30_EMAIL_DDL_2026-07-05.md` | 3 |  |
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E30_FIRST_WEAPON_SEAM_2026-07-10.md` | 16 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E30_Email_System.md` | 5 |  |
| `ECOSYSTEM_BLUEPRINTS/E30_EMAIL_FUNNEL_BUILDER_CLONE_BLUEPRINT_2026-06-10.md` | 57 |  |
| `ECOSYSTEM_REPORTS/E30_EMAIL_CAMPAIGNS.docx` | 18 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/architecture/SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md` | 12 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e30_canspam.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e30_consent.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e30_fec_disclaimer.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e30_match_tier_gate.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e30_suppression.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md` | 12 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_canspam.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_consent.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_fec_disclaimer.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_match_tier_gate.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_pentad_contract.py` | 8 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e30_suppression.py` | 2 |  |
| `audit/2026-05-08/cellular/E30.json` | 9 |  |
| `deploy/e30/e30-send-worker.service` | 0 |  |
| `deploy/e30/e30.env.example` | 0 |  |
| `tests/test_e30_canspam.py` | 2 |  |
| `tests/test_e30_consent.py` | 4 |  |
| `tests/test_e30_fec_disclaimer.py` | 2 |  |
| `tests/test_e30_match_tier_gate.py` | 3 |  |
| `tests/test_e30_pentad_contract.py` | 8 |  |
| `tests/test_e30_suppression.py` | 2 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
