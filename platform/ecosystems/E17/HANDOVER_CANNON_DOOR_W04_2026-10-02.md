# E17 — Cannon door W04 (RVM) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE · `fire()` bound to the gateway seam; vendor dispatch NOT implemented · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W04` |
| Executor (brain.action_executors) | `EXEC_E17_RVM_DROP` — exists live, enabled=false |
| Socket weapon token | `rvm` → `backend/python/api/cannon_doors/w04_rvm.py` |
| weapon_queue action_types | `rvm_drop` (weapon_executor.py wrongly routes `phone_call` here today — W16 owns it) |
| Guard group (circuit_breakers) | TELEPHONY |
| Live gate | `ops.gate_r4_studio_gate_state['W04']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_RVM` → `e41.weapon_registry['RVM']` |
| Code lane | ECO_CANONICAL/E17/code/ecosystem_17_rvm_gateway.py · e17_sound_engine.py |
| Provider | Drop Cowboy / Slybroadcast per gateway |

## Bind proof (2026-10-02)
`Door.fire()` builds a `DropTask`, runs `RVMConsentGate.check()` (which correctly blocked `appended_number_no_consent` on a bare payload) and calls `DropCowboyAdapter.dispatch_batch()` — which `raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")`. Same for `SlybroadcastAdapter`. **This lane is not complete**: the contract, consent gate, event processor and oversight engine exist; the vendor call does not. Step 1 for the next AI = implement `dispatch_batch` via E55 `drop_cowboy_request()`.

## Intent
R4_TIME_WINDOW_CALLING 08–21 local is a hard block here. weapon_executor maps 'phone_call' to RVM today — W16 phone must take that token back.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `RVM`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — TCPA block) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `rvm_drop`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w04_rvm.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the TELEPHONY guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W04']` to FIRE and `brain.action_executors['EXEC_E17_RVM_DROP'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
