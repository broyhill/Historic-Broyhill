# E31 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 74  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 27 | the shelf — stocked, in-lane |
| **MIGRATION** | 2 | SQL under database/ |
| **LANE DOC** | 9 | lane documentation |
| **ORPHAN** | 8 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 7 | canonical & architecture docs |
| **ARCHIVE** | 5 | reference only — never install from here |
| **OTHER** | 16 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E31/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (27)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E31/ECO_MODEL.md` | 3 |  |
| `ECO_CANONICAL/E31/code/__init__.py` | 3 |  |
| `ECO_CANONICAL/E31/code/ai_composer.py` | 12 |  |
| `ECO_CANONICAL/E31/code/ai_journeys.py` | 14 |  |
| `ECO_CANONICAL/E31/code/analytics.py` | 13 |  |
| `ECO_CANONICAL/E31/code/campaigns.py` | 8 |  |
| `ECO_CANONICAL/E31/code/config.py` | 5 |  |
| `ECO_CANONICAL/E31/code/consent.py` | 10 |  |
| `ECO_CANONICAL/E31/code/conversations.py` | 10 |  |
| `ECO_CANONICAL/E31/code/cost_ledger.py` | 5 |  |
| `ECO_CANONICAL/E31/code/drip_sequences.py` | 8 |  |
| `ECO_CANONICAL/E31/code/e31_twilio_webhook.py` | 11 |  |
| `ECO_CANONICAL/E31/code/ecosystem_31_sms.py` | 63 |  |
| `ECO_CANONICAL/E31/code/ecosystem_31_sms_complete.py` | 31 |  |
| `ECO_CANONICAL/E31/code/ecosystem_31_sms_enhanced.py` | 43 |  |
| `ECO_CANONICAL/E31/code/entities.py` | 6 |  |
| `ECO_CANONICAL/E31/code/number_pool.py` | 6 |  |
| `ECO_CANONICAL/E31/code/phone_registry.py` | 7 |  |
| `ECO_CANONICAL/E31/code/providers.py` | 23 |  |
| `ECO_CANONICAL/E31/code/send_engine.py` | 12 |  |
| `ECO_CANONICAL/E31/code/shortlinks.py` | 6 |  |
| `ECO_CANONICAL/E31/code/webhooks.py` | 6 |  |
| `ECO_CANONICAL/E31/sql/201_e31_sms_enterprise_schema.sql` | 18 |  |
| `ECO_CANONICAL/E31/sql/2026-07-05_DRYRUN_E31_SMS_MMS_ENTERPRISE.sql` | 20 | `RED` |
| `ECO_CANONICAL/E31/tests/ab_testing.py` | 7 |  |
| `ECO_CANONICAL/E31/tests/test_e31_consent.py` | 6 |  |
| `ECO_CANONICAL/E31/tests/test_e31_shortlink.py` | 4 |  |

## MIGRATION (2)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/201_e31_sms_enterprise_schema.sql` | 18 |  |
| `database/migrations/dryrun/2026-07-05_DRYRUN_E31_SMS_MMS_ENTERPRISE.sql` | 20 | `DUPE` → `2026-07-05_DRYRUN_E31_SMS_MMS_ENTERPRISE.sql` |

## LANE DOC (9)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E31/E31_SPECIFICATION.md` | 2 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/SECTION_4_E31_SMS_DESIGN.md` | 8 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/00_E31_COMPLETE_AUDIT_2026-06-07.md` | 26 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/02_E31_BRAND_INVENTORY_TWILIO.md` | 3 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/04_E31_BRAND_INVENTORY_TATANGO.md` | 3 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/07_E31_BRAND_INVENTORY_POSTSCRIPT.md` | 4 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/13_E31_BUILD_BRIEFS/CURSOR_BRIEF_E31_SEARCH_FIX.md` | 6 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E31_SMS_MARKETING.docx` | 23 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E31_PHONE_SUPPRESS_PROOF_cursor_v1.md` | 2 |  |

## ORPHAN (8)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/AI_POWERED_INTELLIGENT_TEXTING_PLATFORM_COMPLETE.md` | 74 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/DONOR_VOLUNTEER_TEXT_TEMPLATE_LIBRARY.md` | 27 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/OPEN_SOURCE_P2P_TEXTING_PLATFORM_ARCHITECTURE.md` | 46 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/TEXTING_PLATFORM_GAP_ANALYSIS.md` | 26 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/VIDEO_SMS_MMS_INTEGRATION_ARCHITECTURE.md` | 37 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31/NONDEPLOYED_ORPHANS/TRIGGER_ACTION_HANDLER_MAP_2026-07-09.md` | 60 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/NONDEPLOYED_ORPHANS/201_e31_sms_enterprise_schema.sql` | 18 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/NONDEPLOYED_ORPHANS/2026-07-09_BRAIN_E31_PHONE_SUPPRESS_PROOF_cursor_v1.md` | 2 |  |

## DOC (7)

| Part | KB | Grade |
|---|---:|---|
| `docs/architecture/SECTION_4_E31_SMS_DESIGN.md` | 8 |  |
| `docs/canonical/E31_SEQUENTIAL_LIBRARY_INDEX.md` | 19 |  |
| `docs/canonical/grand-audit/CAT4/E30_E31_E32_E17_BUILT_GUNS_DOSSIER.md` | 4 |  |
| `docs/ecosystems/missing/E31_MISSING.md` | 1 |  |
| `docs/handoffs/E31_COMPLETION_STATUS_2026-06-05.md` | 6 |  |
| `docs/handoffs/E31_TWILIO_SMS_LISTENER_SPEC_2026-06-20.md` | 10 |  |
| `docs/handoffs/frontend/E31_SMS_System.md` | 4 |  |

## ARCHIVE (5)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/PURGE_RECOVERY_fb908ab5_2026-07-11/files/AGENT_BOOT/NEXUS-Perplexity Session Files/SESSION_TRANSCRIPT_2026-06-07_NEXUS_battle-doctrine-E31-audit-brain-triggers-search-engine.md` | 18 |  |
| `AGENT_BOOT/SATELLITE_RECOVERY/nexus-platform/proposals/E31_SMS_ENTERPRISE_SPEC_2026-06-02.md` | 17 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E31_SMS_MARKETING.docx` | 23 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/audits/2026-07-09_BRAIN_E31_PHONE_SUPPRESS_PROOF_cursor_v1.md` | 2 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/201_e31_sms_enterprise_schema.sql` | 18 |  |

## OTHER (16)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Claude Session Files/CLAUDE_REPLY_E31_2026-06-05.md` | 2 |  |
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E31_SMS_MMS_DDL_2026-07-05.md` | 3 |  |
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E31_SMS_SEAM_2026-07-10.md` | 20 |  |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PLATFORM_RECONSTRUCTION/2026-06-28_nexus_separation_heatmap_stash/files/BroyhillGOP-CURSOR-codex-stage-a/docs/handoffs/frontend/E31_SMS_System.md` | 4 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/SESSION_TRANSCRIPT_2026-06-07_NEXUS_battle-doctrine-E31-audit-brain-triggers-search-engine.md` | 18 |  |
| `ECOSYSTEM_REPORTS/E31_SMS_MARKETING.docx` | 23 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/architecture/SECTION_4_E31_SMS_DESIGN.md` | 8 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e31_consent.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e31_shortlink.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/SECTION_4_E31_SMS_DESIGN.md` | 8 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e31_consent.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e31_shortlink.py` | 4 |  |
| `api/e31_twilio_webhook.py` | 11 |  |
| `audit/2026-05-08/cellular/E31.json` | 15 |  |
| `tests/test_e31_consent.py` | 6 |  |
| `tests/test_e31_shortlink.py` | 4 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
