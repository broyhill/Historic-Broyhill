# E91 — IFTTT Rules Fabric

**Registered:** Ed Broyhill, 2026-10-08 — `docs/canonical/E91_IFTTT_RULES_FABRIC_REGISTRATION_2026-10-08.md`
**Job:** the trigger / rules control plane — what may fire, whether, and when. Controls weapons; is not a weapon.
**State:** registered number + this folder. Code and schema are not moved here.

## Where the parts live today (copy-only lane; nothing is moved)

| Part | Location | Label |
|---|---|---|
| Canon spec (rev. 3) | `docs/canonical/UNIFIED_TRIGGER_FABRIC_2026-06-15.md` | SPEC |
| Rule registry | live schema `ifttt` — `rules`, `rule_proposals`, `rule_fires` (31 rules since 2026-05-30) | HISTORICAL CLAIM, 2026-10-08 |
| Frozen predecessor | `core.iftt_rules` (E60 original) — migrate, do not extend | SPEC |
| Human ON/OFF/TIMER surface | E40 Automation Control Panel | SPEC |
| Consumers | E41 Campaign Builder, E73 Performance Face, E37 Event Management | SPEC |

## Law

- E68 Wizard authorizes; E20 Brain gates; nothing dispatches around E20.
- Score-based auto-fire language in the 2026-06-15 spec is **HELD** pending Ed's ruling.
