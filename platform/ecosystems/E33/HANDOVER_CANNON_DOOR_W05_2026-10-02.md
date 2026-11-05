# E33 — Cannon door W05 (POSTCARD) — HANDOVER
**Author:** Claude · 2026-10-02 · **Status:** OBSERVE · `fire()` bound; NO vendor submission exists in the lane · **Read this before touching this cannon.**

| | |
|---|---|
| W-code (outcome.weapon_slo, live) | `W05` |
| Executor (brain.action_executors) | `EXEC_E33_DIRECT_MAIL` — registered dark by PR #1082 part 2 |
| Socket weapon token | `mail` → `backend/python/api/cannon_doors/w05_postcard.py` |
| weapon_queue action_types | `direct_mail` |
| Guard group (circuit_breakers) | PRINT |
| Live gate | `ops.gate_r4_studio_gate_state['W05']` = OBSERVE (set 2026-08-27) |
| Journey tile | `e41.action_catalog` `SEND_POSTCARD` → `e41.weapon_registry['POSTCARD']` |
| Code lane | ECO_CANONICAL/E33/code/ecosystem_33_direct_mail.py |
| Provider | LettrLabs (brain.triggers print family action lettrlabs_job) |

## Bind proof (2026-10-02)
`Door.fire()` instantiates `DirectMailEngine` (initializes fine) and looks for a vendor submission method — there is none. The lane creates campaigns, validates addresses, mints QR codes and generates the VDP file; `LOB_API_KEY` / `CLICK2MAIL_API_KEY` are read but never used. **Not complete.** Step 1 for the next AI = add `DirectMailEngine.submit_to_vendor(campaign_id, piece, decision_id)` (the door already calls it by that name) and the LettrLabs/Lob job call.

## Intent
No e33 schema on Hetzner. NES §5.1 PdfmePrintAdapter is the built editor for W05. EXEC_E16_DIRECT_MAIL is the mis-ecoed legacy row (G1 retire).

## How a journey reaches this door
E68 wizard → `e41.journey_tile` (weapon_code `POSTCARD`) → `e41_wizard_workflow.Scheduler` (policy: suppression, e10.blackout, e10.fatigue_policy ceiling, quiet hours — Smart-Send hold) → `e41_journey_engine.propose_step` → `brain.weapon_queue` (action_type `direct_mail`) → E20 drain → `POST /api/v2/actions/execute` (mode from gate) → `cannon_doors.w05_postcard.Door` → `fire()`.

## To take this cannon from OBSERVE to FIRE (in this order, each a named PR)
1. Implement `Door.fire(payload)` — import the send entrypoint from the code lane above; do not duplicate it.
2. Implement `Door.validate_channel` for every compliance rule the PRINT guard does not already cover.
3. Prove it on scratch PG with `backend/python/api/cannon_doors/test_cannon_doors.py` (door answers observed / blocked / not_wired correctly).
4. Ask Ed to flip `ops.gate_r4_studio_gate_state['W05']` to FIRE and `brain.action_executors['EXEC_E33_DIRECT_MAIL'].enabled` — both, by phrase. `requires_observe_pass` stays TRUE until an observe run is on record.
5. Confirm `journey.weapon_journey` receives dispatched_at/delivered_at from the provider ack so `e41` predicates (and the fatigue ceiling) see the touch.

Nothing in this file authorizes a send.
