# E33 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 16  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 3 | the shelf — stocked, in-lane |
| **LIVE CODE** | 1 | deployed / runnable |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 3 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 2 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E33/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (3)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E33/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E33/code/ecosystem_33_direct_mail.py` | 43 |  |
| `ECO_CANONICAL/E33/code/ecosystem_33_direct_mail_complete.py` | 42 |  |

## LIVE CODE (1)

| Part | KB | Grade |
|---|---:|---|
| `ecosystems/E19_social/bio/e33_integration.py` | 6 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E33/E33_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E33_DIRECT_MAIL.docx` | 36 |  |

## ORPHAN (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E33/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/40_SEGMENT_CUSTOMIZED_TEMPLATES.md` | 28 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E33/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_ECOSYSTEM_MASTER_REVIEW.md` | 54 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E33/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E33_SEQUENTIAL_LIBRARY_INDEX.md` | 14 |  |
| `docs/canonical/grand-audit/CAT4/E33_E35_E36_E57_E16_E46_E67_E69_E70_THIN_GUNS_DOSSIER.md` | 3 |  |

## ARCHIVE (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E33_DIRECT_MAIL.docx` | 36 |  |
| `archive/recovered/2026-06-27/nexus/broyhillgop 2/ecosystems/E19_social/bio/e33_integration.py` | 6 |  |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E33_DIRECT_MAIL_SEAM_2026-07-10.md` | 22 |  |
| `ECOSYSTEM_REPORTS/E33_DIRECT_MAIL.docx` | 36 |  |
| `audit/2026-05-08/cellular/E33.json` | 8 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
