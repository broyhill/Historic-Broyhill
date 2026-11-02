# E72 — Campaign Investment Engine ($$$-BINGO)

## IDENTITY LOCK (Ed ruling 2026-08-10, AUTHORIZED this session)

**E72 = Campaign Investment / $$$-BINGO — the Wizard's campaign planning engine.**

Flow: E68 Wizard (intent questionnaire) → E72 requests context via E20 Brain
(broker pulls: E60 value + C/B/V costs, E11 caps, E01/E06 data,
E08/E10/E13/E59 rules & media) → E72 synthesizes the **Campaign Plan Object**
(commit → allocate → predicted ROI → track → learn) → E68 presents →
candidate authorizes → E20 → guns.

**E72 is NOT:**
- C/B/V cost accounting — that lives in **E60** (Ed ruling 2026-08-10/11; E87 briefly held it — superseded, number reserved-inactive; see `docs/canonical/ML_OWNERSHIP_MATRIX_AND_CBV_E60_RELOCATION_2026-08-11.md`). **Reaffirmed by Ed 2026-09-04 ("Agreed"):** E60 owns C/B/V, E87 reserved-inactive, E11 is the CFO ceiling, E72 assembles; closes the 2026-09-03 seam-reconciliation "E87 contested" reading. Ed also confirmed E72 as the Wizard's feeder that day ("e72. I used word Bingo to remember"); whether it is E68's *sole* planning input (the one-input law) is **still open as §9-18(a)** — not ratified, not to be enforced yet. Record: `docs/canonical/drafts/BGOP_WHOPPER_INTEGRATED_DONOR_DB_TO_WIZARD_DESIGN_2026-09-04.md` §5.5, §9-7, §9-18.
- the FEC quarterly filings stub (`NONDEPLOYED_ORPHANS/E72_MISSING.md` — historical misfile; FEC stays in the compliance/E62 lane)
- the gov grant→donor→sponsor intelligence doc (different product; historical alias on this number)
- "Commitment Loop" (Volume-X historical name, below — kept as history, not identity)

Canonical E72 docs: `AGENT_BOOT/ECOSYSTEM FILES/E72/E72_CAMPAIGN_INVESTMENT_ENGINE_v1_2026-06-05.md`,
`E72_CAMPAIGN_PLANNING_ARCHITECTURE_2026-08-10.md`,
`docs/research/strategy/E72_CAMPAIGN_INVESTMENT_ENGINE_COMPETITIVE_LANDSCAPE_2026-06-04.md`.

## Live condition (query-proven 2026-08-10)
`e72.*` schema: 0 tables (empty — engine exists on paper + unwired code only; live schema requires separate Ed AUTHORIZED)

## HISTORICAL — VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12; superseded by identity lock above)
### E72 — Commitment Loop
| Field | Value |
|---|---|
| **Name** | Commitment Loop |
| **Band** | 02-Engagement |
| **Status** | 🧪 SPEC — referenced Integration Plan Phase 4; not started |
| **Purpose** | Pledge / commitment capture and follow-through loop — converts soft commitments into completed gifts and tracks fulfillment. |
| **Notes** | Future phase. No code yet. |

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 14
- ECO_CANONICAL/E72/004_e72_campaign_investment_engine.sql
- ECO_CANONICAL/E72/anomaly_detector.py
- ECO_CANONICAL/E72/attribution_resolver.py
- ECO_CANONICAL/E72/bayesian.py
- ECO_CANONICAL/E72/brain_consumer.py
- ECO_CANONICAL/E72/budget_optimizer.py
- ECO_CANONICAL/E72/network_prior_recomputer.py
- ECO_CANONICAL/E72/orchestrator.py
- ECO_CANONICAL/E72/signal_emitter.py
- ECO_CANONICAL/E72/test_welford_and_bayesian.py
- ECO_CANONICAL/E72/throttle_controller.py
- ECO_CANONICAL/E72/throttle_reader.py
- ECO_CANONICAL/E72/variance_snapshotter.py
- ECO_CANONICAL/E72/welford.py

## GAPS — fill-in-the-blank
- [ ] verify completeness against category spec

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

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
