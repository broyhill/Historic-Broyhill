# E19 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 130  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 42 | the shelf — stocked, in-lane |
| **LIVE CODE** | 2 | deployed / runnable |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 4 | lane documentation |
| **ORPHAN** | 3 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 6 | canonical & architecture docs |
| **ARCHIVE** | 9 | reference only — never install from here |
| **OTHER** | 63 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E19/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (42)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E19/ECO_MODEL.md` | 5 |  |
| `ECO_CANONICAL/E19/code/_e19_contracts.py` | 4 |  |
| `ECO_CANONICAL/E19/code/bio_renderer.py` | 8 |  |
| `ECO_CANONICAL/E19/code/click_attribution_worker.py` | 6 |  |
| `ECO_CANONICAL/E19/code/e33_integration.py` | 6 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_audience_builder.py` | 11 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_content_optimizer.py` | 18 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_funnel_sequencer.py` | 14 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_listening_inbox.py` | 12 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_news_trigger.py` | 8 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_personalization_engine.py` | 29 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_social_media.py` | 105 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_social_media_enhanced.py` | 37 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_social_media_integration_patch.py` | 40 |  |
| `ECO_CANONICAL/E19/code/ecosystem_19_social_media_manager.py` | 30 |  |
| `ECO_CANONICAL/E19/code/geo_ip.py` | 4 |  |
| `ECO_CANONICAL/E19/code/qr_generator.py` | 5 |  |
| `ECO_CANONICAL/E19/code/response_router.py` | 14 |  |
| `ECO_CANONICAL/E19/code/routes.py` | 5 |  |
| `ECO_CANONICAL/E19/code/webhook_handler.py` | 6 |  |
| `ECO_CANONICAL/E19/frontend/bio_page.html` | 6 |  |
| `ECO_CANONICAL/E19/sql/001_E19_social_bio.sql` | 10 |  |
| `ECO_CANONICAL/E19/sql/002_E19_social_dm.sql` | 9 |  |
| `ECO_CANONICAL/E19/sql/005_E19_social_funnel.sql` | 9 |  |
| `ECO_CANONICAL/E19/sql/2026-05-03_e19_social_schema.sql` | 11 |  |
| `ECO_CANONICAL/E19/sql/ECOSYSTEM_19_SOCIAL_MEDIA_SCHEMA 3.sql` | 20 |  |
| `ECO_CANONICAL/E19/sql/e19_integration_schema.sql` | 7 |  |
| `ECO_CANONICAL/E19/sql/ecosystem_19_DEPLOY_ALL.sql` | 3 |  |
| `ECO_CANONICAL/E19/tests/test_e19_ai_disclosure.py` | 2 |  |
| `ECO_CANONICAL/E19/tests/test_e19_audience_builder.py` | 4 |  |
| `ECO_CANONICAL/E19/tests/test_e19_compliance_gates.py` | 3 |  |
| `ECO_CANONICAL/E19/tests/test_e19_content_optimizer.py` | 4 |  |
| `ECO_CANONICAL/E19/tests/test_e19_funnel_sequencer.py` | 4 |  |
| `ECO_CANONICAL/E19/tests/test_e19_funnel_stage_gate.py` | 3 |  |
| `ECO_CANONICAL/E19/tests/test_e19_listening_inbox.py` | 6 |  |
| `ECO_CANONICAL/E19/tests/test_e19_match_tier_gate.py` | 2 |  |
| `ECO_CANONICAL/E19/tests/test_e19_meta_24h_window.py` | 2 |  |
| `ECO_CANONICAL/E19/tests/test_e19_news_trigger.py` | 4 |  |
| `ECO_CANONICAL/E19/tests/test_e19_no_fake_accounts.py` | 4 |  |
| `ECO_CANONICAL/E19/tests/test_e19_paid_disclosure.py` | 2 |  |
| `ECO_CANONICAL/E19/tests/test_e19_pentad_contract.py` | 5 |  |
| `ECO_CANONICAL/E19/tests/test_e19_social_media.py` | 8 |  |

## LIVE CODE (2)

| Part | KB | Grade |
|---|---:|---|
| `backend/python/ecosystems/_e19_contracts.py` | 4 |  |
| `ecosystems/_e19_contracts.py` | 4 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/e19_integration_schema.sql` | 7 |  |

## LANE DOC (4)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E19/E19_FUNNEL_STAGES.md` | 10 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E19/E19_SPECIFICATION.md` | 1 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E19/SECTION_3_E19_SOCIAL_MEDIA_DESIGN.md` | 7 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E19_SOCIAL_MEDIA.docx` | 17 |  |

## ORPHAN (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E19/NONDEPLOYED_ORPHANS/CHERRY_PICK_SEQUENCE.md` | 4 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E19/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/ECOSYSTEM_03_MARKETING_AUTOMATION_SOCIAL.py` | 32 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E19/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/ECOSYSTEM_38_SOCIAL_MEDIA_ARSENAL.py` | 29 |  |

## DOC (6)

| Part | KB | Grade |
|---|---:|---|
| `docs/architecture/E19_FUNNEL_STAGES.md` | 10 |  |
| `docs/architecture/SECTION_3_E19_SOCIAL_MEDIA_DESIGN.md` | 7 |  |
| `docs/canonical/E19_SEQUENTIAL_LIBRARY_INDEX.md` | 17 |  |
| `docs/decisions/2026-05-03_E19_stealth_machine.md` | 10 |  |
| `docs/ecosystems/E19_social.md` | 18 |  |
| `docs/ecosystems/missing/E19_MISSING.md` | 1 |  |

## ARCHIVE (9)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E19_SOCIAL_MEDIA.docx` | 17 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/e19_integration_schema.sql` | 7 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/001_E19_social_bio.sql` | 10 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/002_E19_social_dm.sql` | 9 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/005_E19_social_funnel.sql` | 9 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/2026-05-03_e19_social_schema.sql` | 11 |  |
| `archive/recovered/2026-06-27/nexus/broyhillgop 2/migrations/001_E19_social_bio.sql` | 10 |  |
| `archive/recovered/2026-06-27/nexus/broyhillgop 2/migrations/002_E19_social_dm.sql` | 9 |  |
| `archive/recovered/2026-06-27/nexus/broyhillgop 2/migrations/005_E19_social_funnel.sql` | 9 |  |

## OTHER (63)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E19_SOCIAL_SEAM_2026-07-10.md` | 20 |  |
| `ECOSYSTEM_REPORTS/E19_SOCIAL_MEDIA.docx` | 17 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/architecture/SECTION_3_E19_SOCIAL_MEDIA_DESIGN.md` | 7 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/decisions/2026-05-03_E19_stealth_machine.md` | 10 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/ecosystems/E19_social.md` | 18 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/ecosystems/_e19_contracts.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/migrations/2026-05-03_e19_social_schema.sql` | 11 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_ai_disclosure.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_audience_builder.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_compliance_gates.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_content_optimizer.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_funnel_sequencer.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_funnel_stage_gate.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_listening_inbox.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_match_tier_gate.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_meta_24h_window.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_news_trigger.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_no_fake_accounts.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_paid_disclosure.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e19_social_media.py` | 8 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/backend/python/ecosystems/_e19_contracts.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/E19_FUNNEL_STAGES.md` | 10 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/SECTION_3_E19_SOCIAL_MEDIA_DESIGN.md` | 7 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/decisions/2026-05-03_E19_stealth_machine.md` | 10 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/ecosystems/E19_social.md` | 18 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/ecosystems/_e19_contracts.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/migrations/2026-05-03_e19_social_schema.sql` | 11 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_ai_disclosure.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_audience_builder.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_compliance_gates.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_content_optimizer.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_funnel_sequencer.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_funnel_stage_gate.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_listening_inbox.py` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_match_tier_gate.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_meta_24h_window.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_news_trigger.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_no_fake_accounts.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_paid_disclosure.py` | 2 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_pentad_contract.py` | 5 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e19_social_media.py` | 8 |  |
| `audit/2026-05-08/cellular/E19.json` | 14 |  |
| `migrations/001_E19_social_bio.sql` | 10 |  |
| `migrations/002_E19_social_dm.sql` | 9 |  |
| `migrations/005_E19_social_funnel.sql` | 9 |  |
| `migrations/2026-05-03_e19_social_schema.sql` | 11 |  |
| `nexus-claude-cursor/ED_AUTH_E19_BIO_STEP1_2026-06-13.md` | 1 |  |
| `nexus-claude-cursor/NEXUS_DISPATCH_E19_SOCIAL_MERGE_2026-06-13.md` | 5 |  |
| `nexus-claude-cursor/NEXUS_TO_CURSOR_E19_LOSTFOUND_EXECUTE_2026-06-13.md` | 4 |  |
| `tests/test_e19_ai_disclosure.py` | 2 |  |
| `tests/test_e19_audience_builder.py` | 4 |  |
| `tests/test_e19_compliance_gates.py` | 3 |  |
| `tests/test_e19_content_optimizer.py` | 4 |  |
| `tests/test_e19_funnel_sequencer.py` | 4 |  |
| `tests/test_e19_funnel_stage_gate.py` | 3 |  |
| `tests/test_e19_listening_inbox.py` | 6 |  |
| `tests/test_e19_match_tier_gate.py` | 2 |  |
| `tests/test_e19_meta_24h_window.py` | 2 |  |
| `tests/test_e19_news_trigger.py` | 4 |  |
| `tests/test_e19_no_fake_accounts.py` | 4 |  |
| `tests/test_e19_paid_disclosure.py` | 2 |  |
| `tests/test_e19_pentad_contract.py` | 5 |  |
| `tests/test_e19_social_media.py` | 8 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
