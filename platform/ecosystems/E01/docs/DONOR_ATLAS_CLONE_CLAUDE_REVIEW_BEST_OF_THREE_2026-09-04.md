# Donor Atlas — Claude clone review + best-of-three collision map (E01)

**Date:** 2026-09-04
**Author:** Devin (COO / ledger)
**Status:** SHELF + REVIEW. No Hetzner apply. No new ecosystem. Slot ruling pending (Ed).
**Ed's frame (2026-09-04, verbatim):**

> we have the ecosystems that outperform this app but this app works and is operational. Furthermore the user interface that displays donors profile is exactly what I want for users to see. I asked Claude to modify this app to integrate in our platform. I have no doubt in messed up a lot but at least tried. There are 2?other apps we have modeled in that ecosystem and we need to take the best of all them. I think after we reorganize the donor database to reflect all the whopper docs then this ecosystem modules integrated needs to work first with wizard of oz. If these modules work well then we are assured of having sour core weapons working with wizard and our database is tied in properly. All else builds off that.

Governing reading: the **Atlas donor card is the target user experience**; Claude's clone is **absorbed, not rejected**; the three donor-explorer implementations now on the shelf get **merged into one E01 explorer**, aimed at the **Whopper-reorganized database**, proven **through the Wizard of Oz first**.

---

## 0. Receipts — what was and was not verified this sitting

| Check | Result |
|---|---|
| Sacred canary via relay (`https://37-27-169-232.nip.io/relay/nexus`, and `:8080`) | **UNREACHABLE** — timeout, no body. Ed: Hetzner bill outstanding, paying tonight. Not a canary failure. |
| E84 `/library/v2/search` (AX41 144.76.219.24) | **UNREACHABLE** — timeout. Same Hetzner account. E84 search is **owed** before any remap/apply (gate 0 below). |
| Live `information_schema` for Atlas §1 pre-flight columns | **NOT RUN** (relay dark). |
| Package integrity | zip sha256 `3526ff9d…f6171`; 25 zip entries = 13 source files + 2 `__pycache__/*.pyc` + directories (see §2.4). `ATLAS_README.md` and `ECO_STATE_E100_2026-08-12.md` attachments are byte-identical to the copies inside the zip. |
| Python | `py_compile` PASS on `donor_atlas_api.py` (852 lines) and `ecosystem_donor_atlas.py` (105 lines). |
| SQL | read in full (423 lines); **not parsed or executed** — Claude's "45 statements parse" is his claim, not reproduced. |
| Repo history | PR #841 (Cursor, `b252ec91a` + `7ad364bc7`) merged to main 2026-09-04: a *separate* DonorAtlas adaptation on the E01 shelf. |

Nothing in this document asserts live platform state. Every column-name judgment in §3 is **repo-evidence prediction**, to be settled by the ROLLBACK-mode pre-flight run.

---

## 1. Where the bytes are (absorb-not-discard)

| Artifact | Path | Bytes |
|---|---|---|
| Claude package, verbatim (13 files + original zip) | `AGENT_BOOT/ECOSYSTEM FILES/E01/NONDEPLOYED_ORPHANS/DONOR_ATLAS_CLONE_CLAUDE_2026-09-04/` | unmodified |
| Claude SQL as a dry run | `database/migrations/dryrun/DRYRUN_E01_DONOR_ATLAS_CLAUDE_ATLAS_001_2026-09-04.sql` | header + `COMMIT`→`ROLLBACK` only; ledgered PENDING_AUTHORIZATION |
| Cursor adaptation (PR #841) | `ECO_CANONICAL/E01/docs/NC_FIRST_DONORATLAS_ADAPTATION_2026-09-04.md`, `…/DONORATLAS_COLLISIONS_SORT_LATER_2026-09-04.md`, `ECO_CANONICAL/E01/code/nc_first_donor_explorer.py`, `ECO_CANONICAL/E01/frontend/E01_NC_FIRST_DONOR_EXPLORER.html`, `database/migrations/dryrun/DRYRUN_E01_NC_FIRST_DONOR_EXPLORER_VIEWS_2026-09-04.sql` | already on main |
| Existing donor search (June 2026) | `api/donor_search_api.py` (:8282), `frontend/candidate-portal/donor-search.html` (calls :8081 — orphaned) | already on main |

Placement reasoning: `ECO_CANONICAL/E01/INDEX.md` entry rule requires transaction-wrapped, idempotent, canary-gated, **writes `ops.deploy_log` at apply time, declares rollback**. Claude's SQL is transaction-wrapped, canary-gated and mostly idempotent (`IF NOT EXISTS`) but writes no `ops.deploy_log` row and declares no rollback stanza — so it stays on the orphan shelf + dryrun until promoted by Ed ruling (copy only).

---

## 2. The three apps on the E01 shelf

Ed: "There are 2 other apps we have modeled in that ecosystem." Present on the shelf today:

| # | App | Author / date | What it is | Keyed on | Backend | UI | DB objects |
|---|---|---|---|---|---|---|---|
| A | **Claude Donor Atlas clone** | Claude, 2026-09-04 | Full workspace: search + donor card + org + lists + alerts; FastAPI :8093 | `cluster_id`, `rnc_regid` read beside | 30 routes, whitelist filter compiler, access log | 5 Bootstrap pages + `atlas.js` | `atlas` schema: 2 views, 8 tables, 4 MVs, 3 functions |
| B | **Cursor E01 NC First explorer** | Cursor, 2026-09-04 (PR #841) | Thin read-only explorer over fixture JSON or optional DB | `cluster_id` | `nc_first_donor_explorer.py` (285 lines) | `E01_NC_FIRST_DONOR_EXPLORER.html` (8 KB, Inspinia tokens) | `e01` schema: 3 views (dryrun, PENDING) |
| C | **Existing donor search API + page** | June 2026 | Geo-required search over `search.donor_search_index`; volume + campaign routes | `rnc_regid` (~86K unstamped clusters invisible) | `donor_search_api.py` :8282, Redis-first | `donor-search.html` (35 KB) wired to :8081 — no service answers | reads `search.*`, `volume.*`, `campaigns.*` (live) |

If Ed's "2 other apps" means something other than B and C (e.g. the DonorAtlas paid-landing dump absorbed in #841, or the Diamond Vault `ecosystem_profile_enhancements_complete.py` profile spec), name it and it joins this table — nothing here is closed.

### 2.4 Package defects noted (Claude clone)

1. **Missing doc.** README's file table lists `docs/DONORATLAS_VS_BGOP_GAP_2026-09-04.md` — **absent** from the zip (25 entries = 13 source files + 2 stray `.pyc` caches + dirs). Either lost in packaging or never written; ask Claude for it before calling the package complete.
2. **Two column-name assertions the UI scan itself flags as VERIFY** (`raw.ncboe_donations` TransInq header names and `raw.fec_donations` FEC header names). §3.1 below.
3. **`atlas.v_person` reads `core.donor_profile.first_name / last_name / address1`.** Repo-wide references to `core.donor_profile.` columns: `display_name` ×25, `lifetime_total` ×34, `zip5` ×23, `first_name` ×1, `last_name` ×0, `address1` ×0. Cursor's view (B) uses `display_name`. **Prediction:** Claude's `first_name/last_name/address1` will trip §1 pre-flight; remap to `display_name` (+ whatever name parts exist live). Unverified until relay is back.
4. **Ignores the verified crown column.** `core.donor_profile.lifetime_total` (live-verified $332,631.30 for cluster 372171, `BGOP_PRIMARY_DONOR_DB_AUDIT_AND_REMEDIATION_PLAN_2026-08-12.md`) is not read; Atlas recomputes political totals into `atlas.mv_donor_summary`. Recomputing is fine as a *check*, but the card must reconcile to the crown or explain the delta — otherwise two totals for one donor.
5. **Heavy MVs.** `atlas.mv_donor_summary`, `mv_donor_year`, `mv_search_doc` full-scan `raw.ncboe_donations` + `raw.fec_donations` (1.5M+ rows). Runtime estimate required before any live `refresh_all()`.
6. **DataTables server-side ordering interpolates `order_col`** into SQL — it is whitelisted first (`cols` set), so safe; noted because it is the one f-string SQL in the file.
7. **`/api/atlas/donors/{id}/affiliations` POST writes `atlas.affiliation`** — a user write path. Acceptable in an `atlas`-owned table, but the card must label it "manual overlay" (it does) and E96 must never read it as a lens input without provenance.
8. **Motive probes three table names** (`core.donor_donation_features`, `race_relational.donor_passion_vector`, `e96.lens_result`) none of which is confirmed live; honest fallback "not computed — D3 pending" is correct behavior.
9. **E96 edge probes three table names** (`e96.relationship_edge`, `e96.relationship_edges`, `lens.relationship_edge`) — E96 schema is **not deployed** (E96 doctrine 2026-08-18). Reads will return `available:false`; correct honest behavior, but the contract name must be pinned once E96 lands (§5).
10. **API key + user headers, no role model.** Every route trusts `x-user` as asserted by the client. Fine behind the candidate-portal gateway; not fine exposed. Silo law (`broyhillgop-ncgop-architecture`) requires candidate-scoped access — Atlas logs `candidate_id` but never filters by it. Corollary (Devin Review, PR #846): any holder of the one shared `ATLAS_API_KEY` can impersonate any user by setting `x-user`, reaching that user's lists, saved searches, alerts and exports.
11. **List members leak by id.** `GET /api/atlas/lists/{list_id}/members` checks `owner_user` only in the COUNT query; the row query joins `prospect_list_member` → `mv_search_doc` with no ownership predicate, so any authenticated caller who guesses a `list_id` gets its donor rows (count reads 0, data is full). `lists_remove` and the other list routes do filter by owner — this one route is the miss. Must be fixed in the best-of implementation; not patched in the verbatim shelf copy.
12. **CORS default `*`.** `ATLAS_CORS` unset → `allow_origins=["*"]`, all methods, all headers. Fine for localhost dev; must be pinned to the portal origin before any deploy.
13. **Shared API key in `localStorage`.** `atlas.js` login form stores `ATLAS_API_KEY` client-side, readable by any script on the origin. Combined with 10, one XSS = every user's workspace. The best-of build should replace the shared key + `x-user` pair with the portal's per-user session (gateway-issued), not ship this login form.

Items 10–13 are recorded here as **blockers for the best-of implementation**; the shelf copy under `NONDEPLOYED_ORPHANS/` stays byte-verbatim per absorb-not-discard and is not a deployable artifact.

---

## 3. Collision map — Claude SQL vs Cursor SQL vs live

### 3.1 Upstream columns Claude's §1 pre-flight expects (repo evidence, live unverified)

| Object.column | Repo evidence | Risk |
|---|---|---|
| `raw.ncboe_donations.transction_type` (sic) | canon spelling, many refs | low |
| `raw.ncboe_donations.date_occured` (sic) | canon spelling, many refs | low |
| `raw.ncboe_donations.norm_amount`, `cluster_id`, `rnc_regid`, `committee_sboe_id`, `committee_name`, `candidate_referendum_name` | referenced in welds/dryruns | low–med (`candidate_referendum_name` least cited) |
| `raw.fec_donations.transaction_amt`, `transaction_dt`, `cmte_id`, `cand_id`, `cluster_id`, `rnc_regid` | FEC bulk header names; `rnc_regid`/`cluster_id` on raw FEC is the **VERIFY** item Claude flagged | **med–high** |
| `committee.office_type_map.committee_id`, `office_type`, `office_level` | referenced in office-hierarchy doctrine | med |
| `core.donor_profile.first_name`, `last_name`, `address1` | ~0 repo refs (see §2.4-3) | **high — expect drift** |
| `core.donor_profile.display_name`, `lifetime_total`, `grade_state/district/county`, `rank_state`, `zip5`, `county`, `employer`, `occupation`, `committees_sboe_ids` | heavily referenced; `lifetime_total` live-verified 08-12 | low |
| `search.donor_search_index.*` | column list documented in Claude's UI scan from `donor_search_api.py` | low–med |
| `race_relational.donor_office_class_fingerprint` | E77/race-relational lane | med (table exists per skill; column shape unverified) |
| `spine.donor_transactions.donation_date`, `amount`, `rnc_regid` | Claude corrected `gift_date`→`donation_date` from the UI scan | low |

**The ROLLBACK-mode run of the dryrun file is the remap list.** Nothing above is a reason to edit the SQL blind.

### 3.2 Object-level collisions

| Claude (`atlas.*`) | Cursor (`e01.*`, PENDING) | Existing live | Ruling needed |
|---|---|---|---|
| `atlas.v_person` | `e01.v_nc_first_donor_directory` | `core.donor_profile` (spine), `search.donor_search_index` | **Same ground, two views.** One survives; other absorbed. |
| `atlas.v_gift` (NCBOE ∪ FEC, `is_political` flag) | `e01.v_nc_first_contribution_gold` (NCBOE Individual only) | `spine.donor_transactions` | Claude's is broader (FEC + proof rows). Prefer Claude's shape; keep Cursor's gold-only filter as the `is_political=true` case. |
| `atlas.mv_committee_summary` | `e01.v_nc_first_org_tattoo` (from `committees_sboe_ids`) | `committee.*` | Different sources for "organization"; Cursor's reads the tattoo, Claude's rolls up gifts. Both useful; document ownership. |
| `atlas.affiliation`, `atlas.organization` | — | E61 affiliation/board tables, E96 (undeployed) | Manual overlay only. Must not become a second affiliation graph. |
| `atlas.saved_search`, `prospect_list*`, `tracked_donor`, `alert`, `access_log` | — | `campaigns.*`, brain triggers (590), `ops.*` | Atlas-owned workspace tables — **additive, low collision**. Alerts must not duplicate brain triggers: Atlas alert = "saved search delta", brain trigger = firing rule. |
| `atlas.co_givers()` | — | E96 lens (undeployed) | Evidence function, not a score. Keep; label "filed co-giving". |
| `atlas.mv_search_doc` (tsvector, cluster-keyed, all 246,965) | — | `search.donor_search_index` (rnc-keyed) | Claude's fixes the ~86K-invisible problem. **Best-of winner** for search doc, LEFT JOINing the existing index for phones/emails as his UI scan proposes. |

### 3.3 Vocabulary ruling
Claude's API header honors "DONOR GROUP / DONOR UNIVERSE / STAKE GROUP — never microsegment (ruling 2026-07-27)". Cursor's UI scan flags `MICROSEGMENT_PRESETS` in `seamless-filter-builder.js` as a live violation. Best-of explorer inherits Claude's vocabulary.

---

## 4. Best-of-three capability matrix

Legend: **A** Claude clone · **B** Cursor E01 explorer · **C** existing donor_search_api · **—** none · **E##** belongs to that eco, explorer reads only.

| Capability | Winner | Why | Absorb from others |
|---|---|---|---|
| Donor search — filter mechanics (And/Or, include/exclude, live count, facets) | **A** | Whitelisted, parameterized compiler; 40 fields; nested groups | C's geography types (county/municipality/precinct/nc_house/nc_senate/us_house/da/statewide) as filter fields |
| Donor search — universe coverage | **A** | cluster-keyed doc, all donors | C's phone/email/rank columns via LEFT JOIN on rnc_regid |
| Donor search — geography semantics | **C** | `search.geography_lookup`, precinct/district lanes are live and E77-aligned | A gets `geo_type/geo_value` fields backed by C's lookup |
| **Donor card / profile UI** | **A** (Ed's ruling: target UX) | Half B × Half A, Triple Grade, timeline, recipients, server-side contributions, patties, silver, fingerprint, capacity, E96 network, similar, track | B's Inspinia tokens (frontend law); C's contact columns |
| Half B political giving (gold filter) | **A** | NCBOE Individual + FEC cand_id; proof rows shown, never summed | B's gold view as the formal `is_political` definition |
| Half A enrichment display | **A** (thin) | reads `core.donor_profile` + capacity block | Whopper reorg supplies the real Half A patty reads (§5) |
| Triple Grade | **A**=**B**=**C** (all read E01 grades) | none recompute — correct | — |
| Office-class fingerprint | **A** | reads `race_relational.donor_office_class_fingerprint` in place | — |
| Capacity | **A** | ungated capacity block | reconcile with `lifetime_total` crown (§2.4-4) |
| E96 network display | **A** | reads E96 when melded, filed co-giving otherwise; **never scores** | pin contract name when E96 deploys |
| Motive / D3 contract | **A** | honest "not computed — D3 pending" | — |
| Groups / saved searches | **A** | Groups/Donors toggle; saved search + run | — |
| Alerts / tracking | **A** | saved-search delta alerts, tracked donors | must not shadow brain triggers |
| Lists / CSV export | **A** | prospect lists + export, access-logged | — |
| Organization page | **A** + **B** | A: gift rollup per committee; B: tattoo view | both |
| Access logging | **A** | every search/profile/export/capacity logged | add candidate silo filter |
| Frontend stack law | **B** | Inspinia tokens (guardrails) | A's card **information architecture** ported onto Inspinia — not A's Bootstrap/Chart.js as-is |
| Tests without Hetzner | **B** | fixture-driven test | A and C have none — B's pattern becomes the harness |
| Redis caching | **C** | live pattern | optional for A's count/facet routes |
| **Wizard integration** | **—** | none of the three hand a donor group to E68 | §5 |
| **Core-weapon handoff** | **—** | none | §5 (through E68 → E20 only) |

Net: **A is the body, B is the skin + test harness, C is the geography + contact plumbing.** One E01 explorer, `cluster_id`-keyed, Inspinia-rendered, reading everything in place.

---

## 5. Order of operations (Ed's sequence, made concrete)

Ed: "after we reorganize the donor database to reflect all the whopper docs then this ecosystem modules integrated needs to work first with wizard of oz."

| Gate | Step | Owner | Exit receipt |
|---|---|---|---|
| 0 | E84 search for `donor atlas`, `donor explorer`, `donor card`, `e01 search`; live `information_schema` for every §3.1 column | Devin | search hits listed; column drift list from ROLLBACK run of the dryrun |
| 1 | **Whopper reorg of the donor DB** — Half A patties (DataTrust bun, Acxiom ×4, Personicx, Bespoke) and Half B gold/silver patties readable per `cluster_id`/`rnc_regid`; E13 tattoo + E96 versioned contract lanes defined | per Spine Weld Plan + PIM/E96 docs (PRs #635–#637) | canary pass; per-patty row counts; one donor (372171) renders all patties |
| 2 | **Best-of explorer** — A's card + API on B's Inspinia skin + C's geography, against gate-1 objects. Single dryrun file replaces both pending E01 dryruns (absorbing both, ledgered) | Cursor (code) / Devin (verify) / Claude (card IA review) | ROLLBACK pre-flight clean; fixture tests pass; card for 372171 reconciles to $332,631.30 |
| 3 | **Wizard of Oz first** — explorer's Donor Group → E68 audience lock → E20 OBSERVE mode → 2–3 weapons (E30 email, E31 SMS, E33 mail) marked delivered, **zero real sends** → one `ops.variance_ledger` row | E68/E20 lanes | one donor group flows end to end with receipts; canary before/after |
| 4 | Core weapons proven live behind the Wizard (separate Ed "Authorized" per weapon) | CAT4 lanes | — |

Slot ruling for Ed (one line): **E01 owns the data and the explorer; E25 (Donor Portal) may surface the same card to donors later.** Claude filed "E25 surface / E01 data owner"; Cursor filed "E01, E25 stays the portal." These agree — recommend ratifying as written.

---

## 6. Hard stops carried forward

- No apply of either E01 dryrun without Ed's "Authorized" against the **filename**.
- No parallel `donor_id` table; no new ecosystem number; no independent relationship scoring (E96 owns the lens — one pass, sniper not birdshot, per E96 clarification PR #636).
- Sacred tables read-only. Canary before and after any write.
- Do not delete/rename anything in either shelf; promotion is by copy after Ed's ruling.
- E84 search (gate 0) is owed and blocks code work until AX41 is back.
