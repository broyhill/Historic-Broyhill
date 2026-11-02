# E91 — IFTTT — Ed's ruling, October 8, 2026 (filed October 13)

**Authority:** Ed Broyhill, Oct 8, 2026 chat ("Oct 8 ifttt"), recorded in the Oct 9 session record "Pixie-Stix Warning". That record's original sha256 is `dfd83e480d9605a10278c6d74ee38fa063f9a68db08fe7f09f99516f3fee07d5` (Ed's attachment, Oct 13; same text as the Google Drive copy in `Gemini Gems/`).
**Filed by:** Nexus, Oct 13, on Ed's instruction: "can you pr this for main. and in several places."
**Status:** Ruling record. Docs only. Nothing is moved, renamed, deleted, or built by this file.

**2026-10-17 addendum (Cursor, Ed `AUTHORIZED` to file the table onto this shelf):** the search-docs placement table is `docs/canonical/E91_IFTTT_PLACEMENT_TABLE_2026-10-17.md`. The first-draft table later in this file stays as the Oct 13 record. Nothing has been placed. No `E91/` folder. No engine copy.

## The ruling

1. **IFTTT is its own independent organ,** not a function inside E20. Enterprise systems depend on the commercial IFTTT as one dedicated service doing one undiluted job, and the platform's version must be the same kind of thing.
2. **Its number is E91.** Ed lifted the agents' "holes do not exist" rule for E91 only. E92–E95 remain holes.
3. **Nothing moves.** E91 is built by reference and copy:
   - core IFTTT pieces get a copy in E91 and a pointer left in the original home;
   - shared runtime objects stay where they are, and E91 documents them;
   - anything the record does not settle is marked "not found" and not placed.

## The Pixie-Stix rule (Ed-approved, Oct 8)

- **Placement table first.** No agent places, moves, copies, or renames anything under an ecosystem without a placement table Ed has approved. The table records:
  - what the piece is;
  - where it sits today;
  - which document supports the placement;
  - what is missing.
- **Silence means stay put.** Where the record is silent, the table says "not found" and the piece stays where it is.
- **Copy and pointer, never move.** Reassembly is by reference and copy. A cutover of callers is a separate step, with its own tests and Ed's OK ASSIGN.
- **No live database objects** are ever part of a file reorganization.
- **Same-day filing.** Rulings go into the repo the same day.

## IFTTT placement table: first draft, for Ed's approval

From the Oct 8 read-only scan in the Pixie-Stix Warning, checked against `main` at `deadf63`. **Nothing below has been placed.**

| Piece | Where it sits today | What ties it down | Proposed E91 treatment | Supporting document |
|---|---|---|---|---|
| `iftt_engine.py` (202 lines, md5 `1721be3121cf`; git blob `888eadfc`) | **5** byte-identical copies on `main` at `deadf63` (the Oct 8 scan counted 4): `ecosystems/e60/` (live), `ECO_CANONICAL/E60/code/`, `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/`, `STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/ecosystems/e60/`, `AGENT_BOOT/ECO_LIBRARY_MULTIAGENT_SORT_WORKSPACE_2026-07-27/…/_live_ecosystems_py/e60/`. Also a differing variant: `AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/iftt_engine__2f021d.py` | E60 `__init__.py` imports it; E60 tests import `ecosystems.e60.iftt_engine` | Copy into E91 with a pointer; E60 copy untouched; caller cutover is a separate tested step | Pixie-Stix Warning; `docs/audits/drift-worklist-2026-10-09/WHY_REMOVING_ONE_FILE_HAS_CONSEQUENCES_IFTTT_2026-10-09.md` |
| `brain.triggers` (905+ rules) | E20 database schema | Live table | **Stays.** E91 documents it; never part of a file reorganization | Pixie-Stix Warning |
| E40 "Automation Control Panel (IFTTT-style)" | Registered lane E40 | Second claimant to the same function | Not found: no ruling yet on E40 versus E91. Ed to rule | `ecosystems.yaml` (E40) |
| Marketo-mechanics dry run | Filed under both E20 orphans and E41 | Same document, two homes | Copy into E91 when approved; originals stay | Pixie-Stix Warning |
| Volume XI Triggers; Unified Trigger Fabric; Devin design spec 2026-08-28 | `AGENT_BOOT` trigger docs and the spec | Design never assigned a number | Copy into E91 when approved | Pixie-Stix Warning |
| Document assigning IFTTT a number before Oct 8 | — | — | **Not found** | — |
| Ed's earlier "broke down IFTTT to clone" session | — | — | **Not found** | — |

## Files that still contradict this ruling (proposed one-line amendments; not applied here)

The Nexus boot forbids Nexus from editing another AI's instruction files, so these are proposals only. Ed or each file's owner applies them.

| File | Current line | Proposed line |
|---|---|---|
| `ecosystems.yaml` line 8 | `# Holes E91-E95 do not exist. E101+ are file-doc lanes.` | `# E91 = IFTTT (Ed ruling 2026-10-08, docs/canonical/E91_IFTTT_RULING_2026-10-08.md). Holes E92-E95 do not exist. E101+ are file-doc lanes.` |
| `ecosystems.yaml` line 23 | `holes: [E91, E92, E93, E94, E95]` | `holes: [E92, E93, E94, E95]`, plus a `registered:` row `{ code: E91, name: IFTTT, ruling: docs/canonical/E91_IFTTT_RULING_2026-10-08.md }` |
| `.github/copilot-instructions.md` line 33 | `Holes E91–E95 do not exist. Do not create them.` | `E91 = IFTTT (Ed, 2026-10-08). Holes E92–E95 do not exist. Do not create them.` |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/NEXUS_STARTUP_2026-09-24.md` line 135 | `Never create E91-E95` | `E91 = IFTTT (Ed, 2026-10-08); never create E92-E95` |
| `docs/canonical/REGISTERED_PLATFORM_ROSTER_2026-09-13.md` lines 18 and 79 | "Holes E91–E95 are not created" | Add a dated note: "E91 chartered as IFTTT by Ed, 2026-10-08" |

## Where the Pixie-Stix Warning is filed (this PR; byte-identical copies, sha256 `dfd83e48…07d5`)

| Path | Why it belongs there |
|---|---|
| `docs/canonical/PIXIE_STIX_WARNING_2026-10-09.md` | Canonical ruling shelf |
| `docs/canonical/grand-audit/CAT3/PIXIE_STIX_WARNING_2026-10-09.md` | CAT3 "The Brain & Decisioning": E20, E60, and the IFTTT scatter |
| `docs/audits/drift-worklist-2026-10-09/PIXIE_STIX_WARNING_2026-10-09.md` | Beside Claude's IFTTT worked example and the drift-cluster worklist |
| `sessions/SESSION_TRANSCRIPT_2026-10-09_PIXIE_STIX_WARNING_IFTTT_E91.md` | It is the Oct 9 session record |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PIXIE_STIX_WARNING_2026-10-09.md` | Nexus reference shelf, read at boot |
| `AGENT_BOOT/NEXUS-Perplexity Reference Files/PUBLIC_MEMORY_SHELF_2026-09-27/COPY_PIXIE_STIX_WARNING_2026-10-09.md` | Public memory shelf (copy-only shelf) |

## Open for Ed

1. Approve or change the IFTTT placement table.
2. Apply the one-line amendments above, or authorize their owners to.
3. Rule on E40 versus E91.
4. Rule separately on E95, which is assigned in the Oct 8 constitution draft.
