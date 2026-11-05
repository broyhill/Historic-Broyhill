# E23 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 12  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 4 | the shelf — stocked, in-lane |
| **LANE DOC** | 1 | lane documentation |
| **ORPHAN** | 2 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 3 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 1 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E23/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (4)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E23/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E23/code/ecosystem_23_creative_asset_3d_engine.py` | 35 |  |
| `ECO_CANONICAL/E23/code/ecosystem_23_creative_asset_3d_engine_complete.py` | 34 |  |
| `ECO_CANONICAL/E23/sql/ecosystem_23_complete_database_schema.sql` | 35 |  |

## LANE DOC (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E23/E23_SPECIFICATION.md` | 1 |  |

## ORPHAN (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E23/NONDEPLOYED_ORPHANS/INDEX.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E23/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E23_CREATIVE_ASSET_FACTORY_HEATMAP_WIZARD_INTEGRATION_2026-07-02.md` | 11 |  |
| `docs/canonical/E23_SEQUENTIAL_LIBRARY_INDEX.md` | 22 |  |
| `docs/canonical/E23_VENDOR_LANDSCAPE_AND_ADAPTER_STACK_RULING_2026-07-02.md` | 9 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E23/README.md` | 2 |  |

## OTHER (1)

| Part | KB | Grade |
|---|---:|---|
| `audit/2026-05-08/cellular/E23.json` | 8 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
