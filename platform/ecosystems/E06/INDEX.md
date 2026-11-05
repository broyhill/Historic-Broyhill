# E06 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 16  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 3 | the shelf — stocked, in-lane |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 3 | canonical & architecture docs |
| **ARCHIVE** | 4 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E06/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (3)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E06/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E06/code/ecosystem_06_analytics_engine.py` | 47 |  |
| `ECO_CANONICAL/E06/code/ecosystem_06_analytics_engine_complete.py` | 46 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E06/E06_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE 2.docx` | 16 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E06/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E06_SEQUENTIAL_LIBRARY_INDEX.md` | 14 |  |
| `docs/canonical/grand-audit/CAT2/E01_E06_DONOR_INTEL_ANALYTICS_DOSSIER.md` | 2 |  |
| `docs/ecosystems/missing/E06_MISSING.md` | 1 |  |

## ARCHIVE (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE 2.docx` | 16 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE.docx` | 16 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/database/migrations/dryrun/2026-06-24_phase4_dtm_4digit_reconcile.sql` | 8 | `AMBER` |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/database/migrations/dryrun/309_wizard_district_tag_matrix.sql` | 5 | `AMBER` |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE 2.docx` | 16 |  |
| `ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE.docx` | 16 |  |
| `audit/2026-05-08/cellular/E06.json` | 9 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
