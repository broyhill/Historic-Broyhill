# E46 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 11  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 3 | the shelf — stocked, in-lane |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 2 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E46/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (3)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E46/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E46/code/ecosystem_46_broadcast_hub.py` | 40 |  |
| `ECO_CANONICAL/E46/code/ecosystem_46_broadcast_hub_complete.py` | 40 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E46/E46_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E46_BROADCAST_HUB.docx` | 31 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E46/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E46_SEQUENTIAL_LIBRARY_INDEX.md` | 19 |  |
| `docs/canonical/grand-audit/CAT4/E33_E35_E36_E57_E16_E46_E67_E69_E70_THIN_GUNS_DOSSIER.md` | 3 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E46_BROADCAST_HUB.docx` | 31 |  |

## OTHER (2)

| Part | KB | Grade |
|---|---:|---|
| `ECOSYSTEM_REPORTS/E46_BROADCAST_HUB.docx` | 31 |  |
| `audit/2026-05-08/cellular/E46.json` | 10 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
