# E91 IFTTT placement table — search-docs first (2026-10-17)

**Status:** WRITTEN. Docs only. Not installed. No E91 folder. No copy. No move. No roster or yaml edit.
**Authorization:** Ed, 2026-10-17, `AUTHORIZED` against filing this table onto the #1220 shelf.
**Does not authorize:** Operation A copies, Operation B caller cutover, `ecosystems.yaml` / roster one-liners, live DDL, or creating `E91/`.
**Completes:** the first-draft table in `docs/canonical/E91_IFTTT_RULING_2026-10-08.md` (absorbed from PR #1220; original branch `nexus/pixie-stix-warning-e91-ruling-2026-10-13`). The Pixie-Stix warning is filed in the six #1220 paths, all SHA-256 `dfd83e480d9605a10278c6d74ee38fa063f9a68db08fe7f09f99516f3fee07d5`. #1220 stays open; this branch copies those unique bytes and does not close that PR.
**Baseline:** `origin/main` `a7518e4785649f722dfc789be9ab94c4c14f2200`.
**Rule:** Pixie-Stix (Ed, 2026-10-08) — placement table first; copy + pointer later; originals stay; live database objects never move with files.

## Door used first

Claude / GOD FILE doc engine, not E84 hybrid.

| Probe | Result |
|---|---|
| `GET https://37-27-169-232.nip.io/relay/search-health` | HTTP 200. `file_count=59326`. `index_path=/opt/bgop/ai_search_index.json`. `index_loaded_at=2026-09-30T06:56:34`. `version=1.1.0` |
| `GET /relay/search-docs?q=ifttt` | `total_matches=600` |
| `q=iftt` | 696 |
| `q=iftt_engine` | 80 |
| `q=iftt_engine&type=py` | 13 |
| `q=ifttt&type=sql` | 13 |
| `q=ifttt&type=md` | 397 |
| `q=ifttt&type=py` | 104 |
| `q=ifttt&type=html` | 42 |
| `q=ifttt&native=1&ecosystem=E60` | 53 |
| `q=ifttt&native=1&ecosystem=E20` | 62 |
| `q=ifttt&native=1&ecosystem=E41` | 58 |
| `q=ifttt&native=1&ecosystem=E40` | 23 |
| `q=ifttt&native=1&ecosystem=E35` | 21 |
| `q=ifttt&native=1&ecosystem=E22` | 6 |
| `q=ifttt&native=1&ecosystem=E51` | 91 (mention / Nexus docs, not the engine body) |
| `q=ifttt&ecosystem=E91` | **0** |
| `q=IFTTT E91` | **0** |
| `q=PIXIE_STIX` | **0** (index predates the Oct 8–13 filing) |
| `q=UNIFIED_TRIGGER_FABRIC` | 36 |
| `q=BRAIN_PENTAD` | 204 |
| E84 `/relay/e84/search?q=iftt_engine` (exact token only; no hybrid) | `document_id=305007f1…`, `home_ecosystem=E60`, `duplicate_count=6`, related `E01,E30,E31` |

`L.parents` / `L.children` on the engine card are a mention-graph, not lawful parent-child. Read them as wiring hints. Confirm imports in the repo.

## Locked identity

| Item | Value |
|---|---|
| Empty IFTTT ecosystem number | **E91** |
| Ruling | Ed, 8 Oct 2026. Restated 13 Oct 2026 in `docs/canonical/ED_RULING_E92_E94_RESERVED_E107_NEXT_2026-10-13.md` |
| Engine body | `iftt_engine.py`, 202 lines |
| SHA-256 | `305007f1f877b759498663dca6949aea97041963b9809408c7269f564e1ebe80` |
| MD5 | `1721be3121cfd9c59204c62673f10fbb` |
| Git blob | `888eadfc7788acaf3505b5a8cd0e30319b48775b` |
| Search-docs native owner | `ne=E60` |
| Mention tags | `e=E60,e01,e30,e31` |
| `L.parents` | `[]` |
| `L.children` | `['E31']` |
| E91 folder on this checkout | **absent** |
| `ecosystems.yaml` | still `holes: [E91, E92, E93, E94, E95]` — stale vs the Oct 8 ruling |

Not E91: E92–E94 (held empty for later finds), E95 (dedupe/rollup), E107 (next new number after E94), E20 (gatekeeper), E40 (open claimant).

## Placement table

Nothing below has been placed.

| Piece | Class | Where it sits today | Engine / hash ties | Proposed E91 treatment | Missing |
|---|---|---|---|---|---|
| `iftt_engine.py` | NATIVE IFTTT | Four byte-identical copies at SHA-256 `305007f1…`: `ecosystems/e60/iftt_engine.py`, `ECO_CANONICAL/E60/code/iftt_engine.py`, `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/iftt_engine.py`, `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/ecosystems/e60/iftt_engine.py`. Plus sort-workspace copy and orphan variant `iftt_engine__2f021d.py` | search-docs `iftt_engine` type=py **13**; E84 family of **6** paths; `ecosystems/e60/__init__.py` re-exports `IFTTEngine`, `IFTTRule`, `SEED_RULES` | Copy onto E91 after a later named `AUTHORIZED`. Leave every current path untouched. Caller cutover is a separate tested step | Operation A authorization |
| Four seed rules | NATIVE IFTTT | Same engine file + `200_e60_nervous_net.sql` INSERT | Targets E30 / E01; budget rule also names E31 | Travel with the engine copy | None |
| `core.iftt_rules` / `core.iftt_rule_fires` | LIVE DB | Declared in `200_e60_nervous_net.sql` | Engine persists fires here | **Stay.** E91 documents them. No file job may relocate tables | Live existence unobserved this sitting (`/relay/nexus` HTTP 401) |
| `brain.triggers` | LIVE DB — E20 | E20 schema | Pixie-Stix scan: 905+ rules | **Stay.** E91 documents. Not a file move | Live count unobserved |
| `ifttt.rules` | Competing registry | Named canonical in `docs/canonical/UNIFIED_TRIGGER_FABRIC_2026-06-15.md`; `core.iftt_rules` named frozen | search-docs `UNIFIED_TRIGGER_FABRIC` **36** | **Stay** until Ed picks one registry. E91 points at both | Which table is live |
| `200_e60_nervous_net.sql` | SIAMESE FILE | Checkout twins SHA-256 `52e2c081f1ffb781…`: `database/migrations/200_e60_nervous_net.sql`, `ECO_CANONICAL/E60/sql/200_e60_nervous_net.sql`, plus orphans / rescue / archive | search-docs ifttt type=sql **13** | Do **not** move the file. Copy only the IFTTT sections into an E91 pointer doc. `core.cost_ledger` stays E60 | Split recipe in a later authorize |
| `tests/test_e60_rule_firing.py` | IFTTT consumer | `tests/test_e60_rule_firing.py` SHA-256 `9730141ed4a362c0…` | Imports `IFTTEngine`, `SEED_RULES` only | Copy a test onto E91 when the engine copy exists; leave the E60 test | None |
| `tests/test_e60_pentad_contract.py` | SIAMESE TEST | SHA-256 `2a62df04fd76b0cf…` at `tests/` and `ECO_CANONICAL/E60/tests/` | One file imports `CostLedger` **and** `IFTTEngine` **and** `MLOptimizer` | **Stay on E60.** A later E91 test is a new file, not a cut of this one | None |
| `ecosystems/e60/__init__.py` | HOST WIRE | SHA-256 `f7279f862cc5c1a0…` | Re-exports IFTTT names. Pull this file and E60 fails to import | **Stay.** Pointer only. Cutover later | None |
| `cost_ledger.py` / `ml_optimizer.py` | E60 HOST | `ecosystems/e60/` SHA-256 `76963e6c…` / `85211922…` | Not IFTTT | **Stay.** Host organ | None |
| `UNIFIED_TRIGGER_FABRIC_2026-06-15.md` | DESIGN | Canonical + E20 copies + `AGENT_BOOT/Claude Reference Files/CLAUDE_PLATFORM_KB_SPINUP_2026-07-24/05_TRIGGERS_IFTTT/` | search-docs native E20 ifttt **62** | Copy into E91 when approved. Originals stay. June text still names E40 as conductor — superseded by E91 | None |
| Volume XI / Devin 2026-08-28 trigger spec | DESIGN | AGENT_BOOT trigger shelves (Pixie-Stix Oct 8 scan) | Named on PR #1220 | Copy into E91 when approved | Exact current paths not re-hashed this sitting |
| `DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql` | DRYRUN MEMORY | `database/migrations/dryrun/` and `AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/` | search-docs ifttt type=sql hits | Copy into E91 when approved. Originals stay. Not apply | None |
| E41 `ecosystem_41_campaign_builder*.py` | INTEGRATION | Multiple copies; attaches IFTTT workflows | search-docs native E41 ifttt **58** | **Stay on E41.** E91 documents the attach seam | None |
| E40 admin dashboard HTML | NAME-ONLY | `ecosystem_40_admin_dashboard.html` copies | search-docs native E40 ifttt **23**; `e=E40` only | **Stay.** Not an engine | Ed ruling E40 vs E91 (still open on #1220) |
| E20 Brain / pentad / trigger-fabric docs | INTEGRATION | `BRAIN_PENTAD_CONTRACTS`, `E20_Brain_Canonical_Reference` | search-docs `BRAIN_PENTAD` **204** | **Stay on E20.** Gatekeeper is not IFTTT | None |
| E22 `event_tracker.py` | MENTION | search-docs `L.parents=['E30','E36']` | Token `ifttt` | **Stay.** Not an IFTTT body | None |
| E35 comm-hub py | MENTION | native E35 ifttt **21** | Token mention | **Stay.** Not an IFTTT body | None |
| E91 folder / roster row | EMPTY SHELF | No `E91/` on `a7518e478`. Roster and yaml still call E91 a hole | search-docs E91 **0** | One-line yaml/roster edits are proposed on #1220, not applied here | Separate `AUTHORIZED` |
| Pre-Oct-8 document that assigned IFTTT a number | — | — | — | **Not found** | — |

## How to cut the Siamese twin without crippling E60

1. This table is filed. Copies wait.
2. Operation A (later `AUTHORIZED`): copy `iftt_engine.py` (SHA-256 `305007f1…`) onto E91 and leave a pointer at every current path. Do not delete, rename, or move.
3. Leave `200_e60_nervous_net.sql` in place. The cost-ledger half is E60. The IFTTT tables stay in the live database and are documented from E91.
4. Leave `__init__.py` and `test_e60_pentad_contract.py` on E60 so the host still loads.
5. Operation B (later, separate `AUTHORIZED`): shim or cut over callers. Tests first. E60 must still import after the cut.

## False homes (do not revive)

| Claim | Source | Status |
|---|---|---|
| Conductor is E40 | `UNIFIED_TRIGGER_FABRIC_2026-06-15.md` §5 | Superseded 8 Oct 2026. E91 is the organ. E40 vs E91 still needs Ed's word |
| IFTTT belongs in E20 as T-codes | `ecosystems/e60/E60_SPLIT_ASSIGNMENT_2026-07-01.md` | Superseded 8 Oct 2026. E20 stays the gatekeeper |
| Move `iftt_engine.py` to E40 | June 28 historical audit | Forbidden. Move is demolition. E91 is copy + pointer |

## Inbound edges that break if the E60 file is pulled

Traced on `a7518e478`, not from `L.parents` (empty):

- `ecosystems/e60/__init__.py` — `from .iftt_engine import IFTTEngine, IFTTRule, SEED_RULES`
- `tests/test_e60_pentad_contract.py` — `from ecosystems.e60.iftt_engine import IFTTEngine` (Siamese with CostLedger + MLOptimizer)
- `tests/test_e60_rule_firing.py` — `from ecosystems.e60.iftt_engine import IFTTEngine, SEED_RULES`
- Outbound: `from shared.brain_pentad_contracts import CostEvent, RuleFired` — shared contract, do not tidy

Companion doctrine on main: `docs/audits/drift-worklist-2026-10-09/WHY_REMOVING_ONE_FILE_HAS_CONSEQUENCES_IFTTT_2026-10-09.md`.

## What this filing does not do

- Does not create `E91/` or any ecosystem folder.
- Does not copy, rename, move, or delete `iftt_engine.py` or SQL.
- Does not edit `ecosystems.yaml`, the Sep 13 roster, or copilot-instructions.
- Does not apply dryrun SQL or touch sacred tables.
- Does not call `/relay/e84/hybrid`.
- Absorbs the unique #1220 docs (Pixie-Stix six-copy warning, E91 ruling, session transcript, #1220 manifest) by copy onto this branch. Does not close #1220. Does not take #1220's `PR_REGISTRY.json`.
