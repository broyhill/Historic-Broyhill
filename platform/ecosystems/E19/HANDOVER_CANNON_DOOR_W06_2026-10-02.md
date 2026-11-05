# E19 — Cannon door W06 (SOCIAL) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE, nothing sends · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W06` |
| Executor (brain.action_executors) | `EXEC_E19_SOCIAL_POST` — exists live, enabled=false |
| Socket weapon token | `social` → `backend/python/api/cannon_doors/w06_social.py` |
| weapon_queue action_types | `social_post` |
| Guard group (circuit_breakers) | DIGITAL |
| Live gate | `ops.gate_r4_studio_gate_state['W06']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_SOCIAL` → `e41.weapon_registry['SOCIAL']` |
| Code lane | ECO_CANONICAL/E19/code/routes.py · ecosystem_19_social_media_manager.py · ecosystem_19_audience_builder.py |
| Provider | Platform APIs per E19 manager (LinkedIn/IG/X) + AutoSocial fork |

## Intent
Audience weapon: a 'send' is a post or a retargeting-audience push, not a per-donor message. journey_position still records the touch per donor.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `SOCIAL`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — Smart-Send hold) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `social_post`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w06_social.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the DIGITAL guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W06']` to FIRE and `brain.action_executors['EXEC_E19_SOCIAL_POST'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
