# E14 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 30  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 6 | the shelf — stocked, in-lane |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 3 | lane documentation |
| **ORPHAN** | 3 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 5 | canonical & architecture docs |
| **ARCHIVE** | 8 | reference only — never install from here |
| **OTHER** | 4 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E14/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (6)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E14/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E14/code/ecosystem_14_print_production.py` | 29 |  |
| `ECO_CANONICAL/E14/code/ecosystem_14_print_production_complete.py` | 27 |  |
| `ECO_CANONICAL/E14/sql/400_e14_lettrlabs_print_job_log.sql` | 2 |  |
| `ECO_CANONICAL/E14/sql/401_e14_lettrlabs_brain_triggers.sql` | 3 |  |
| `ECO_CANONICAL/E14/sql/402_e14_vendor_registry.sql` | 36 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/dryrun/402_e14_vendor_registry.sql` | 36 | `RED` |

## LANE DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E14/E14_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/audit/E13_E14_SCHEMA_DEPENDENCY_AUDIT_2026-06-22.md` | 7 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/audit/SCHEMA_RECONCILIATION_E13_E14_PAC_DONOR_PROFILE_2026-06-22.md` | 21 |  |

## ORPHAN (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E14/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/40_SEGMENT_CUSTOMIZED_TEMPLATES.md` | 28 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E14/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_ECOSYSTEM_MASTER_REVIEW.md` | 54 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E14/NONDEPLOYED_ORPHANS/E18_VARIABLE_DATA_PRINTING_manual_controls.md` | 23 |  |

## DOC (5)

| Part | KB | Grade |
|---|---:|---|
| `docs/audits/deep87/DEEP_RESEARCH_BATCH1_E00_E14_2026-07-23.md` | 10 |  |
| `docs/canonical/E14_LETTRLABS_WEBHOOK_HANDLER_TDD_2026-06-20.md` | 42 |  |
| `docs/canonical/E14_SEQUENTIAL_LIBRARY_INDEX.md` | 18 |  |
| `docs/ecosystems/missing/E14_MISSING.md` | 1 |  |
| `docs/taxonomy/test_fixtures/adv_02_bmw_e14.md` | 1 |  |

## ARCHIVE (8)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E14/E14_MISSING.md` | 1 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/audit/E13_E14_SCHEMA_DEPENDENCY_AUDIT_2026-06-22.md` | 7 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/audit/SCHEMA_RECONCILIATION_E13_E14_PAC_DONOR_PROFILE_2026-06-22.md` | 21 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/database/migrations/dryrun/400_e14_lettrlabs_print_job_log.sql` | 2 | `GREEN` |
| `archive/lost-and-found/migrations/dryrun/400_e14_lettrlabs_print_job_log.sql` | 2 | `DUPE` → `400_e14_lettrlabs_print_job_log.sql` |
| `archive/lost-and-found/migrations/dryrun/401_e14_lettrlabs_brain_triggers.sql` | 3 | `DUPE` → `401_e14_lettrlabs_brain_triggers.sql` |
| `archive/lost-and-found/migrations/dryrun/402_e14_vendor_registry.sql` | 36 | `RED` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/402_e14_vendor_registry.sql` | 36 | `DUPE` → `402_e14_vendor_registry.sql` |

## OTHER (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR/audit/E13_E14_SCHEMA_DEPENDENCY_AUDIT_2026-06-22.md` | 7 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR/audit/SCHEMA_RECONCILIATION_E13_E14_PAC_DONOR_PROFILE_2026-06-22.md` | 21 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/taxonomy/test_fixtures/adv_02_bmw_e14.md` | 1 |  |
| `audit/2026-05-08/cellular/E14.json` | 5 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
