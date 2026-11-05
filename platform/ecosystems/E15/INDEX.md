# E15 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 18  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 4 | the shelf — stocked, in-lane |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 5 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 5 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E15/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (4)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E15/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E15/code/ecosystem_15_contact_directory.py` | 29 |  |
| `ECO_CANONICAL/E15/code/ecosystem_15_contact_directory_complete.py` | 28 |  |
| `ECO_CANONICAL/E15/frontend/contact-directory-onboarding.html` | 65 |  |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E15/E15_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E15_CONTACT_MANAGEMENT.docx` | 29 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E15/NONDEPLOYED_ORPHANS/DECEMBER_ARCHIVE_LOCATIONS_2026-06-09.txt` | 24 |  |

## DOC (5)

| Part | KB | Grade |
|---|---:|---|
| `docs/audits/deep87/DEEP_RESEARCH_BATCH2_E15_E29_2026-07-23.md` | 10 |  |
| `docs/canonical/E15_SEQUENTIAL_LIBRARY_INDEX.md` | 16 |  |
| `docs/canonical/grand-audit/CAT1/E15_E52_CONTACTS_DOSSIER.md` | 2 |  |
| `docs/ecosystems/missing/E15_MISSING.md` | 1 |  |
| `docs/handoffs/frontend/E15_Contact_Directory.md` | 4 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E15_CONTACT_MANAGEMENT.docx` | 29 |  |

## OTHER (5)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E15_Contact_Directory.md` | 4 |  |
| `ECOSYSTEM_BLUEPRINTS/E15_CONTACT_DIRECTORY_CLONE_BLUEPRINT.md` | 81 |  |
| `ECOSYSTEM_REPORTS/E15_CONTACT_MANAGEMENT.docx` | 29 |  |
| `audit/2026-05-08/cellular/E15.json` | 9 |  |
| `sessions/2026-05-09_E15_COMPETITOR_RESEARCH.md` | 53 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
