# E34 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 13  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 3 | the shelf — stocked, in-lane |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 2 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 2 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E34/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (3)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E34/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E34/code/ecosystem_34_events.py` | 28 |  |
| `ECO_CANONICAL/E34/code/ecosystem_34_events_complete.py` | 27 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E34/E34_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E34_EVENTS.docx` | 33 |  |

## ORPHAN (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E34/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/JAY_FAISON_SPEAKER_INTRODUCTION_STRATEGY.md` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E34/NONDEPLOYED_ORPHANS/README.md` | 2 |  |

## DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E34_SEQUENTIAL_LIBRARY_INDEX.md` | 23 |  |
| `docs/handoffs/frontend/E34_Events.md` | 5 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E34_EVENTS.docx` | 33 |  |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E34_Events.md` | 5 |  |
| `ECOSYSTEM_REPORTS/E34_EVENTS.docx` | 33 |  |
| `audit/2026-05-08/cellular/E34.json` | 7 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
