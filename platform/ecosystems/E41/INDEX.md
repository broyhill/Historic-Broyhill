# E41 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 18  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 7 | the shelf — stocked, in-lane |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 3 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E41/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (7)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E41/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E41/code/ecosystem_41_campaign_builder.py` | 44 |  |
| `ECO_CANONICAL/E41/code/ecosystem_41_campaign_builder_complete.py` | 42 |  |
| `ECO_CANONICAL/E41/frontend/1766013160624_ecosystem_41_campaign_builder_ui 2.html` | 36 |  |
| `ECO_CANONICAL/E41/frontend/1766013160624_ecosystem_41_campaign_builder_ui.html` | 36 |  |
| `ECO_CANONICAL/E41/frontend/ecosystem_41_campaign_builder_ui 2.html` | 36 |  |
| `ECO_CANONICAL/E41/frontend/ecosystem_41_campaign_builder_ui.html` | 36 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/dryrun/DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql` | 5 | `AMBER` |

## LANE DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E41/E41_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E41_CAMPAIGN_BUILDER.docx` | 21 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/REGISTRY/E41_DOC_REGISTRY.md` | 9 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E41/NONDEPLOYED_ORPHANS/E41-wizard_2026-06-12_wizard_nodes.md` | 1 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E41_SEQUENTIAL_LIBRARY_INDEX.md` | 26 |  |
| `docs/ecosystems/missing/E41_MISSING.md` | 1 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E41_CAMPAIGN_BUILDER.docx` | 21 |  |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `ECOSYSTEM_REPORTS/E41_CAMPAIGN_BUILDER.docx` | 21 |  |
| `UNDEPLOYED BROYHILLGOP CODE/_status/deployed/E41-wizard_2026-06-12_wizard_nodes.md` | 1 |  |
| `audit/2026-05-08/cellular/E41.json` | 8 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
