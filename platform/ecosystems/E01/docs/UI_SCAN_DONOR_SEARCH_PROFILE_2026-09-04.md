# UI scan — donor search / profile surface on main (2026-09-04, via GitHub API)

Scope: `frontend/` live tree + `ECO_CANONICAL/*/frontend` + `api/`. Archive/recovery copies excluded (they are memory, not workspace).
Tree returned 45,371 entries (truncated flag = true) — counts below are lower bounds.

## What is live under frontend/ (56 files)

| File | Size | Status | Backend | Notes |
|---|---:|---|---|---|
| candidate-portal/donor-search.html | 35 KB | WIRED but ORPHANED | `http://37.27.169.232:8081` → `/search/donors`, `/donor/{cluster_id}`, `/search/suggest` | Fields: query, first, last, zip, county, employer, committee, cluster, amt min/max, date from/to, match_tier. Detail panel w/ transactions, CSV export, autocomplete. **No service in repo answers those routes on :8081.** |
| candidate-portal/donors-all.html | 90 KB | STATIC MOCK | none | "Apple-style" fonts, Tabler icons, hardcoded rows, saved-view modal |
| candidate-portal/donors-top-ai.html | 49 KB | STATIC MOCK | none | AI panel, no fetch |
| candidate-portal/ecosystem-donor-intelligence{,-dual,-triple}.html | 24–29 KB | STATIC | none | grade explainer pages |
| command-center/DONOR_PROFILE_JAMES_WILSON.html | 22 KB | STATIC MOCK | none | fake donor, 0 element ids |
| ECO_CANONICAL/E01/frontend/E01_NC_FIRST_DONOR_EXPLORER.html | 8 KB | THIN | inline | q/county/tier/sort, cluster_id keyed |
| candidate-portal/scripts/seamless-filter-builder.js | 11 KB | LIB | client-side | SIC presets + `MICROSEGMENT_PRESETS` (vocabulary-ruling violation) — extracted from prototypes/donor-search-demo-2025-05 |
| candidate-portal/library-search.html | 11 KB | E84 UI | AX41 | not donor |
| candidate-portal/campaign-wizard*.html | 34–49 KB | E68 | wizard API | not donor |

Inspinia: **0 references** in any of the donor pages above. `frontend/inspinia/` holds the theme (34 HTML) but the donor pages don't use it. The "clients.html / donors.html, never pages-profile.html" rule in the spec template has no live donor page honoring it.

## The backend that exists

`api/donor_search_api.py` (27 KB, June 2026, FastAPI, port **8282**):
- `GET /search` — **geo_type + geo_value REQUIRED** (county|municipality|precinct|nc_house|nc_senate|us_house|da|statewide), office filter, period, grade_min, affinity_only. No name search, no employer, no include/exclude, no And/Or.
- `GET /autocomplete` (geography only), `/volume*`, `/campaigns*` (event invitations), `/health`.
- Reads **`search.donor_search_index`** (materialized, keyed on `rnc_regid` — so ~86K unstamped clusters are invisible), `volume.v_effective_volume`, `search.geography_lookup`, `campaigns.*`.
- Verified live column names it relies on: `spine.donor_transactions.donation_date`, `.amount`, `.rnc_regid`; index cols `display_name, grade_state/rank_state (+county/district), total_all_time, first_gift_date, last_gift_date, cell_phone, home_phone, personal_email, street1, city, employer, microseg_flags`.
- Redis-first cache, Postgres fallback. DB password hardcoded as DSN default.

**Mismatch:** the only wired page (donor-search.html) calls `/search/donors` on :8081; the only API serves `/search` on :8282 with a different contract. Neither side can talk to the other as committed.

## What this means for the Donor Atlas build

1. Adapter fix applied: `atlas.v_gift` now maps `spine.donor_transactions.donation_date` (not `gift_date`) — caught by this scan.
2. Keep `atlas.mv_search_doc` keyed on **cluster_id** (all 246,965 donors), LEFT JOIN `search.donor_search_index` on rnc_regid for phones/emails/rank cols when present — don't fork the grade columns, read theirs.
3. Retire `MICROSEGMENT_PRESETS` in seamless-filter-builder.js → DONOR GROUP presets driven by `/api/atlas/donors/groups`.
4. donor-search.html's field set is a subset of the Atlas filter schema; the Atlas search page supersedes it. Suggest the Atlas API also answer donor-search.html's three routes as aliases so the existing page lights up on day one.
5. Static mocks (donors-all, donors-top-ai, DONOR_PROFILE_JAMES_WILSON) carry no logic worth porting — layout reference only.
