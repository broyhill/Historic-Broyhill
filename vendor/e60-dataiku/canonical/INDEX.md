# E60 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 78  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 13 | the shelf — stocked, in-lane |
| **LIVE CODE** | 1 | deployed / runnable |
| **MIGRATION** | 3 | SQL under database/ |
| **LANE DOC** | 8 | lane documentation |
| **ORPHAN** | 9 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 13 | canonical & architecture docs |
| **ARCHIVE** | 11 | reference only — never install from here |
| **OTHER** | 20 | unclassified |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E60/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (13)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E60/ECO_MODEL.md` | 3 |  |
| `ECO_CANONICAL/E60/code/__init__.py` | 1 |  |
| `ECO_CANONICAL/E60/code/broyhillgop_lp_model.py` | 99 |  |
| `ECO_CANONICAL/E60/code/cost_ledger.py` | 6 |  |
| `ECO_CANONICAL/E60/code/iftt_engine.py` | 8 |  |
| `ECO_CANONICAL/E60/code/ml_optimizer.py` | 9 |  |
| `ECO_CANONICAL/E60/sql/200_e60_nervous_net.sql` | 6 |  |
| `ECO_CANONICAL/E60/sql/E60_ddl.sql` | 11 |  |
| `ECO_CANONICAL/E60/sql/E60_poll_survey_intelligence_registry.sql` | 2 |  |
| `ECO_CANONICAL/E60/tests/test_e60_cost_ledger_idempotency.py` | 3 |  |
| `ECO_CANONICAL/E60/tests/test_e60_lp_problem_well_formed.py` | 4 |  |
| `ECO_CANONICAL/E60/tests/test_e60_pentad_contract.py` | 4 |  |
| `ECO_CANONICAL/E60/tests/test_e60_rule_firing.py` | 5 |  |

## LIVE CODE (1)

| Part | KB | Grade |
|---|---:|---|
| `ecosystems/e60/E60_SPLIT_ASSIGNMENT_2026-07-01.md` | 1 |  |

## MIGRATION (3)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/200_e60_nervous_net.sql` | 6 |  |
| `database/migrations/dryrun/DRYRUN_LP_ENGAGEMENT_QUEUE_INGEST_2026-06-13.sql` | 7 | `AMBER` |
| `database/migrations/dryrun/P0_TRACE_SEED_2026-06-20.sql` | 3 | `AMBER` |

## LANE DOC (8)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/DIAMOND_VAULT_LIBRARY/docs/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE_ORIGINAL_MAR2026.docx` | 47 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/ACTIVEDEMAND_CDP_ADI_GAP_BRIEF_v1_2026-05-26.md` | 27 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/ACTIVEDEMAND_TO_BROYHILLGOP_ECOSYSTEM_MAP_2026-05-26.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/E60_SPECIFICATION.md` | 4 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/SECTION_8_E60_NERVOUS_NET_DESIGN.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 27 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E60_POLL_SURVEY_INTELLIGENCE.docx` | 35 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/LOST ECOSYSTEMS/AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/@DOCS/god E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 47 |  |

## ORPHAN (9)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/CLAUDE_HANDOFF_2026-05-15.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE_ORIGINAL_MAR2026.docx` | 47 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/DIAMOND_VAULT/broyhillgop_lp_model.py` | 99 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 27 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/INDEX.md` | 12 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/INTELLIGENCE_BRAIN_MATHEMATICAL_DECISION_FRAMEWORK.md` | 22 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/NEXUS_E60_LOSTFOUND_TRACE_2026-06-13.md` | 5 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/THOMPSON_BANDIT_EXECUTION_SPEC_2026-06-20.md` | 14 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/UNIFIED_13_FACTION_SYSTEM.md` | 36 |  |

## DOC (13)

| Part | KB | Grade |
|---|---:|---|
| `docs/@DOCS/god E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE 2.docx` | 47 |  |
| `docs/architecture/SECTION_8_E60_NERVOUS_NET_DESIGN.md` | 12 |  |
| `docs/audits/deep87/DEEP_RESEARCH_BATCH5_E60_E74_2026-07-23.md` | 8 |  |
| `docs/canonical/E11_VS_E60_MONEY_LAYERS_2026-07-01.md` | 5 |  |
| `docs/canonical/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE_CANONICAL_2026-07-01.md` | 12 |  |
| `docs/canonical/E60_CANONICAL_SPEC_v1_2026-06-29.md` | 10 |  |
| `docs/canonical/E60_E61_E72_SPLIT_RULING_2026-07-01.md` | 3 |  |
| `docs/canonical/E60_LOCKED_IDENTITY_DATAIKU_CLASS_2026-07-26.md` | 9 |  |
| `docs/canonical/E60_MERGE_READINESS_REPORT_2026-07-01.md` | 6 |  |
| `docs/canonical/E60_SEQUENTIAL_LIBRARY_INDEX.md` | 18 |  |
| `docs/canonical/grand-audit/CAT3/E60_E72_E73_E79_DECISION_ENGINES_DOSSIER.md` | 4 |  |
| `docs/god E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE 2.docx` | 37 |  |
| `docs/god E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 37 |  |

## ARCHIVE (11)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 27 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/ECOSYSTEM_REPORTS/GAP_E60.md` | 4 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/E60_POLL_SURVEY_INTELLIGENCE.docx` | 35 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/claude-ed/ECOSYSTEM_REPORTS/GAP_E60.md` | 4 |  |
| `AGENT_BOOT/recovery/CENTRAL_MIRROR_2026-07-12/docs/@DOCS/god E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE.docx` | 47 |  |
| `archive/diamonds/E60_ADDICTION_PSYCHOLOGY_ENGAGEMENT_ENGINE_ORIGINAL_MAR2026.docx` | 47 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/200_e60_nervous_net.sql` | 6 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/dryrun/P0_TRACE_SEED_2026-06-20.sql` | 2 | `AMBER` |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/E60_ddl.sql` | 11 |  |
| `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/migrations/E60_poll_survey_intelligence_registry.sql` | 2 |  |
| `archive/recovered/2026-07-01/e61-e60-e72-split-reality/RAW_PASTED_TEXT_E61_E60_E72_SPLIT_REALITY_2026-07-01.txt` | 6 |  |

## OTHER (20)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/DATAIKU_ML_RECOVERY/FROM_UNMERGED_PR304/E60_LOCKED_IDENTITY_DATAIKU_CLASS_2026-07-26.md` | 9 |  |
| `AGENT_BOOT/NEXUS-Perplexity Session Files/E60_CANONICAL_SPEC_v1_2026-06-29.md` | 10 |  |
| `AGENT_BOOT/Nexus Lost and Find/2026-06-13_e60-lostfound/NEXUS_E60_LOSTFOUND_TRACE_2026-06-13.md` | 5 |  |
| `ECOSYSTEM_REPORTS/E60_POLL_SURVEY_INTELLIGENCE.docx` | 35 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/docs/architecture/SECTION_8_E60_NERVOUS_NET_DESIGN.md` | 12 |  |
| `STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e60_rule_firing.py` | 5 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/database/migrations/200_e60_nervous_net.sql` | 6 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/docs/architecture/SECTION_8_E60_NERVOUS_NET_DESIGN.md` | 12 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_cost_ledger_idempotency.py` | 3 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_lp_problem_well_formed.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_pentad_contract.py` | 4 |  |
| `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_rule_firing.py` | 5 |  |
| `audit/2026-05-08/cellular/E60.json` | 5 |  |
| `migrations/E60_ddl.sql` | 11 |  |
| `migrations/E60_poll_survey_intelligence_registry.sql` | 2 |  |
| `nexus-claude-cursor/NEXUS_E60_LOSTFOUND_TRACE_2026-06-13.md` | 5 |  |
| `tests/test_e60_cost_ledger_idempotency.py` | 3 |  |
| `tests/test_e60_lp_problem_well_formed.py` | 4 |  |
| `tests/test_e60_pentad_contract.py` | 4 |  |
| `tests/test_e60_rule_firing.py` | 5 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
