# E70 — Cannon door W13 (DIGITAL_AD) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE, nothing sends · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W13` |
| Executor (brain.action_executors) | `EXEC_E70_DIGITAL_AD_AUDIENCE` — registered dark by PR #1082 part 2 |
| Socket weapon token | `ad` → `backend/python/api/cannon_doors/w13_digital_ad.py` |
| weapon_queue action_types | `digital_ad` |
| Guard group (circuit_breakers) | DIGITAL |
| Live gate | `ops.gate_r4_studio_gate_state['W13']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_DIGITAL_AD` → `e41.weapon_registry['DIGITAL_AD']` |
| Code lane | `ECO_CANONICAL/E70/code/ecosystem_70_digital_gateway.py` — gateway spine built 2026-10-02 (contract · gate · adapter seams · EventProcessor) |
| Provider | Meta/Google custom audiences (hashed) |

## Intent
Audience weapon: FIRE = push a hashed audience + creative_ref; de_identified_only=TRUE must be set on the executor row before FIRE (socket Gates refuse vendor rows otherwise).

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `DIGITAL_AD`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — Smart-Send hold) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `digital_ad`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w13_digital_ad.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. ~~Build the provider path~~ DONE 2026-10-02: `Door.fire()` is bound to `ecosystem_70_digital_gateway.py` → `AudienceTask` → `DeIdentificationGate` → adapter. Fill the ONE seam: **`MetaCustomAudienceAdapter.dispatch / GoogleCustomerMatchAdapter.dispatch`** (Meta customaudiences + /users (hashed) · Google OfflineUserDataJobService). Nothing else in the lane needs touching.
2. Implement `Door.validate_channel` for every compliance rule the DIGITAL guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W13']` to FIRE and `brain.action_executors['EXEC_E70_DIGITAL_AD_AUDIENCE'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

## What the lane looks like now (2026-10-02, part 6)
- **Schema** `database/migrations/dryrun/DRYRUN_CANNON_LANES_E67_E69_E70_E71_E75_E76_2026-10-02.sql` — DRY-RUN, NOT APPLIED. Creates `e70.task`, `e70.events`, and the registry this cannon reads recipients from: `e70.audience + e70.audience_member (hashed only)`. Rehearsed on scratch PG16 (rollback run, idempotent re-run, commit run, rail checks). Also seeds trigger `T-W-1{19..24}` dark and the `E41_FIRES_VIA` edge.
- **Gate before seam** — proven by `test_cannon_doors.py::test_new_lanes_gate_before_seam[DIGITAL_AD]`: a bare payload is `blocked` by `DeIdentificationGate` with the lane's own reason; a gate-satisfying payload reaches the adapter and answers `not_wired` because the vendor call is a `NotImplementedError` seam.
- **Learning loop** — `EventProcessor.process()` writes `e70.events` → `journey.weapon_journey` lifecycle columns (`dispatched_at/delivered_at/engaged_at/responded_at/failed_at`) → `brain.event_queue` (`ad.*`) so E41 predicates and the E10 fatigue ceiling see the touch. Terminal opt-outs go to `brain.suppression_list`.
- **Credentials** are read from env refs named in the door (`BGOP_*`); none exist yet, none are needed until step 4.

Nothing in this file authorizes a send.
