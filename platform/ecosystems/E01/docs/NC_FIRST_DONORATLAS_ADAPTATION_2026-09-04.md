# NC First adaptation of the DonorAtlas dump

**Date:** 2026-09-04
**Lane:** E01 Donor Intelligence
**Dump:** `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf`
**SHA-256:** `31041950f804930f1fdc7dc20bc3e767ed3d8a0540d6c8d1d54b8cfcd9f91c60`
**State:** SHELF + working adapters. No Hetzner apply. No new ecosystem.

Ed asked to clone DonorAtlas taxonomies / Python / SQL / directories / architecture / tech stack and adapt them to **NC First**. This file is the map. Existing BroyhillGOP objects win every collision.

## NC First (what that means here)

| Law | Source |
|---|---|
| Spine GOLD = NCBOE `Individual` + FEC `cand_id IS NOT NULL` | `docs/canonical/BGOP_OFFICE_HIERARCHY_DOCTRINE_2026-08-20.md` |
| Person key = `cluster_id` INTEGER | schema canon |
| Org/PAC/charity/990 = tattoo, never a second spine | Office/District Hierarchy |
| Silo = Tier → Office Class → Jurisdiction → Candidate | same |
| ~3,200 NC public offices, 100 counties | NC First pipeline spec |
| Search door = E84 | E84 freeze |
| Surface = Inspinia, not Next.js | frontend guardrails |
| Triggers extend `brain.triggers` / `ifttt.rules` only | operating law |

E84 and the sacred canary were **unreachable** this sitting (relay timeout). Live `information_schema` was not re-checked. SQL is `PENDING_AUTHORIZATION`.

## 13-section clone → NC First

| # | DonorAtlas | NC First (this shelf) | Do not copy |
|---|---|---|---|
| 1 | Taxonomies | `ECO_CANONICAL/E01/taxonomies/nc_first.yaml` | Color of Change issue set as default |
| 2 | Triggers | `taxonomies/nc_first.yaml` → existing `brain.triggers` names + PROPOSED extensions | New trigger catalog table |
| 3 | UI | `frontend/E01_NC_FIRST_DONOR_EXPLORER.html` (Inspinia tokens) | Next.js / Tailwind / Inter / Vercel |
| 4 | Directories | `directories/nc_first_directories.yaml` | Parallel donor_id index |
| 5 | Schema | Views over `core.donor_profile` + GOLD filters (dryrun) | `donor_id` Donor Table |
| 6 | Integrations | D365 (registered), WinRed/Anedot display, NCBOE/FEC | Salesforce rebuild; GTM `G-WTM3XSDRZX` |
| 7 | AI / NLP | E00 Splink + E01 grading; tattoo graph later | New entity-resolution engine |
| 8 | Python & SQL | `code/nc_first_donor_explorer.py` + dryrun views | pandas/Snowflake warehouse |
| 9 | Search / sort | Postgres on `cluster_id`; E84 for documents | Elasticsearch cluster |
| 10 | YAML | `config/nc_first_stack.yaml` | K8s/Vercel manifests as ours |
| 11 | Front-end | Inspinia explorer (this lane) | DonorAtlas SSR app |
| 12 | Tech stack | PostgreSQL + Python + Inspinia + E84 | AWS/Vercel/Snowflake/ES |
| 13 | REST | `/e01/nc-first/...` with `cluster_id` / `ein` | `/api/v1/donors/{donor_id}` |

## Identity map

| DonorAtlas | NC First |
|---|---|
| `donor_id` | `cluster_id` INTEGER |
| `full_name` | `core.donor_profile.display_name` |
| `address_hash` | existing match hashes; not a new namespace |
| `aggregated_lifetime_value` | `core.donor_profile.lifetime_total` + E01 triple grade |
| `contribution_id` | NCBOE/FEC native ids; no new PK |
| `org_id` | `ein` (charity) or NCBOE `committee_sboe_id` / FEC `cmte_id` |
| `ein_fec_id` | split: `ein` XOR committee id — never one mushy column |
| Filing source FEC vs IRS | GOLD = FEC `cand_id`; IRS 990 = tattoo only |

Sacred: `raw.ncboe_donations`, `core.di_donor_attribution`, `core.datatrust_voter_nc`, `core.acxiom_ibe` — SELECT at most.

## What shipped in this sitting

| Path | Role |
|---|---|
| `ECO_CANONICAL/E01/taxonomies/nc_first.yaml` | Entities, contributions, NC issue families, affiliations, 100 counties, office tiers, triggers |
| `ECO_CANONICAL/E01/directories/nc_first_directories.yaml` | Donor / org / partner directories bound to live tables |
| `ECO_CANONICAL/E01/config/nc_first_stack.yaml` | Tech stack + API contract |
| `ECO_CANONICAL/E01/code/nc_first_donor_explorer.py` | Read-only explorer (fixture or optional DB) |
| `ECO_CANONICAL/E01/tests/test_nc_first_donor_explorer.py` | No Hetzner required |
| `ECO_CANONICAL/E01/frontend/E01_NC_FIRST_DONOR_EXPLORER.html` | Inspinia explorer over fixture JSON |
| `database/migrations/dryrun/DRYRUN_E01_NC_FIRST_DONOR_EXPLORER_VIEWS_2026-09-04.sql` | Additive views, `PENDING_AUTHORIZATION` |

## Dry run

File: `database/migrations/dryrun/DRYRUN_E01_NC_FIRST_DONOR_EXPLORER_VIEWS_2026-09-04.sql`
**State: `PENDING_AUTHORIZATION`.** Not deployed. Live schema unverified (relay dark).
AUTHORIZATION ASK (when Hetzner answers): `Authorized` against that filename only.
