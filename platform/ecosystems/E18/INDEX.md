# E18 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 15  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 5 | the shelf — stocked, in-lane |
| **LANE DOC** | 1 | lane documentation |
| **ORPHAN** | 3 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 2 | reference only — never install from here |
| **OTHER** | 2 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E18/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (5)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E18/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E18/code/ecosystem_18_print_advertising.py` | 35 |  |
| `ECO_CANONICAL/E18/code/ecosystem_18_print_advertising_complete.py` | 34 |  |
| `ECO_CANONICAL/E18/code/ecosystem_18_vdp_composition_engine.py` | 38 |  |
| `ECO_CANONICAL/E18/code/ecosystem_18_vdp_composition_engine_complete.py` | 37 |  |

## LANE DOC (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E18/E18_SPECIFICATION.md` | 1 |  |

## ORPHAN (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E18/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/40_SEGMENT_CUSTOMIZED_TEMPLATES.md` | 28 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E18/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_ECOSYSTEM_MASTER_REVIEW.md` | 54 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E18/NONDEPLOYED_ORPHANS/INTELLIGENCE_BRAIN_OVERLAP_ANALYSIS.md` | 10 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E18_SEQUENTIAL_LIBRARY_INDEX.md` | 17 |  |
| `docs/ecosystems/missing/E18_MISSING.md` | 1 |  |

## ARCHIVE (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E18/E18_MISSING.md` | 1 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/hunted_specs/E18/E18_VARIABLE_DATA_PRINTING_manual_controls.md` | 23 |  |

## OTHER (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Session Files/2026-07-19-20_ten-ecosystem-masterpiece/E18-Collision-Resolution--DRAFT-Nexus.md` | 17 |  |
| `audit/2026-05-08/cellular/E18.json` | 7 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
