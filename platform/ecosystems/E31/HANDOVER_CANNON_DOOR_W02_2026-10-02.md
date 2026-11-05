# E31 — Cannon door W02 (SMS) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE · `fire()` BOUND; lane config defect blocks a real send · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W02` |
| Executor (brain.action_executors) | `EXEC_E31_SMS_SEND` — exists live, enabled=false |
| Socket weapon token | `sms` → `backend/python/api/cannon_doors/w02_sms.py` |
| weapon_queue action_types | `sms_send` |
| Guard group (circuit_breakers) | TELEPHONY |
| Live gate | `ops.gate_r4_studio_gate_state['W02']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_SMS` → `e41.weapon_registry['SMS']` |
| Code lane | ECO_CANONICAL/E31/code/send_engine.py · consent.py · number_pool.py |
| Provider | Twilio (e31_twilio_webhook.py) per E31 providers.py |

## Bind proof (2026-10-02, sandbox)
`Door.fire()` → `ecosystems.e31_sms_mms.send_engine.SendEngine.send(phone, body, candidate_id=UUID, …)` reached E31's consent check, which opened `E31Config.DATABASE_URL` and failed: the default DSN carries the Hetzner password with an **unescaped `@`** (`could not translate host name "…@37.27.169.232"`). This is the known two-`@` password defect (Ed ruling 2026-07-28: URL-style DSNs must percent-encode as `%40`; env-only, never a hardcoded default). The door turned it into `failed`, not a crash. Fix the lane's `config.py` default (or set `DATABASE_URL` in env) before step 4. E31 keys candidates by **UUID** — the door requires `candidate_uuid` on FIRE; the integer `candidate_id` lane is E41's.

## Intent
10DLC brand/campaign must exist in ops.10dlc_campaign_registry before FIRE (telephony_guard R4_10DLC). config.py: QUIET_HOURS 21–08, TEXTS_PER_DAY_LIMIT=1.

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `SMS`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — TCPA block) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `sms_send`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w02_sms.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the TELEPHONY guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W02']` to FIRE and `brain.action_executors['EXEC_E31_SMS_SEND'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
