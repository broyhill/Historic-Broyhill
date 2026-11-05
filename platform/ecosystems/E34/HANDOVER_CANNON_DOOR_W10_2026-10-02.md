# E34 — Cannon door W10 (TOWNHALL) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE, nothing sends · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W10` |
| Executor (brain.action_executors) | `EXEC_E34_TOWNHALL_INVITE` — registered dark by PR #1082 part 2 |
| Socket weapon token | `event` → `backend/python/api/cannon_doors/w10_townhall.py` |
| weapon_queue action_types | `event_invite` |
| Guard group (circuit_breakers) | TELEPHONY |
| Live gate | `ops.gate_r4_studio_gate_state['W10']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_TOWNHALL` → `e41.weapon_registry['TOWNHALL']` |
| Code lane | ECO_CANONICAL/E34/code/ecosystem_34_events.py |
| Provider | invite via E30/E31 + E37 Events registration |

## Intent
telephony_guard counts W10 as telephony (tele-town-hall dial-out). Invite by email is DIGITAL; keep the guard group on the actual channel used.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `TOWNHALL`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — TCPA block) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `event_invite`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w10_townhall.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the TELEPHONY guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W10']` to FIRE and `brain.action_executors['EXEC_E34_TOWNHALL_INVITE'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
