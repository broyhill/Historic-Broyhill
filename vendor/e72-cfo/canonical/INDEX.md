# E72 — PARTS INDEX

**Generated:** 2026-07-29 by Claude (PM). Regenerate from the tree; do not hand-edit.  
**Parts serving this lane:** 30  
**One copy, many tags.** A part that serves several lanes is listed in each and stored once. Nothing here was moved or duplicated to build this index.

| Zone | Parts | Meaning |
|---|---:|---|
| **CANONICAL** | 15 | the shelf — stocked, in-lane |
| **LIVE CODE** | 1 | deployed / runnable |
| **MIGRATION** | 1 | SQL under database/ |
| **LANE DOC** | 3 | lane documentation |
| **ORPHAN** | 1 | NONDEPLOYED_ORPHANS — status honest, not vetted |
| **DOC** | 7 | canonical & architecture docs |
| **ARCHIVE** | 2 | reference only — never install from here |

**Before writing a new migration or module for this lane, read this file.** Three Brain migrations were written on 06-13, 06-20 and 06-27 for the same tables because nobody could check.

**Entry rule.** Nothing enters `ECO_CANONICAL/E72/code|sql|tests` unless it is transaction-wrapped, idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified, and declares its rollback. Everything else stays where it is and is referenced, not installed.

## CANONICAL (15)

| Part | KB | Grade |
|---|---:|---|
| `ECO_CANONICAL/E72/ECO_MODEL.md` | 2 |  |
| `ECO_CANONICAL/E72/code/anomaly_detector.py` | 5 |  |
| `ECO_CANONICAL/E72/code/attribution_resolver.py` | 8 |  |
| `ECO_CANONICAL/E72/code/bayesian.py` | 7 |  |
| `ECO_CANONICAL/E72/code/brain_consumer.py` | 5 |  |
| `ECO_CANONICAL/E72/code/budget_optimizer.py` | 10 |  |
| `ECO_CANONICAL/E72/code/network_prior_recomputer.py` | 6 |  |
| `ECO_CANONICAL/E72/code/orchestrator.py` | 6 |  |
| `ECO_CANONICAL/E72/code/signal_emitter.py` | 7 |  |
| `ECO_CANONICAL/E72/code/throttle_controller.py` | 9 |  |
| `ECO_CANONICAL/E72/code/throttle_reader.py` | 10 |  |
| `ECO_CANONICAL/E72/code/variance_snapshotter.py` | 4 |  |
| `ECO_CANONICAL/E72/code/welford.py` | 8 |  |
| `ECO_CANONICAL/E72/sql/004_e72_campaign_investment_engine.sql` | 19 |  |
| `ECO_CANONICAL/E72/tests/test_welford_and_bayesian.py` | 6 |  |

## LIVE CODE (1)

| Part | KB | Grade |
|---|---:|---|
| `ecosystems/E72_campaign_investment_engine/E72_ASSIGNMENT_2026-07-01.md` | 2 |  |

## MIGRATION (1)

| Part | KB | Grade |
|---|---:|---|
| `database/migrations/004_e72_campaign_investment_engine.sql` | 19 |  |

## LANE DOC (3)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E72/E72_CAMPAIGN_INVESTMENT_ENGINE_ARCHITECTURE.md` | 35 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E72/E72_CAMPAIGN_INVESTMENT_ENGINE_v1_2026-06-05.md` | 37 |  |
| `AGENT_BOOT/ECOSYSTEM FILES/E72/E72_SPECIFICATION.md` | 1 |  |

## ORPHAN (1)

| Part | KB | Grade |
|---|---:|---|
| `AGENT_BOOT/ECOSYSTEM FILES/E72/NONDEPLOYED_ORPHANS/2026-06-04-2351-session-brief.md` | 11 |  |

## DOC (7)

| Part | KB | Grade |
|---|---:|---|
| `docs/architecture/E72_CAMPAIGN_INVESTMENT_ENGINE_ARCHITECTURE.md` | 35 |  |
| `docs/architecture/E72_CAMPAIGN_INVESTMENT_ENGINE_v1_2026-06-05.md` | 37 |  |
| `docs/canonical/E60_E61_E72_SPLIT_RULING_2026-07-01.md` | 3 |  |
| `docs/canonical/E72_SEQUENTIAL_LIBRARY_INDEX.md` | 26 |  |
| `docs/canonical/grand-audit/CAT3/E60_E72_E73_E79_DECISION_ENGINES_DOSSIER.md` | 4 |  |
| `docs/ecosystems/missing/E72_MISSING.md` | 1 |  |
| `docs/research/strategy/E72_CAMPAIGN_INVESTMENT_ENGINE_COMPETITIVE_LANDSCAPE_2026-06-04.md` | 42 |  |

## ARCHIVE (2)

| Part | KB | Grade |
|---|---:|---|
| `archive/recovered/2026-07-01/claude-session-fade/RAW_PASTED_TEXT_CLAUDE_E61_E72_BRAIN_E30_2026-07-01.txt` | 8 |  |
| `archive/recovered/2026-07-01/e61-e60-e72-split-reality/RAW_PASTED_TEXT_E61_E60_E72_SPLIT_REALITY_2026-07-01.txt` | 6 |  |

---

*Sacred canary: cluster 372171 = 147 txns / $332,631.30. Nothing in this index is installed until EDGAR orders it; ordered means deployed.*
