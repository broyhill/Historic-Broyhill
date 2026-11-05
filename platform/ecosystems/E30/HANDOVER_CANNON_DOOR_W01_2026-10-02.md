# E30 — Cannon door W01 (EMAIL) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE · `fire()` BOUND and PROVEN 2026-10-02 · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W01` |
| Executor (brain.action_executors) | `EXEC_E30_EMAIL_SEND` — exists live, enabled=false |
| Socket weapon token | `email` → `backend/python/api/cannon_doors/w01_email.py` |
| weapon_queue action_types | `email_send, schedule_send, priority_send` |
| Guard group (circuit_breakers) | DIGITAL |
| Live gate | `ops.gate_r4_studio_gate_state['W01']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_EMAIL` → `e41.weapon_registry['EMAIL']` |
| Code lane | ECO_CANONICAL/E30/code/sender.py (send) · providers.py · compliance.py |
| Provider | Waypoint / SES per E30 providers.py |

## Bind proof (2026-10-02, sandbox, no credentials)
`Door.fire()` → `ecosystems.e30_email.sender.EnterpriseEmailSender.send(PersonalizedMessage)` ran the full E30 pipeline on a forced FIRE: `fired`, `provider_message_id=mock_…`, `delivered=True` via MockProvider (no ESP creds present). E30's own gate first refused `tier_UNMATCHED` — the E13 match tier must ride in the payload (`match_tier`: A_EXACT…E_WRONG_LAST). Step 1 of the go-live list below is DONE; steps 4–5 remain. Note: the lane imports itself as package `ecosystems.e30_email`, which exists nowhere on main — the door mounts `ECO_CANONICAL/E30/code` under that name at fire time.

## Intent
Most complete lane (26 py). sender.py already shapes a provider call; wire it behind FIRE. E30 executor event_class is 'donation.received' until G2 dry-run applies.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `EMAIL`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — Smart-Send hold) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `email_send`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w01_email.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the DIGITAL guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W01']` to FIRE and `brain.action_executors['EXEC_E30_EMAIL_SEND'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
