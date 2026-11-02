# E90 — Operations Management: the science & process-to-algorithm matrix

**2026-10-18 · Claude Code for Ed.** Defines the OM science E90 runs over the [War Factory](THE_WAR_FACTORY_2026-10-17.md). Phase-1 charter (what the ecosystem IS); solver config + field maps are Phase-2. Grounded in `ECO_CANONICAL/E90/README.md` (Dataiku + Gurobi + OR-Tools CP-SAT + HiGHS + Postgres). **Accuracy Doctrine: a validated solver computes; the LLM never performs the authoritative calculation — every result is a recommendation.**

## Definition
Operations Management = the science of planning, coordinating, executing, controlling, and continuously improving the transformation of inputs into finished goods. For us the "goods" are **munitions** and the throughput is **donations raised**. E90 is the plant manager that runs that science with real operations-research math.

## Three platform truths the furniture model doesn't have
1. **The product is perishable (JIT).** A munition's yield decays with timing/news → you optimize *flow and freshness*, not finished-goods stockpiles.
2. **Throughput = donations.** The objective function is the Prime Directive: **maximize donations** subject to constraints. OM here is literally revenue optimization.
3. **The binding constraint is usually *legal*.** TCPA/FEC/10DLC fatigue/opt-out caps are a hard **capacity** limit (not just QC). E10 is both a QC station *and* the capacity ceiling — unusual, and central.

## Process-to-algorithm matrix (12 phases → platform)
| # | OM question | Algorithm(s) | E90 solver | Platform organ | War-Factory station |
|---|---|---|---|---|---|
| 1 | What should we make? (demand) | time-series (ES/Holt-Winters/ARIMA) + **LTV/propensity** (BG-NBD, Gamma-Gamma) | stats/Dataiku | E01 LTV · E59 segment demand · E42 news spikes · E72 | Planning (1) |
| 2 | How much capacity? (master plan) | **LP/MIP** aggregate planning | **Gurobi** | E60 budget LP · E90 | Planning (1) |
| 3 | What materials? (MRP) | BOM explosion + **netting** (gross − on-hand − open + safety) | recursive | E80 munition BOM · E59 counts | Receiving/Roughing (2–3) |
| 4 | How much to carry? (inventory) | **EOQ, safety stock** `Z·σ·√LT` → here: **data-refresh cadence + ready-magazine depth** | stats | E61 ingestion cadence · ready-magazine | Raw inventory (2) |
| 5 | Can we build it? (capacity) | finite-capacity; required vs available | OR-Tools | **E10 legal headroom** · channel SLOs (`weapon_slo`) · call-center hours | QC/Shipping (14/16) |
| 6 | In what order? (scheduling) | FCFS/EDD/**SPT**/Critical-Ratio; constraint-based APS; CR = days-to-election | **OR-Tools CP-SAT** | E64 sequence · E60 · E40 · the 1812 time-sequenced score | Planning→Shipping |
| 7 | Which round next? (dispatch) | priority dispatch (grade × heat × due) | heuristic | per-cannon send queue · E40 · scheduled_sender | Shipping (16) |
| 8 | What limits throughput? (**TOC**) | Theory of Constraints — find/exploit/subordinate the constraint | TOC + LP | **E90 bottleneck detect** · E73 sense | across the line |
| 9 | Is the process stable? (quality) | **SPC** (X̄/R/P/C charts), Cp = (USL−LSL)/6σ; defect = bounce/spam/opt-out | stats | E22 A/B · E06 analytics · E10 · E73 drift | QC (14) |
| 10 | What did it cost? (costing) | standard-cost rollup; **variance** = actual − standard | cost model | **E60 CFO** · E72 variance · E11 | BDA (+17) |
| 11 | When will it fail? (maintenance) | **Weibull reliability** `R(t)=e^(−λt)`, trend — here: deliverability decay, **model drift**, 10DLC/reputation health | reliability | E73 immune · **E84 enterprise_health** · provider_failover · model-drift | self-heal (+17) |
| 12 | Real-time (continuous) | event → rule → re-optimize (IF cannon down THEN recompute schedule/capacity) | Gurobi/OR-Tools | **E91/E40 IFTTT** + E90 continuous opt + E73 | whole line |

## The mathematical stack → platform
Forecasting → E01/E59/E72 · MRP → E80/E59 · Replenishment(EOQ/SS) → E61/ready-magazine · Scheduling → E60/E64/OR-Tools · Capacity → E90/E10/Gurobi · Quality(SPC) → E22/E06/E73 · Maintenance(reliability) → E73/E84 · Costing → E60/E72/E11 · Bottlenecks(TOC) → E90/E73 · Network opt → E60.

**Order of application (one cycle):** forecast demand (1) → master-plan capacity (2) → MRP (3) → replenish/refresh (4) → capacity check (5) → schedule (6) → dispatch (7) → run + monitor bottleneck (8) → SPC (9) → cost variance (10) → predictive maintenance (11) → continuous re-optimize (12) → back to forecast. That cycle **is** the War Factory running, with E90 as its OR engine and the loop closing (+17) back to the tattoo.

## Net-new algorithms (fold-in from the D365 module view)
- **Backward scheduling** — *fire-date − sequence-lead = start date.* **This is the engine of the 1812 Overture**: the Home-Reception example backward-schedules 11 touches from the Day-60 event. The election/fundraiser/news date sets the fire date; the factory works backward to "start composing now." (OR-Tools; organ E64/E60.)
- **ATP/CTP (order promising)** — *can we promise this donor a response by date X within legal headroom?* → a promised fire-window (E64 + E10 headroom + E60).
- **Wave processing** — batch donors into **send waves** by segment × channel × window (the microsegment wave); minimizes setup/provider churn. (Warehouse-wave analogue; organ E40/E59.)
- **Load / route optimization + carrier selection** — pick the ESP/SMS/mail **provider**, consolidate sends to minimize cost / maximize deliverability (vehicle-routing analogue; organ Arsenal + provider_failover).
- **OEE = Availability × Performance × Quality** — the **per-cannon effectiveness KPI**: channel uptime × send-throughput × deliverability. The cannon health score.
- **MTBF = operating-time / failures** — cannon/provider reliability → feeds predictive maintenance + failover (E73/E84).

**The three that most determine whether we deliver (our version of Copilot's "big three"):**
1. **MRP net-requirements** — how many personalized rounds must be composed/sent (demand − already-sent).
2. **Finite capacity** — **legal/channel headroom** (the binding constraint; E10).
3. **Standard cost + variance** — ROI per round (E60 CFO / E72).
Get these three right and the platform raises **on time, at cost, at throughput** — the Prime Directive, as constrained optimization.

## Why this sits in the Oracle, deterministically
E84 (Library) holds the **approved method registry**; E90's **deterministic method router** picks the algorithm family; **Gurobi/OR-Tools/stats** compute; the result is a **recommendation** a human implements. The LLM drafts and routes — it never does the math. E90 + E73 are the two places the Accuracy Doctrine was already built into the platform.

**Phase-2 (later, after ecosystems are defined):** solver formulations, the method registry contents, field-level inputs per algorithm, and validation/test cases — all grounded in the live schema, not guessed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
