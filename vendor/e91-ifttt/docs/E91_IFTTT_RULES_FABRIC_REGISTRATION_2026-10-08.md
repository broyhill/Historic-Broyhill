# E91 — IFTTT Rules Fabric — registration ruling (2026-10-08)

**Authority:** Ed Broyhill (J. Edgar Broyhill II), 2026-10-08 — "E91 = IFTTT" (earlier session) and, this session, "yes, lets solidify and register ifttt so it shows up" → "pr".
**Filed by:** Nexus (E51), feature branch + PR. Ed merges.
**State:** WRITTEN in git. **Not** inserted into live `platform.ecosystems`.
**Canary:** cluster 372171 = 147 / 332631.30 (not re-read for this PR; no SQL was run).

## The ruling

| Code | Name | Job |
|---|---|---|
| **E91** | **IFTTT Rules Fabric** | The trigger / rules control plane. Decides *what* may fire, *whether*, and *when*. It controls weapons; it is not a weapon. |

E91 is no longer a hole. Holes are now **E92–E95**. Registered platform: **97** numbers
(E00–E83, E84–E91, E96–E100). E101–E106 remain file-doc lanes.

## Why E91, why separate

Ed, 2026-06-15 (`docs/canonical/UNIFIED_TRIGGER_FABRIC_2026-06-15.md`, rev. 3):

- "combine." — consolidate all scattered IFTTT / trigger logic into one fabric.
- "the trigger is not a weapon. it controls all weapons. it's huge. separate eco alone."
- "it triggers funnels; it does not create them."

The 2026-08-11 identity freeze listed IFTTT as "Unassigned, not E20". This ruling assigns it.

## Evidence (labeled)

- **SPEC** — `docs/canonical/UNIFIED_TRIGGER_FABRIC_2026-06-15.md` (rev. 3): six-location scatter
  (E40, E20, E60 Nervous Net, E41, E73, E37), canonical registry `ifttt.rules`, frozen `core.iftt_rules`.
- **HISTORICAL CLAIM** — Nexus E00–E106 as-built register, 2026-10-08: live schema `ifttt`
  with `rules`, `rule_proposals`, `rule_fires`; 31 rules dating from 2026-05-30.
  Not re-read for this PR. Re-verify read-only before quoting it as current.
- **UNKNOWN** — whether any rule fires today, and against what gate.

## Boundaries (unchanged law, restated so E91 cannot drift)

- E68 Wizard obtains candidate authorization. E20 Brain performs final deterministic gating.
  **Nothing dispatches around E20.** E91 supplies rules; it does not execute sends.
- E40 Automation Control Panel stays the human ON / OFF / TIMER surface over E91 rules.
- E41, E73, E37 consume E91 rules; they do not own them.

## Held — not resolved by this ruling

- The fabric spec's **score-based auto-fire** wording conflicts with Wizard-first law
  (flagged 2026-09 seam review). It stays **HELD** as an E84 conflict record until Ed rules.
  Registration of the number does not authorize auto-fire.
- Live `platform.ecosystems` fill for E91 waits for a named dry-run and `Authorized`.

## What this PR changed

- `ecosystems.yaml` — E91 registered; holes `[E92, E93, E94, E95]`.
- `docs/canonical/REGISTERED_PLATFORM_ROSTER_2026-09-13.md` — amendment block.
- `.github/copilot-instructions.md` — 97 numbers; holes E92–E95.
- `ECO_CANONICAL/E91/README.md` — lane folder.
- `ECO_CANONICAL/E84/code/e84_ecosystem_roster.py` — count 97, holes E92–E95, E91 in the live fill set (31).
- `ECO_CANONICAL/E84/code/e84_ecosystem_property_sync.py` — error text uses the count.
- Four roster tests updated to the 97 roster.

## What this PR did NOT change

- No SQL, no Hetzner, no AX41, no deploy. E84 on AX41 reads its own deployed
  `ecosystems.yaml` (`BGOP_ECOSYSTEMS_YAML`); it will not show E91 until Devin deploys.
- `ECO_CANONICAL/E84/code/e84_retrieval_policy.py` was **not edited** — its sha256
  `050098e4…` is pinned in PR #1151/#1153/#1158/#1159 manifests. Its comment still says
  "Holes E91–E95"; behavior follows the yaml via `registered_codes()`.
- Historical documents that say "E91–E95" are left as written records of their date.
