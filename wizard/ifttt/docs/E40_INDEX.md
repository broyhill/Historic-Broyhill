# E40 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 19  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 8 | the shelf — stocked, in-lane |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 1 | canonical & architecture docs |
| **ARCHIVE** | 3 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E40/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (8)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E40/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E40/code/ecosystem_40_automation_control_panel.py` | 110 |  |
| `ECO_CANONICAL/E40/code/ecosystem_40_automation_control_panel_complete.py` | 108 |  |
| `ECO_CANONICAL/E40/frontend/1766013160623_ecosystem_40_admin_dashboard 2.html` | 38 |  |
| `ECO_CANONICAL/E40/frontend/1766013160623_ecosystem_40_admin_dashboard.html` | 38 |  |
| `ECO_CANONICAL/E40/frontend/ecosystem_40_admin_dashboard 2.html` | 38 |  |
| `ECO_CANONICAL/E40/frontend/ecosystem_40_admin_dashboard.html` | 38 |  |
| `ECO_CANONICAL/E40/sql/2026-06-09_brain_triggers_load_e40_catalog.sql` | 21 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/2026-06-09_brain_triggers_load_e40_catalog.sql` | 21 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E40/E40_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E40_AUTOMATION_CONTROL 2.docx` | 29 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E40/NONDEPLOYED_ORPHANS/BroyhillGOP — Master Session Transcript.md` | 48 |  |

## DOC (1)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E40_SEQUENTIAL_LIBRARY_INDEX.md` | 26 |  |

## ARCHIVE (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E40_AUTOMATION_CONTROL 2.docx` | 29 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E40_AUTOMATION_CONTROL.docx` | 29 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/2026-06-09_brain_triggers_load_e40_catalog.sql` | 21 |  |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `ECOSYSTEM_REPORTS/E40_AUTOMATION_CONTROL 2.docx` | 29 |  |
| `ECOSYSTEM_REPORTS/E40_AUTOMATION_CONTROL.docx` | 29 |  |
| `audit/2026-05-08/cellular/E40.json` | 8 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
