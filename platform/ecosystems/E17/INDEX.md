# E17 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 31  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 12 | the shelf — stocked, in-lane |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 2 | lane documentation |
| **ORPHAN** | 8 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 4 | canonical & architecture docs |
| **ARCHIVE** | 1 | reference only — never install from here |
| **OTHER** | 3 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E17/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (12)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E17/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E17/code/ecosystem_17_rvm.py` | 52 |  |
| `ECO_CANONICAL/E17/code/ecosystem_17_rvm_complete.py` | 51 |  |
| `ECO_CANONICAL/E17/code/ecosystem_17_rvm_gateway.py` | 8 |  |
| `ECO_CANONICAL/E17/sql/E17_RVM_SCHEMA_V1_2026-07-07.sql` | 17 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_ai_processing_jobs_updated_at.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_ai_script_generator_updated_at.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_ai_voice_profiles_updated_at.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_ivr_menus_timestamp.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_rsvp_registrations_timestamp.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_voice_library_updated_at.sql` | 0 |  |
| `ECO_CANONICAL/E17/sql/supabase_recovered/update_e17_volunteer_signups_timestamp.sql` | 0 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/dryrun/E17_RVM_SCHEMA_V1_2026-07-07.sql` | 17 | `GREEN` |

## LANE DOC (2)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E17/E17_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E17_RINGLESS_VOICEMAIL.docx` | 35 |  |

## ORPHAN (8)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/EXECUTIVE_HANDOFF_RVM_COMPLETE.md` | 26 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/RVM_IVR_RESPONSE_PROCESSING_COMPLETE.md` | 79 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/RVM_PLATFORM_COMPLETE_ARCHITECTURE.md` | 62 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/RVM_PRODUCTION_DEPLOYMENT_COMPLETE.md` | 21 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/RVM_SYSTEM_FINAL_COMPONENTS.md` | 55 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/README.md` | 2 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/RVM_PLATFORM_COMPLETE_ARCHITECTURE.md` | 62 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E17/NONDEPLOYED_ORPHANS/RVM_SYSTEM_FINAL_COMPONENTS.md` | 55 |  |

## DOC (4)

| Part | KB | Grade |
|---|---:|---|
| `docs/canonical/E17_RVM_ECOSYSTEM_BUILD_2026-07-07.md` | 13 |  |
| `docs/canonical/E17_SEQUENTIAL_LIBRARY_INDEX.md` | 16 |  |
| `docs/canonical/grand-audit/CAT4/E30_E31_E32_E17_BUILT_GUNS_DOSSIER.md` | 4 |  |
| `docs/ecosystems/missing/E17_MISSING.md` | 1 |  |

## ARCHIVE (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E17_RINGLESS_VOICEMAIL.docx` | 35 |  |

## OTHER (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E17_RVM_SEAM_2026-07-10.md` | 21 |  |
| `ECOSYSTEM_REPORTS/E17_RINGLESS_VOICEMAIL.docx` | 35 |  |
| `audit/2026-05-08/cellular/E17.json` | 9 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
