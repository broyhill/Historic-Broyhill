# DonorAtlas architecture dump — E01 shelf

**Date parked:** 2026-09-04
**Agent:** Cursor
**Lane:** E01 Donor Intelligence (competitor class). Not a new ecosystem. Not E25. Not E102. Not E101.
**State:** SHELF / SORT_LATER — bytes saved. No SQL. No code. No apply.
**Six-gate:** dump stays in `ECO_CANONICAL/E01/docs/`. Do not promote into `E01/code` or `E01/sql`.

## Provenance

| Field | Value |
|---|---|
| Upload | `/home/ubuntu/.cursor/projects/workspace/uploads/Copy_20of_20_3Futm_medium_paid.pdf_e1d5.pdf` |
| Original filename | `Copy of ?utm_medium=paid.pdf` (Google Docs / Skia PDF renderer) |
| Pages | 3 |
| Bytes | 106095 |
| SHA-256 | `31041950f804930f1fdc7dc20bc3e767ed3d8a0540d6c8d1d54b8cfcd9f91c60` |
| Bit-identical copy | `ECO_CANONICAL/E01/docs/DONORATLAS_BREAKDOWN_utm_medium_paid_2026-09-04.pdf` |
| Collisions | `ECO_CANONICAL/E01/docs/DONORATLAS_COLLISIONS_SORT_LATER_2026-09-04.md` |
| Repo grep before absorb | zero hits for `DonorAtlas` / `donoratlas` |
| E84 search | TIMEOUT 2026-09-04 (Hetzner/AX41 dark). Hybrid door `search-docs?q=DonorAtlas` did not answer. Do not treat as "does not exist in E84." |
| Canary | SKIPPED — relay `https://37-27-169-232.nip.io/relay/nexus` timed out 12s. Required `372171 = 147 / $332,631.30` not re-verified this sitting. |

This is a Gemini/Claude-style technical breakdown inferred from DonorAtlas marketing/app signals (Next.js asset paths, `app.donoratlas.com`, GTM id, Tally embed), not a leaked production schema dump. Filename `utm_medium=paid` is a paid-landing scrape marker.

**Do not implement from this file.** Use it as competitor intelligence against the E01 surpass list (DonorSearch, iWave, WealthEngine, DonorPerfect, Bloomerang). Existing BroyhillGOP objects win every collision.

## Why E01

`ECO_CANONICAL/E01/ECO_MODEL.md` already names the competitor class: DonorPerfect, Bloomerang, WealthEngine, DonorSearch, Blackbaud Raiser's Edge, iWave. DonorAtlas is the same class (FEC + IRS 990 wealth/philanthropy explorer + CRM export). Parking it here is absorb-not-discard. Inventing E10x or stuffing it into E25 (donor portal) or NC UNITED would be a lane error.

## Extract (pypdf, 2026-09-04)

Google Docs renderer emits one glyph per line. Text below is the same bytes, whitespace-normalized.

### Header

Based on the platform architecture, infrastructure signals (such as Next.js asset paths), and industry workflows associated with DonorAtlas (widely used across political campaigns, advocacy groups like Color of Change, and major non-profits), here is a comprehensive technical and architectural breakdown across your specified categories:

### 1. Taxonomies

- **Entity Types:** Individual Donors, Political Action Committees (PACs), Super PACs, 501(c)(3) Charities, 501(c)(4) Advocacy Organizations, Corporate Entities, Foundations, and Joint Fundraising Committees.
- **Contribution Categories:** Federal Political Contributions (FEC data), State-Level Political Contributions, Philanthropic/Charitable Giving (IRS Form 990 data), and Board Memberships.
- **Issue/Sector Tags:** Environmental, Reproductive Rights, Civil Rights, Healthcare, Education, Animal Welfare, Bipartisan/Party Alignment (Democrat, Republican, Non-partisan, Independent).
- **Affiliation Hierarchy:** Parent organizations, corporate subsidiaries, matching gift programs, and board interlocks.

### 2. Triggers (Event-Driven Architecture)

- **Data Ingestion Triggers:** Automated cron jobs and webhook schedulers that pull updated bulk data releases from Federal Election Commission (FEC) disclosures and IRS XML repositories.
- **User Action Triggers:** Saved search alerts, list export milestones, and real-time notification triggers when a tracked donor makes a new political or philanthropic filing.
- **UI State Triggers:** Dynamic filter changes (e.g., updating geographic bounds or gift amounts) that alter state parameter strings and trigger instant data recalculation.

### 3. Screen User Interface (UI)

- **Marketing & Conversion Layer:** High-converting landing pages featuring dynamic social proof components, trust badges (SOC 2, HIPAA), quote carousels, and integration logs.
- **Authentication Gateway (`app.donoratlas.com`):** Secure login interface supporting enterprise SSO/SAML, magic links, or multi-factor email/password authentication.
- **Search & Explorer Workspace:** A centralized command query bar, advanced filter sidebar (zip code ranges, career fields, giving thresholds), and multi-facet analytics modules.
- **Donor Profile Card:** A modular deep-dive view displaying lifetime value (LTV), a chronological political contribution timeline, network graphs of shared board affiliations, and employer/title intelligence.

### 4. Directories

- **Donor Directory:** Indexed directory of high-net-worth individuals, bundlers, and political contributors.
- **Organization Directory:** Index of political campaigns, committees, foundations, and charitable entities.
- **Preferred Partners Directory:** Curated network of compliance experts, fundraising consultants, and agency partners.

### 5. Schema (Data Models)

- **Donor Table:** `donor_id`, `full_name`, `address_hash`, `city`, `state`, `zip`, `employer`, `occupation`, `aggregated_lifetime_value`.
- **Contribution Table:** `contribution_id`, `donor_id`, `recipient_id`, `amount`, `transaction_date`, `filing_source` (FEC vs. IRS), `election_cycle`.
- **Organization Table:** `org_id`, `name`, `entity_type` (PAC, 501c3, Campaign), `ein_fec_id`, `sector`.
- **Affiliation Table:** `affiliation_id`, `donor_id`, `org_id`, `role` (Board Member, C-Suite, Employee).

### 6. Integrations

- **CRMs & Fundraising Tools:** Salesforce, Neon One, Bloomerang, HubSpot, and NGP VAN (essential for political operations).
- **Analytics & Attribution:** Google Tag Manager (`G-WTM3XSDRZX`) and Meta Pixel integration for tracking acquisition channels (evident in the URL parameters).
- **Lead Capture & Forms:** Embedded third-party forms like Tally.so (`tally.so/widgets/embed.js`) for rapid demo bookings.

### 7. AI Knowledge & NLP Capabilities

- **Entity Resolution & Fuzzy Matching:** Machine learning algorithms designed to resolve messy, unstructured public data (e.g., reconciling "John Smith" at Microsoft across FEC filings and IRS 990 forms despite missing middle initials or varied name spellings).
- **Relationship Mapping ("Hidden Gems"):** Predictive networking models that surface warm connections and peer-giving clusters based on shared boards or historical joint fundraising events.

### 8. Python & SQL (Data Pipelines & Backend)

- **ETL Pipelines (Python):** Python-based parsing scripts utilizing data science libraries (pandas, pydantic, SQLAlchemy) to clean, validate, and structure multi-terabyte public filing datasets.
- **Analytical Queries (SQL):** Heavy reliance on window functions, recursive Common Table Expressions (CTEs), and aggregation queries to compute rolling totals, historical giving frequencies, and multi-tier network relationships.

### 9. Search & Sort Mechanism Protocols

- **Search Engine:** Elasticsearch or advanced PostgreSQL full-text indexing optimized for instantaneous lookup across millions of records.
- **Sorting Protocols:** Sort by Total Giving Amount, Recency of Contribution, Geographic Proximity, Frequency of Giving, or Recipient Match Relevance.
- **Network Protocols:** RESTful API architecture and secure WebSockets/GraphQL queries driving asynchronous UI filtering.

### 10. YAML (Infrastructure & Config Files)

- **CI/CD Deployment:** Kubernetes manifests (`deployment.yaml`, `ingress.yaml`) and Docker compose files managing scaling across cloud nodes.
- **Pipeline Workflows:** GitHub Actions config files (`.github/workflows/deploy.yml`) orchestrating automated testing, linting, and production deployment scripts.

### 11. Design & Front-End Breakdown

- **Framework:** React-based Next.js framework, optimizing performance through Server-Side Rendering (SSR) and dynamic client-side hydration.
- **Styling System:** Tailwind CSS for responsive utility-first design, fluid layout grids, and scalable typography.
- **Typography & Assets:** Inter and Open Sans font families loaded via Google Fonts; optimized lightweight WebP image assets for logos and security badges.

### 12. Tech Stack Summary

- **Front-End:** React, Next.js, Tailwind CSS, TypeScript.
- **Back-End:** Node.js / Python (FastAPI/Django) handling heavy relational data extraction.
- **Database:** PostgreSQL / Snowflake / Elasticsearch for multi-terabyte vector and relational indexing.
- **Infrastructure:** Cloud-hosted (AWS/Vercel ecosystem) with compliance layers meeting SOC 2 and HIPAA security protocols.

### 13. Core API Endpoints (Conceptual REST Architecture)

- `GET /api/v1/donors/search?q={query}&filters={json}` — Filters and retrieves donor search results.
- `GET /api/v1/donors/{donor_id}/profile` — Pulls deep demographic, political, and philanthropic breakdowns.
- `GET /api/v1/donors/{donor_id}/network` — Generates graph data for shared board connections and giving networks.
- `POST /api/v1/lists/export` — Bundles selected prospect lists into CRM-ready formats (CSV/Excel).
- `GET /api/v1/organizations/{org_id}/contributors` — Aggregates donor profiles associated with a specific campaign or charity.

## What this sitting did not do

- Did not write SQL, schema, or dryrun from §5.
- Did not copy GTM id `G-WTM3XSDRZX` into any BGOP property.
- Did not stand up Elasticsearch, Snowflake, Next.js, or a parallel donor_id spine.
- Did not park this in E25, NC UNITED, E101, or E102.
- Did not claim E84 "no record" — the door timed out.

Cursor does not self-certify absorb-complete. Path + SHA above. Devin or Claude may second.
