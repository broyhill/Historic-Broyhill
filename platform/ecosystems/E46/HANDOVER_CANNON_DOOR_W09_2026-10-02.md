# E46 — Cannon door W09 (BROADCAST) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE, nothing sends · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W09` |
| Executor (brain.action_executors) | `EXEC_E46_BROADCAST_STREAM` — registered dark by PR #1082 part 2 |
| Socket weapon token | `broadcast` → `backend/python/api/cannon_doors/w09_broadcast.py` |
| weapon_queue action_types | `broadcast_stream` |
| Guard group (circuit_breakers) | DIGITAL |
| Live gate | `ops.gate_r4_studio_gate_state['W09']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_BROADCAST` → `e41.weapon_registry['BROADCAST']` |
| Code lane | ECO_CANONICAL/E46/code/ecosystem_46_broadcast_hub.py |
| Provider | stream platform per E46 hub |

## Intent
Audience weapon. E46 also appears as W16 in the stale 07-26 draft — live weapon_slo says W09 only.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `BROADCAST`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — Smart-Send hold) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `broadcast_stream`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w09_broadcast.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the DIGITAL guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W09']` to FIRE and `brain.action_executors['EXEC_E46_BROADCAST_STREAM'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
