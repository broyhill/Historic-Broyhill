# E70 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition
Not yet audited live — run relay information_schema check before any build.

## Canonical files present: 0 → 4 WRITTEN, 0 DEPLOYED (2026-08-30, PR #818)
The repo census was correct when written: this lane was paper-only. As of PR #818 it
carries a schema, a pricing layer, an executor registration, a gun adapter and tests.
**None of it is applied.** All three SQL files are `PENDING_AUTHORIZATION` in
`database/migrations/dryrun/DRY_RUN_LEDGER.md`, and the `information_schema` collision
check has never run — both Hetzner boxes have been dark since 2026-08-27. The gap below
is therefore *written*, not *closed*.

## GAPS — fill-in-the-blank
- [ ] identify this eco's spec in docs/canonical/ and the 87-slot rubric
- [ ] code: no canonical implementation found
- [ ] sql/schema: no DDL found — capture from live DB if schema exists, else write
- [ ] taxonomies/tests/docs slots empty

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## BOUNDARY — E16 produces the spot. E70 buys the inventory.

Settled 2026-08-30 after E70 work was nearly built into E16 by mistake.

| Job | Lane |
|---|---|
| Make the TV/radio/OTT spot — script, voice, render, CALM Act loudness | **E16** |
| Buy and deliver CTV/digital inventory through a DSP; flights, budgets, delivery facts | **E70 / W13** |
| Live simulcast to Facebook/YouTube/Rumble — organic, not paid | **E46** |
| FCC / disclaimer compliance gate | **E10**, via the socket's `requires_compliance` |
| Audience, district, allocation, did-we-fire-once | E59 · E13 · E77 · E60 · E20 |

**The trap that caused it:** Volume X's E16 purpose line claims "manages media buying,
station targeting, FCC compliance" — written one day before the gun architecture took those
jobs away, never updated. It has misrouted work four times. Both ends are now bannered:
Volume X's E16 entry and `ECO_CANONICAL/E16/ECO_MODEL.md`.

**E16's `OTT` is a creative format**, a member of `class AdType` beside `TV_SPOT` and
`PRE_ROLL` — not a buying channel. E16 has zero database coupling; a buying engine must write
flights and delivery facts.

## NAMING — the executor value is `digital_ad`, the lane name is Digital Ads

Ed's call, 2026-08-30. Recorded here so it is not rediscovered or "corrected" later.

| Where | Value | Why |
|---|---|---|
| `brain.action_executors.weapon` | **`digital_ad`** (singular) | The live convention. Every deployed channel in `314_brain_action_executors_seed.sql` is singular: `sms`, `rvm`, `call`, `mail`, `social`. The column is a *type*, not a collection — one row is one ad. |
| `executor_code` | `EXEC_E70_DIGITAL_AD` | Follows the `EXEC_E##_<VERB>` pattern of the same seed. |
| `event_class` | `outreach.digital_ad_ready` | Follows `outreach.<channel>_ready`. |
| Lane / English name | **Digital Ads** | Volume X. Unchanged. |
| Arsenal label | **W13** | Docs only. Carried as `weapon_label` in the E70 outbox payload; it is **not** a value any table holds. |

**Volume X says `digital_ads`. Live data wins.** The same document also says the weapon is
`W13`; had that shipped, the executor would have registered and the socket would never have
routed to it — a silent no-op, not a loud failure. Being consistent with the map on spelling
while overriding it on the value would be preferring the doc only where it is cheap.
`ecosystems/e70_digital_ads/test_adapter.py` pins `WEAPON == "digital_ad"` so it cannot drift.

## LEDGER CLASS vs PRICING MODEL — two different axes, do not conflate

Both are Ed's, and they answer different questions.

| Axis | Ed's ruling | What it governs |
|---|---|---|
| **Ledger class** | REVENUE CENTER — *"judged on dollars raised at the point of fire"* (2026-08-28, below) | How E70 is **measured**. Its objective is donations raised for the candidate. |
| **Pricing model** | Undecided pending beta — *"I may make this strictly cost base app but unsure til we beta test so set this up for a profit center with our ability to set price"* (2026-08-30) | Whether BGOP charges the tenant **margin on the media**. |

A revenue-centre lane can bill at cost. The two are independent, and the pricing layer is
built so the second question stays open: `e70.rate_cards.pricing_mode` selects
`cost_recovery` / `cost_plus_pct` / `cost_plus_fixed` / `fixed_cpm` / `managed_fee` as DATA.
Beta runs on the seeded `default_cost_recovery`; the post-beta flip is an INSERT plus a
binding row, never a migration.

**LP capstone compliance:** `e70.price_line()` is a policy resolver, not an optimizer. It
chooses nothing — it applies the rate card in force. The objective function stays E60's
per the capstone doctrine below. If a future session is tempted to put allocation logic
inside the pricing function, that is the "local objective / self-invented math" the
capstone forbids.

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** REVENUE CENTER — judged on dollars raised at the point of fire.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
