# E08 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 19  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 3 | the shelf — stocked, in-lane |
| **LANE DOC** | 3 | lane documentation |
| **ORPHAN** | 3 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 4 | reference only — never install from here |
| **OTHER** | 4 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E08/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (3)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E08/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E08/code/ecosystem_08_communications_library.py` | 27 |  |
| `ECO_CANONICAL/E08/code/ecosystem_08_communications_library_complete.py` | 25 |  |

## LANE DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E08/E08_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/MD FILES/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |

## ORPHAN (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E08/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/COMPLETE_COMMUNICATION_FRAMEWORK_LIBRARY.md` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E08/NONDEPLOYED_ORPHANS/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E08/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E08_SEQUENTIAL_LIBRARY_INDEX.md` | 15 |  |
| `docs/ecosystems/missing/E08_MISSING.md` | 1 |  |

## ARCHIVE (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/PURGE_RECOVERY_fb908ab5_2026-07-11/files/AGENT_BOOT/NEXUS-Perplexity Session Files/E08_LIBRARY_WELD_SPEC_2026-06-07.md` | 15 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/MD FILES/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E08_COMMUNICATIONS_LIBRARY.docx` | 15 |  |

## OTHER (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Session Files/E08_LIBRARY_WELD_SPEC_2026-06-07.md` | 15 |  |
| `ECOSYSTEM_REPORTS/E08_COMMUNICATIONS_LIBRARY 2.docx` | 15 |  |
| `ECOSYSTEM_REPORTS/E08_COMMUNICATIONS_LIBRARY.docx` | 15 |  |
| `audit/2026-05-08/cellular/E08.json` | 6 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
