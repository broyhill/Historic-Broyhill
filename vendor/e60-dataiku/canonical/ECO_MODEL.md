# E60 — ML Review & Improvement Engine (Campaign Profit / Dataiku-class)

**Sequencing direction (Ed, 2026-09-24):** first complete ecosystem-drift
reconciliation and revised platform architecture, then Hetzner database
architecture; only after both gates are accepted, revise and complete the E60
plan. See [the dated sequence and acceptance gates](../../docs/canonical/PLATFORM_DRIFT_DATABASE_THEN_E60_SEQUENCE_2026-09-24.md).
This changes work order, not ownership or deployment status. All original
content below is preserved; dated live-state claims still require fresh evidence.

## IDENTITY RULING (Ed, 2026-08-10/11) — READ FIRST

**REAFFIRMED (Ed, 2026-09-04 — "Agreed"):** E60 owns C/B/V; E87 stays reserved-inactive; E11 is the CFO ceiling (budget caps, not the ledger); E72 assembles the plan. `financial_matrix.cost_owner = E60`. This closes the 2026-09-03 seam-reconciliation reading of E87 as "contested/frozen" — that note is history of the collision, not law. Record: `docs/canonical/drafts/BGOP_WHOPPER_INTEGRATED_DONOR_DB_TO_WIZARD_DESIGN_2026-09-04.md` §9-7.

**E60 is the platform's ML review and improvement engine — and the A/B hub:**
- **Watches** every cannon/wizard activity after it fires
- **Assesses** the result — did it work, what did it cost, what came back
- **Strives to do better** — continuously improves models, weights, LP coefficients
- **Houses C/B/V** — cost, benefit, and variance live HERE, not in a separate eco
  (E87 superseded; number reserved but inactive; package at `ECO_CANONICAL/E60/CBV/`)
- **Connects to every ecosystem running experiments — but NOT "A/B testing":**
  Ed ruling 2026-08-11 strikes that vocabulary. BGOP runs **A/B/∞** — continuous
  multi-armed contextual optimization across candidate × issue × channel × tone ×
  timing × grade × faction × jurisdiction, arms not independent, signal propagating
  to correlated silos ("Forsyth teaches Mecklenburg"). **E22 = multi-dimensional
  variant composer** (generates the variant space); **E60 = the learner** that
  optimizes across it and continuously writes `predicted_revenue_per_cent[channel,
  segment]` into the LP. Doctrine: `docs/canonical/E60_AB_INFINITY_DOCTRINE_2026-08-11.md`

**The flywheel:** guns fire → E60 watches → E60 measures cost + benefit + variance
→ E60 reweights → next cannon fire is smarter.

**Write gate:** `ml.donor_fingerprint` single declared writer = **E60 jobs only**;
E13 and E01 feed via views, no direct DDL/DML. (Live view creation and any DDL
require Ed's exact phrase `I AUTHORIZE THIS ACTION`.)

Ruling record: `docs/canonical/ML_OWNERSHIP_MATRIX_AND_CBV_E60_RELOCATION_2026-08-11.md`

## LOCKED IDENTITY (2026-07-26) — prior lock, consistent with the above
**Canon:** `docs/canonical/E60_LOCKED_IDENTITY_DATAIKU_CLASS_2026-07-26.md`  
**E60 = Campaign Profit Engine** — Dataiku-class ML+LP quantitative decisioning (seven models + PuLP + 13-faction Thompson + cost ledger).  
**Not** Nervous Net. **Not** Poll/Survey. **Not** owner of landing-page `lp.*`.  
Live: `lp_decision.*` four tables all **0 rows** (solver never recorded a run). Wiring to E20/E68 = SPEC only until authorized.

## Live condition (query-proven 2026-07-23; reconfirmed 2026-07-26)
lp_decision live 4 tables; 49KB solver service in archive, not deployed; solver_runs=0

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12) — STALE FOR IDENTITY
### E60 — Nervous Net (MISLABELED — superseded by 2026-07-26 lock)
| Field | Value |
|---|---|
| **Name** | ⚠️ MISLABELED — Current code is "Nervous Net" (cost-ledger + IFTTT + LP optimizer) |
| **Band** | 00-Foundation (Brain Pentad 5th member) |
| **Status** | ⚠️ MISLABELED — real E60 = Poll/Survey Intelligence (0% built) |
| **Canonical file** | `e60/cost_ledger.py`, `e60/iftt_engine.py`, `e60/ml_optimizer.py` (confirmed by May 16 audit) |
| **Current function** | Cost-ledger (receives every dollar spent as `CostEvent`), IFTTT rule engine (`RuleFired` → any module), LP optimizer (`OptimizerDecision` → E11). 5th member of Brain Pentad. |
| **Real E60 (unbuilt)** | Poll & Survey Intelligence — 0% built. |
| **REQUIRED DECISION** | Current Nervous Net code needs to move to `shared/brain/`. Real E60 (Poll/Survey) then needs to be built or deferred. **Do NOT execute this rename without `I AUTHORIZE THIS ACTION` from Ed.** |
| **Brain Pentad payloads** | Receives: `CostEvent` (from any module). Emits: `RuleFired` (to any module), `OptimizerDecision` (to E11). |
| **Surpasses (real E60)** | SurveyMonkey, Qualtrics, Typeform, Google Forms (political-domain surveys) |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 12
- ECO_CANONICAL/E60/200_e60_nervous_net.sql
- ECO_CANONICAL/E60/__init__.py
- ECO_CANONICAL/E60/broyhillgop_lp_model.py
- ECO_CANONICAL/E60/cost_ledger.py
- ECO_CANONICAL/E60/E60_ddl.sql
- ECO_CANONICAL/E60/E60_poll_survey_intelligence_registry.sql
- ECO_CANONICAL/E60/iftt_engine.py
- ECO_CANONICAL/E60/ml_optimizer.py
- ECO_CANONICAL/E60/test_e60_cost_ledger_idempotency.py
- ECO_CANONICAL/E60/test_e60_lp_problem_well_formed.py
- ECO_CANONICAL/E60/test_e60_pentad_contract.py
- ECO_CANONICAL/E60/test_e60_rule_firing.py

## GAPS — fill-in-the-blank
- [ ] verify completeness against category spec

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

---

## E60 / E88 Boundary Addendum: E60 / E88 Boundary Table

**Date:** 2026-08-11  
**Authority:** Ed ruling 2026-08-11 (Option A — E88 authorized as separate ecosystem)  
**File as:** Addendum to `ECO_CANONICAL/E60/ECO_MODEL.md` — append to identity section

---

## E60 / E88 BOUNDARY TABLE

This table is required in both ECO_MODELs per Ed's Option A ruling.
It prevents an E87-style collision from recurring.

| Capability | Owner | Moment in data loop | Single writer |
|---|---|---|---|
| Pre-fire engagement scoring (p_open, p_click) | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` |
| Per-contact persona classification | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` |
| Send time optimization (optimal_send_hour) | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` |
| Per-contact fatigue / saturation curve | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` |
| Multi-candidate ask arbitration | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` |
| Multi-cycle CLV enrichment (engagement-weighted) | **E88** | Step 2 — INTELLIGENCE | `ecosystem_88_worker.py` (reads E60 base) |
| Post-fire C/B/V variance accounting | **E60** | Step 7 — FEEDBACK | E60 worker |
| LP weight reweighting (Thompson Bandit α/β) | **E60** | Step 7 — FEEDBACK | E60 worker |
| LTV slow clock — base 5-cycle value | **E60** | Step 7 — FEEDBACK | E60 worker → `e60.donor_value_current` |
| A/B/∞ multi-armed optimization allocation | **E60** | Step 7 — FEEDBACK | E60 worker |
| Post-fire campaign-level C/B/V reporting | **E60** | Step 7 — FEEDBACK | E60 worker |

**Dependency direction:** E88 reads `e60.donor_value_current` as a CLV base input.
E60 reads E88 predicted values (`p_open`, `p_click`) as labels for model retraining.
This is a clean upstream/downstream dependency — E88 at step 2, E60 at step 7.

**Why not a collision:**
E87 put C/B/V and per-contact scoring in the same number at the same moment.
E60 and E88 operate at different moments with different inputs and different schemas.
`e88.*` is single-writer E88. `e60.*` is single-writer E60. No overlap.

**What E60 does NOT own (per this ruling):**
- Pre-fire per-contact engagement prediction (E88)
- Cross-candidate ask arbitration (E88 — intentional cross-silo, incompatible with E60's single-silo A/B/∞ doctrine)
- Optimal send hour computation (E88)

---

*Appended per Ed ruling 2026-08-11 ("E88 authorized as its own eco, Option A, boundary table is canon"). Source: `ECO_CANONICAL/E88/docs/E60_BOUNDARY_ADDENDUM_2026-08-11.md`.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** PROFIT CENTER — judged on net (benefit minus cost) via the C/B/V ledger.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
