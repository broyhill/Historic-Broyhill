# E36 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 23  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 8 | the shelf — stocked, in-lane |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 4 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 3 | canonical & architecture docs |
| **ARCHIVE** | 2 | reference only — never install from here |
| **OTHER** | 4 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E36/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (8)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E36/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E36/code/ecosystem_36_messenger_integration.py` | 39 |  |
| `ECO_CANONICAL/E36/code/ecosystem_36_messenger_integration_complete.py` | 52 |  |
| `ECO_CANONICAL/E36/code/meta_ingest.py` | 6 |  |
| `ECO_CANONICAL/E36/code/triage_engine.py` | 8 |  |
| `ECO_CANONICAL/E36/sql/003_E36_unified_inbox_extension.sql` | 7 |  |
| `ECO_CANONICAL/E36/sql/ECOSYSTEM_36_MESSENGER_INTEGRATION_SCHEMA.sql` | 30 |  |
| `ECO_CANONICAL/E36/sql/ecosystem_36_messenger_integration_complete.sql` | 30 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E36/E36_SPECIFICATION.md` | 3 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E36_MESSENGER.docx` | 40 |  |

## ORPHAN (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E36/NONDEPLOYED_ORPHANS/003_E36_unified_inbox_extension.sql` | 7 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E36/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/ecosystem_36_messenger_integration_complete.py` | 39 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E36/NONDEPLOYED_ORPHANS/README.md` | 2 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E36/NONDEPLOYED_ORPHANS/spec.md` | 5 |  |

## DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E36_SEQUENTIAL_LIBRARY_INDEX.md` | 24 |  |
| `docs/canonical/grand-audit/CAT4/E33_E35_E36_E57_E16_E46_E67_E69_E70_THIN_GUNS_DOSSIER.md` | 3 |  |
| `docs/ecosystems/E36_UNIFIED_MESSAGING_INTEGRATION_NOTE_2026-07-02.md` | 5 |  |

## ARCHIVE (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E36_MESSENGER.docx` | 40 |  |
| `archive/recovered/2026-06-27/nexus/broyhillgop 2/migrations/003_E36_unified_inbox_extension.sql` | 7 |  |

## OTHER (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E36_UNIFIED_MESSAGING_APPLY_2026-07-02.md` | 4 |  |
| `ECOSYSTEM_REPORTS/E36_MESSENGER.docx` | 40 |  |
| `audit/2026-05-08/cellular/E36.json` | 10 |  |
| `nexus-claude-cursor/CLAUDE_E36_UNIFIED_MESSAGING_BUILD_GUARDRAILS_2026-07-02.md` | 2 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
