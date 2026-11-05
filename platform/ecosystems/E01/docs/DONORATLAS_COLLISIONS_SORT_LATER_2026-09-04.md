# DonorAtlas dump — collisions / SORT_LATER

**Date:** 2026-09-04
**Source:** `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf`
**SHA-256:** `31041950f804930f1fdc7dc20bc3e767ed3d8a0540d6c8d1d54b8cfcd9f91c60`
**Rule:** existing BroyhillGOP objects win. Do not rebuild. Do not apply anything from this dump.

Hetzner/AX41 were dark this sitting (relay canary timeout; E84 hybrid timeout). Live `information_schema` was **not** re-checked. Collisions below are from repo canon + last verified prose, not a live row-count proof.

## Binding lane facts (do not violate)

| Dump claim | BGOP object that already owns it | Action |
|---|---|---|
| New eco / "DonorAtlas lane" | E01 competitor class (`ECO_MODEL.md` Surpasses: DonorSearch, iWave, WealthEngine, …) | Park in E01 docs only |
| Social coalition / LinkedIn clone | NC UNITED (`NCUNITED.com`); E85 empty reserved | Do not park in E25 |
| Donor portal receipts/giving | E25 = donor portal | Do not dump social or explorer UI into E25 |
| NO OWNER parking lot | E102 = NO OWNER (Ed 2026-09-01) | Do not dump DonorAtlas there |
| OCKTOPOST social | E101 numbered parking lot only | Unrelated |

## Identity / schema

| Dump | Existing law | Do not |
|---|---|---|
| `donor_id` PK on a new Donor Table | `cluster_id` INTEGER; `core.donor_profile` | Create a parallel donor table |
| `full_name`, address fields as source of truth | Identity pipeline Stage A/B/C; spine GOLD = NCBOE Individual + FEC `cand_id` | Rebuild identity |
| `address_hash` | Existing match/hash paths on the person spine | New hash namespace |
| `aggregated_lifetime_value` | E01 triple grading + E06 RFM / LTV skills | New LTV table |
| Contribution table `donor_id` → `recipient_id` | `raw.fec_donations` exists; `raw.ncboe_donations` sacred READ ONLY; `spine.donor_transactions_deduped` | New contribution warehouse |
| `filing_source` FEC vs IRS | FEC ingest + charity/990 officer pull already in pipeline (`pipeline/fec_raw_import.py`, `pipeline/charity_990_officer_pull.py`) | Parallel FEC/IRS ETL |
| Org table `ein_fec_id` | Endpoint registry: controlled keys `cluster_id`, `ein` | Free-text org ids |
| Affiliation / board interlocks | Charity network / foundation grants already on platform (Diamond Vault + E01 notes) | New affiliation graph schema |

Sacred tables remain untouched: `raw.ncboe_donations`, `core.di_donor_attribution`, `core.datatrust_voter_nc`, `core.acxiom_ibe`.

## Triggers / search / brain

| Dump | Existing law | Do not |
|---|---|---|
| Cron/webhook FEC + IRS ingest | E61 Dark Donor / source ingest; E62 FEC history feed into E01 | New ingest eco |
| Saved-search alerts / "tracked donor filed" | Extend `brain.triggers` / `ifttt.rules` only | Parallel trigger catalog |
| UI state triggers | Frontend: Inspinia `clients.html` / `donors.html`; Wizard E68 | Next.js/Tailwind explorer as a new surface |
| Elasticsearch / Postgres FTS for donors | E84 library door (`/library/v2`, hybrid `search-docs`); person search is not a new ES cluster | Stand up ES "for DonorAtlas" |
| REST `/api/v1/donors/{donor_id}/…` | `cluster_id` INTEGER; existing portal/API surfaces | Copy their URL shape |

## CRM / integrations / pixels

| Dump | Existing law | Do not |
|---|---|---|
| Salesforce / HubSpot / NGP VAN fabric | D365 CRM already registered (SPINE_INDEX on Claude PR #818 `b4da362e1`; Cursor pointer #822). E15 ECO_MODEL already lists Dynamics 365 / NGP VAN in Surpasses | Rebuild Salesforce fabric |
| Neon One / Bloomerang | E01 already lists Bloomerang in Surpasses | New fundraising CRM |
| GTM `G-WTM3XSDRZX` | Their marketing property, visible in `utm_medium=paid` | Copy as ours |
| Meta Pixel / Tally.so demo forms | Paid-landing conversion stack | Install their pixels or Tally embed |

## AI / NLP

| Dump | Existing law | Do not |
|---|---|---|
| Fuzzy "John Smith at Microsoft" across FEC + 990 | E00 person spine; Splink Stage A/B/C; E56 visitor deanon | Parallel entity-resolution engine |
| "Hidden Gems" board/peer clusters | E01 social graph modules already on the E01 shelf (`social_graph_builder.py`); Dual Whopper / lens E96 | New relationship-mapping product |

## Frontend / stack (do not copy)

Inspinia is the candidate/commander surface. Dump's Next.js + Tailwind + Inter/Open Sans + Vercel is their marketing app, not our Wizard. HIPAA claim on a political-donor explorer is their marketing copy — not a reason to stand up a HIPAA program for this dump.

## SORT_LATER (when boxes are up)

1. Re-run E84 hybrid `q=DonorAtlas` and keyword FTS. If a prior dump exists, absorb unique bytes into this shelf; do not create a second shelf.
2. Live `information_schema` for anything resembling `donor_id` / `contribution_id` / `affiliation_id` before anyone drafts DDL from §5.
3. Second-reader (Devin or Claude) on this absorb. Cursor does not self-certify.
4. Optional: add DonorAtlas to a future competitive-intel refresh. Pointer already appended to `research/competitive-intelligence/COMPETITIVE_LANDSCAPE_DONOR_MICROSEGMENTATION.md`.

## Adapted 2026-09-04 (NC First)

Ed ordered clone-and-adapt. The adaptation is on this shelf — it does **not** clone their `donor_id` schema:

- `ECO_CANONICAL/E01/docs/NC_FIRST_DONORATLAS_ADAPTATION_2026-09-04.md`
- `database/migrations/dryrun/DRYRUN_E01_NC_FIRST_DONOR_EXPLORER_VIEWS_2026-09-04.sql` — **PENDING_AUTHORIZATION**, views only, `ROLLBACK`. Not apply-ready until canary + live `information_schema`.

## Forbidden next moves

- `CREATE TABLE` from dump §5 (`donor_id` / parallel Donor Table).
- New ecosystem number.
- Applying the NC First views without named `Authorized` on that filename.
- Putting social-media coalition work in E25.
- Collecting DonorAtlas passwords or scraping `app.donoratlas.com` authenticated.
