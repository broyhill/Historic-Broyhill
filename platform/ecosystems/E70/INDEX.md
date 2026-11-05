# E70 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 10  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 1 | the shelf — stocked, in-lane |
| **LANE DOC** | 1 | lane documentation |
| **ORPHAN** | 2 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 5 | canonical & architecture docs |
| **OTHER** | 1 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E70/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (1)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E70/ECO_MODEL.md` | 1 |  |

## LANE DOC (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E70/E70_SPECIFICATION.md` | 0 |  |

## ORPHAN (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E70/NONDEPLOYED_ORPHANS/E70_ECOSYSTEM_SEARCH_SPEC.md` | 13 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E70/NONDEPLOYED_ORPHANS/NOTHING_RECOVERED_2026-07-22.md` | 0 |  |

## DOC (5)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E70_SEQUENTIAL_LIBRARY_INDEX.md` | 11 |  |
| `docs/canonical/grand-audit/CAT4/E33_E35_E36_E57_E16_E46_E67_E69_E70_THIN_GUNS_DOSSIER.md` | 3 |  |
| `docs/ecosystems/defined/E70_COMPLIANCE_MASTER_PURPOSE_2026-06-21.md` | 6 |  |
| `docs/ecosystems/defined/E70_POST_EDITOR_PURPOSE_2026-06-21.md` | 6 |  |
| `docs/ecosystems/missing/E70_MISSING.md` | 1 |  |

## OTHER (1)

| Part | KB | Grade |
|---|---:|---|
| `STRANDED_RESCUE_2026-05-23/E70_ECOSYSTEM_SEARCH_SPEC.md` | 13 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
