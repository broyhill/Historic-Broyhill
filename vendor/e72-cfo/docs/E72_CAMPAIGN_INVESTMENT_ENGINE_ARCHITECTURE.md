---
ecosystem: E72
name: Campaign Investment Engine
status: ARCHITECTURE SPEC — APPROVED DESIGN
version: 1.0
authored_by: Claude
date: 2026-06-05
authority: Ed Broyhill
depends_on:
  - nexus-claude-cursor/gov_grant_loader_spec_2026-06-04.md
  - nexus-claude-cursor/candidate_gov_grant_record_2026-06-04.sql
  - nexus-claude-cursor/cowork_2026-06-04/Atala_donor_grant_trace.md
platform_layer: Layer 0 — Political Intelligence (ingredient for fundraising)
target_schema: candidate.*
canary: cluster_id=372171 → 147 txns / $332,631.30 / ed@broyhill.net
---

# E72 — Campaign Investment Engine
## Full System Architecture

---

## 1. What This Ecosystem Does

The Campaign Investment Engine answers one question for every Republican candidate and donor in North Carolina:

> **Who received government money, who authorized it, and did that recipient fund the politician who made it happen?**

It ingests federal and state government grant and contract award data for NC entities, resolves the institutional recipients to individual donors on the BroyhillGOP donor spine, traces each award back to its authorizing legislation and sponsor, and surfaces the **grant → donor → sponsor overlap signal** — a high-value intelligence layer that exposes the economic alignment between institutional beneficiaries and their legislative champions.

This signal feeds the donor fingerprint, powers Brain Worker fundraising triggers, and enables candidates to identify institutional allies (and rivals) with precision that no other political platform offers.

**E72 is a Layer 0 Political Intelligence ecosystem.** Its output is not an end in itself — it is an ingredient that improves donation propensity scores, triggers outreach campaigns, and enriches the microsegment profiles that drive the LP optimizer and fundraising execution.

---

## 2. Platform Positioning

```
LAYER 0 — Political Intelligence (E72 lives here)
    ↓  feeds
LAYER 1 — Donor Intelligence  (E01, E21, donor spine)
    ↓  feeds
LAYER 2 — Campaign Orchestration  (E20 Brain, E41, E60 LP)
    ↓  fires
LAYER 3 — Fundraising Execution  (E30 email, E31 SMS, E32 phone, E33 mail, E34 events)
```

E72's output — the grant→donor→sponsor signal baked into `candidate.donor_fingerprint` — moves through Layer 1 into the donor scoring pipeline and emerges as Brain Worker triggers and LP optimizer inputs that fire Layer 3 execution channels.

---

## 3. The Headline Signal

The primary analytical artifact is `candidate.v_grant_donor_sponsor_overlap`:

```
GRANT RECIPIENT (org) → resolves to PRINCIPAL DONOR (rnc_regid)
      ↓
AWARDING PROGRAM → traces back to AUTHORIZING LEGISLATION → SPONSOR (legislator)
      ↓
DID THE PRINCIPAL DONOR fund the SPONSOR?
```

**Real example — Dr. Anthony Atala / WFIRM (from June 4 cowork):**

| Field | Value |
|---|---|
| Recipient org | Wake Forest Institute for Regenerative Medicine |
| Program | AFIRM ($200M+), RMAT pathway, NSF Engine ($160M/10yr) |
| Principal donor | Dr. Anthony Atala (`rnc_regid` resolved) |
| Federal sponsor | Rep. Virginia Foxx (secured $2M DoD earmark), Sen. Richard Burr (RMAT/21st Cures) |
| State sponsor | Phil Berger, Brent Jackson, Donny Lambeth (NC budget leaders) |
| Giving to sponsors | ~$474K NC + ~$89K federal over 10 years |
| gave_to_grant_sponsor | TRUE |

This is the pattern E72 detects at scale across all NC grant recipients.

---

## 4. System Components

### 4.1 Ingestion Layer (`e72_ingestion.py`)

Four external data sources, polled on distinct cadences:

| Source | API / Export | NC Filter | Data Retrieved | Cadence |
|---|---|---|---|---|
| **USASpending.gov** | `/api/v2/search/spending_by_award` | `place_of_performance` or `recipient_state = NC` | Grants (types 02–05), contracts (A–D): org, UEI, agency, program, amount, dates, CFDA, NAICS | Weekly delta |
| **NIH RePORTER** | `/v2/projects/search` | `org_state = NC` | Medical/university grants → same fields | Weekly delta |
| **NC OpenBudget / NCDIT** | State export (OSBM) | Inherently NC | JDIG/JMAC incentives, NCDOT/NCDHHS contracts | Quarterly |
| **SAM.gov Entity API** | Entity lookup by UEI | — | EIN, org address, officers (for entity resolution) | On new recipients |

All records land in `candidate.gov_grant_record` via idempotent upserts keyed on `(source, source_award_id)`. No record is ever deleted — corrections are applied forward.

### 4.2 Entity Resolution Layer (`e72_entity_resolver.py`)

Connects institutional grant recipients to individual donors on the spine.

**Resolution path:**

```
grant.recipient_org (institution name)
        ↓
SAM.gov Entity API → org address, EIN, officers
        +
ProPublica Nonprofit Explorer 990 (for nonprofits) → board members, top officers
        +
NC Secretary of State (NC SOSearch) → principal officers for businesses
        ↓
Principal name + org ZIP → name+ZIP matcher against:
    spine.donor_rollup  (primary)
    core.donor_profile  (secondary)
        ↓
rnc_regid (TEXT) written to gov_grant_record.rnc_regid
resolved_principal (name of matched exec) written to gov_grant_record.resolved_principal
match_confidence (0.000–1.000) written to gov_grant_record.match_confidence
```

**Match confidence tiers:**

| Tier | Score | Description |
|---|---|---|
| High | 0.850–1.000 | Name exact + ZIP match + EIN corroborated |
| Medium | 0.600–0.849 | Fuzzy name + ZIP match, no EIN corroboration |
| Low | 0.400–0.599 | Fuzzy name only, ZIP mismatch |
| Unresolved | NULL | No confident match — org recorded, `rnc_regid` NULL |

Only High and Medium confidence matches write `rnc_regid`. Low confidence records are flagged for manual review.

### 4.3 Legislative Trace Layer (`e72_legislative_tracer.py`)

Maps each grant to its authorizing vehicle and sponsor.

**Federal trace:**

```
cfda_code / naics_code / program name
    ↓
AFIRM → DoD Approps / NDAA section
RMAT  → P.L. 114-255 (21st Century Cures Act)
NSF Engine → NSF Regional Innovation Engines program
    ↓
Congress.gov bill sponsors/cosponsors API
    ↓
sponsor_name, sponsor_party, sponsor_committee_id (→ committee.party_map)
```

**State trace:**

```
NC program name
    ↓
WFIRM → S.L. 2011-145 §14.12 (2011 Appropriations Act)
JDIG  → S.L. 2002-172 and subsequent amendments
    ↓
NCLEG bill history API → primary sponsor of appropriations act / special provision
    ↓
sponsor_name, sponsor_party, sponsor_committee_id
```

`sponsor_committee_id` is resolved to `committee.party_map` so the overlap join in `v_grant_donor_sponsor_overlap` works immediately. When a state legislator lacks a committee ID (no FEC registration), the field is left NULL and the overlap join gracefully falls to `gave_to_grant_sponsor = FALSE`.

### 4.4 Fingerprint Enrichment (`candidate.refresh_appointment_profiles()`)

After each ingestion + resolution run, the refresh function updates `candidate.donor_fingerprint` with three new columns:

```sql
gov_grant_count         INTEGER   -- number of grants/contracts where this rnc_regid is the resolved principal
gov_grant_total         NUMERIC   -- total dollar value of those grants
gave_to_grant_sponsor   BOOLEAN   -- TRUE if principal donated to any grant's sponsor
```

These three fields join the existing fingerprint columns:
- `charity_count`, `charity_left_count`, `charity_right_count`
- `board_appointment_count`, `dem_appointment_count`, `patronage_flag`

The full fingerprint is the basis for Brain Worker trigger evaluation (see Section 6).

### 4.5 Headline View (`candidate.v_grant_donor_sponsor_overlap`)

A materialized view surfacing the full grant→donor→sponsor chain with donation amounts:

```sql
grant_id              -- internal key
recipient_org         -- institution name
amount                -- grant/contract value
awarding_agency       -- DoD, NIH, NSF, NCDHHS, etc.
program               -- AFIRM, RMAT, JDIG, etc.
authorizing_vehicle   -- legislation citation
sponsor_name          -- documented sponsor/champion
sponsor_party         -- R|D|N
rnc_regid             -- resolved donor principal
principal             -- display name from core.v_donor_datatrust_platform
principal_dollars_to_sponsor  -- total donations from this principal to this sponsor
principal_funded_sponsor      -- boolean: did they fund their grant's sponsor?
```

### 4.6 API Server (`e72_api.py`)

REST endpoints consumed by E51 (Nexus reporting), E20 (Brain Worker triggers), and the candidate portal (E24):

| Endpoint | Method | Description |
|---|---|---|
| `/e72/grants` | GET | Paginated list of all grant records, filterable by agency, program, sponsor_party |
| `/e72/grants/{grant_id}` | GET | Full detail for one grant including donor trace |
| `/e72/overlap` | GET | All grant→donor→sponsor overlap records (gave_to_grant_sponsor=TRUE) |
| `/e72/donor/{rnc_regid}/grants` | GET | All grants where this donor is the resolved principal |
| `/e72/sponsor/{committee_id}/overlap` | GET | All donors who received grants from this sponsor's legislation |
| `/e72/trigger/evaluate` | POST | Brain Worker endpoint — evaluate one rnc_regid for E72 triggers |
| `/e72/status` | GET | Health check: last run timestamp, record counts, canary result |

---

## 5. Database Schema

### 5.1 Primary Table: `candidate.gov_grant_record`

Defined in `nexus-claude-cursor/candidate_gov_grant_record_2026-06-04.sql`. Key fields:

```
grant_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
recipient_org       TEXT NOT NULL
recipient_ein       TEXT              -- 990 / IRS EIN
recipient_uei       TEXT              -- SAM.gov Unique Entity ID
rnc_regid           TEXT              -- resolved to spine (nullable)
resolved_principal  TEXT              -- name of matched exec/owner
awarding_level      TEXT              -- federal|state|county
awarding_agency     TEXT
program             TEXT
award_type          TEXT              -- grant|contract|cooperative_agreement|incentive|earmark
amount              NUMERIC(16,2)
award_date          DATE
period_start        DATE
period_end          DATE
cfda_code           TEXT
naics_code          TEXT
authorizing_vehicle TEXT              -- legislation citation
sponsor_name        TEXT
sponsor_party       TEXT              -- R|D|N
sponsor_committee_id TEXT             -- → committee.party_map
source              TEXT              -- usaspending|nih_reporter|nc_openbudget|sam_gov|manual
source_award_id     TEXT
match_confidence    NUMERIC(4,3)
loaded_at           TIMESTAMPTZ
```

**Indexes:**
- `ix_grant_rncregid` on `(rnc_regid)` — primary join key for donor lookups
- `ix_grant_ein` on `(recipient_ein)` — EIN-based entity resolution
- `ix_grant_agency` on `(awarding_agency)` — agency-level filtering
- `ix_grant_sponsor` on `(sponsor_committee_id)` — sponsor overlap join

### 5.2 Fingerprint Extensions on `candidate.donor_fingerprint`

Three columns added by `candidate_gov_grant_record_2026-06-04.sql`:

```sql
gov_grant_count         INTEGER DEFAULT 0
gov_grant_total         NUMERIC(16,2) DEFAULT 0
gave_to_grant_sponsor   BOOLEAN DEFAULT FALSE
```

### 5.3 Views

```
candidate.v_grant_donor_sponsor_overlap   -- headline: grant→donor→sponsor chain
```

### 5.4 Schema Boundaries

E72 **only writes to** `candidate.*`. It **never writes to**:
- `raw.*` — source of truth for raw donations, READ ONLY FOREVER
- `core.*` — voter file and DataTrust enriched data, no E72 writes
- `spine.*` — donor rollup and transactions, no E72 writes
- `donor_intelligence.*` — fingerprint materialized view, no E72 writes directly (via `candidate.donor_fingerprint` bridge only)

---

## 6. Data Flow — End to End

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL SOURCES                                                           │
│  USASpending.gov  │  NIH RePORTER  │  NC OpenBudget  │  SAM.gov Entity     │
└────────┬──────────┴────────┬───────┴────────┬────────┴─────────┬───────────┘
         │                  │                │                   │
         ▼                  ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  e72_ingestion.py                                                           │
│  Idempotent upsert on (source, source_award_id)                            │
│  Canary check before/after every batch                                      │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  candidate.gov_grant_record  (new records: rnc_regid=NULL)                 │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  e72_entity_resolver.py                                                     │
│  UEI → SAM.gov officers + 990 board → name+ZIP match → spine.donor_rollup  │
│  Writes: rnc_regid, resolved_principal, match_confidence                   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  candidate.gov_grant_record  (resolved records: rnc_regid populated)       │
└────────────┬────────────────────────────┬───────────────────────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐  ┌──────────────────────────────────────────────────┐
│  e72_legislative_      │  │  candidate.refresh_appointment_profiles()         │
│  tracer.py             │  │  Joins gov_grant_record + charity + appointments  │
│  cfda/naics → bill →   │  │  Updates candidate.donor_fingerprint:             │
│  sponsor_name +        │  │    gov_grant_count, gov_grant_total,              │
│  sponsor_committee_id  │  │    gave_to_grant_sponsor                          │
└────────────────────────┘  └─────────────────┬────────────────────────────────┘
                                              │
                          ┌───────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  candidate.v_grant_donor_sponsor_overlap  (headline view)                  │
│  candidate.donor_fingerprint  (enriched with grant columns)                │
└────────────┬────────────────────────────────────┬───────────────────────────┘
             │                                    │
             ▼                                    ▼
┌────────────────────────────┐    ┌──────────────────────────────────────────┐
│  E20 Brain Worker          │    │  E24 Candidate Portal                    │
│  Trigger evaluation        │    │  "Campaign Investment Intelligence"       │
│  (Section 6 below)         │    │  panel: grant recipients → donors         │
└────────────────────────────┘    └──────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  E30 Email  │  E31 SMS  │  E32 Phone  │  E33 Mail  │  E34 Events           │
│                FUNDRAISING EXECUTION CHANNELS                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Integration Points with Donor Spine

### 7.1 Primary Join Key

`rnc_regid` (TEXT) is the universal join key across all tables. Every resolved grant record in E72 has `rnc_regid` populated, linking it to:

| Table | Join | What it adds |
|---|---|---|
| `spine.donor_rollup` | `ON rnc_regid` | Full donor identity, cluster_id, display name |
| `core.v_donor_datatrust_platform` | `ON rnc_regid` | All ~2,200 DataTrust variables + Acxiom enrichment |
| `spine.donor_transactions` | `ON rnc_regid` | Every donation this person ever made (the overlap join) |
| `raw.ncboe_donations` | `ON cluster_id` (via spine) | Individual NC BOE transaction records |
| `donor_intelligence.donor_fingerprint` | `ON rnc_regid` | Microsegment scores, giving grades, all 2,349 variable vector |
| `candidate.donor_fingerprint` | `ON rnc_regid` | E72's own grant/charity/appointment enrichment columns |

### 7.2 The Overlap Join (the core E72 value)

```sql
-- Did this grant recipient's principal donate to the grant's own sponsor?
SELECT DISTINCT gr.rnc_regid, TRUE AS gave
FROM candidate.gov_grant_record gr
JOIN spine.donor_transactions dt
  ON dt.rnc_regid = gr.rnc_regid
 AND dt.committee_id = gr.sponsor_committee_id
WHERE gr.sponsor_committee_id IS NOT NULL
```

This join runs inside `candidate.refresh_appointment_profiles()` and writes `gave_to_grant_sponsor = TRUE` to the fingerprint for every matching principal.

---

## 8. Brain Worker Trigger Definitions

E72 registers three Brain Worker triggers in `brain.triggers`. These fire when E72 fingerprint conditions are met, and the Brain routes the appropriate fundraising action.

### Trigger E72-T01 — Grant Recipient is a Donor

**Condition:** `candidate.donor_fingerprint.gov_grant_count >= 1 AND rnc_regid IN spine.donor_rollup`

**Signal:** A grant recipient has been resolved to a donor on the spine. This person has economic alignment with the political process — they benefit from government investment. High-propensity donor for the legislators who control those programs.

**Brain Worker action:** Elevate this donor's microsegment match score for all candidates who sit on the relevant appropriations committees. Flag for personalized outreach referencing their program area.

**Recommended channel:** E41 Campaign Builder → high-touch personal email (E30) or surrogate call (E32)

**Priority tier:** 2 (High)

---

### Trigger E72-T02 — Grant→Sponsor→Donor Alignment

**Condition:** `candidate.donor_fingerprint.gave_to_grant_sponsor = TRUE`

**Signal:** This donor received government money AND funded the politician who authorized it. The economic relationship is already established and documented. This is a proven institutional ally — the most reliable and predictable donor type in the platform.

**Brain Worker action:** Flag for priority outreach for the sponsoring legislator's campaign and their aligned candidates. Add to Ring 1 (anchor donor set) for any microsegment scored for that legislative district. Alert the candidate's campaign manager via E24 portal.

**Recommended channel:** Direct personal ask — surrogate call (E32 high priority) or home fundraiser event (E34)

**Priority tier:** 1 (Critical)

---

### Trigger E72-T03 — Large Grant, Unresolved Principal

**Condition:** `gov_grant_record.amount >= 1000000 AND rnc_regid IS NULL AND match_confidence IS NULL`

**Signal:** A grant worth $1M+ arrived but entity resolution could not identify the principal donor. This is a missed intelligence opportunity. The org may have principals who are not yet in the donor spine.

**Brain Worker action:** Route to E51 (Nexus) for manual research. Do not fire any fundraising execution. Flag in the E72 dashboard as a research queue item.

**Recommended channel:** None — human review first

**Priority tier:** 3 (Research queue)

---

### Trigger Registration (brain.triggers schema)

```sql
INSERT INTO brain.triggers (trigger_id, trigger_name, ecosystem_id, priority, condition_sql, action_payload, status)
VALUES
  ('E72-T01', 'Grant Recipient on Spine',        'E72', 2,
   'gov_grant_count >= 1',
   '{"action":"elevate_microsegment_score","channels":["E30","E32"],"note":"Grant recipient donor"}',
   'active'),
  ('E72-T02', 'Grant Sponsor Funding Alignment', 'E72', 1,
   'gave_to_grant_sponsor = TRUE',
   '{"action":"ring1_flag","channels":["E32","E34"],"note":"Proven institutional ally"}',
   'active'),
  ('E72-T03', 'Large Unresolved Grant',          'E72', 3,
   'gov_grant_count = 0 AND amount >= 1000000',
   '{"action":"research_queue","channels":[],"note":"Manual resolution required"}',
   'active');
```

---

## 9. Dependencies

### 9.1 Must Run Before E72

| Dependency | File | Why |
|---|---|---|
| Candidate schema migration | `candidate_gov_grant_record_2026-06-04.sql` | Creates `candidate.gov_grant_record`, extends `candidate.donor_fingerprint`, creates `candidate.v_grant_donor_sponsor_overlap`, and defines `candidate.refresh_appointment_profiles()`. **Must be deployed first.** |
| Appointment chain schema | `candidate_schema_appointment_chain_2026-06-04.sql` | `gov_grant_record_2026-06-04.sql` depends on it — the `candidate.donor_fingerprint` table is defined there. |
| `committee.party_map` populated | E00 or prior migration | `sponsor_committee_id` resolves via this table. Overlap joins fail silently if committee IDs are missing. |
| `spine.donor_rollup` populated | E01 Donor Intelligence | Entity resolution matches against this table. E72 cannot resolve principals without it. |
| `spine.donor_transactions` populated | E01 Donor Intelligence | The overlap join (T02 trigger) reads this table. No transactions = no overlap signal. |
| `core.v_donor_datatrust_platform` populated | E00 DataHub | Display names in `v_grant_donor_sponsor_overlap` come from this view. |

### 9.2 Dependencies on gov_grant_loader_spec_2026-06-04.md

The June 4 loader spec (`nexus-claude-cursor/gov_grant_loader_spec_2026-06-04.md`) defines the four-stage pipeline that populates `candidate.gov_grant_record`. E72 consumes this pipeline as its data feed. Specifically:

- **Stage 1 (Ingest):** defines the four API sources and their NC filters. E72's `e72_ingestion.py` implements this spec exactly.
- **Stage 2 (Entity resolve):** defines the name+ZIP matcher path using SAM.gov, 990, and NC SOSearch. E72's `e72_entity_resolver.py` implements this.
- **Stage 3 (Legislative attach):** defines the federal and state program→sponsor mapping. E72's `e72_legislative_tracer.py` implements this.
- **Stage 4 (Refresh + surface):** defines the `refresh_appointment_profiles()` call and the `v_grant_donor_sponsor_overlap` read. This is the E72 output layer.

**The WFIRM smoke test defined in the loader spec is the primary E72 verification test.** Before any full NC pull, run it: load ~6 known WFIRM awards + Atala's `rnc_regid`, set sponsors (Foxx/Burr + NC approps leaders), run refresh, confirm `v_grant_donor_sponsor_overlap` shows Atala funded Foxx/Berger/etc.

### 9.3 Downstream Consumers

| Ecosystem | What it consumes from E72 |
|---|---|
| **E20 Brain** | Brain Worker triggers E72-T01, E72-T02, E72-T03 via `brain.triggers` and `/e72/trigger/evaluate` API |
| **E21 ML Clustering** | `gave_to_grant_sponsor` and `gov_grant_total` as features in the donor fingerprint vector |
| **E24 Candidate Portal** | Campaign Investment Intelligence panel showing grant recipients in the candidate's district and their donation history |
| **E51 Nexus** | Research queue (T03 trigger) + oversight reporting on grant intelligence quality |
| **E59 Microsegment Intelligence** | `gave_to_grant_sponsor = TRUE` donors are elevated to Ring 1 for relevant legislative seats |
| **E60 LP Optimizer** | T02-flagged donors (proven institutional allies) get higher lift multipliers in the LP channel allocation |

---

## 10. Operational Runbook

### 10.1 First Run — WFIRM Smoke Test

```bash
# Step 1 — Deploy schema (if not already deployed)
psql "host=37.27.169.232 port=5432 dbname=postgres user=postgres" \
  -f nexus-claude-cursor/candidate_gov_grant_record_2026-06-04.sql

# Step 2 — Canary
psql "host=37.27.169.232 port=5432 dbname=postgres user=postgres" \
  -c "SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id=372171;"
# Expected: 147 / $332,631.30

# Step 3 — Load WFIRM test data
# Insert ~6 known WFIRM award records manually per the loader spec smoke test
# Set sponsors: Virginia Foxx, Richard Burr, Phil Berger, Brent Jackson

# Step 4 — Run entity resolution for Atala
python3 e72_entity_resolver.py --dry-run --org "Wake Forest Institute for Regenerative Medicine"
# Verify rnc_regid resolves to Atala's record

# Step 5 — Refresh fingerprint
psql ... -c "SELECT candidate.refresh_appointment_profiles();"

# Step 6 — Verify overlap
psql ... -c "SELECT * FROM candidate.v_grant_donor_sponsor_overlap LIMIT 10;"
# Expected: Atala shows principal_funded_sponsor = TRUE for Foxx, Berger, etc.

# Step 7 — Post-canary
psql ... -c "SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id=372171;"
# Expected: 147 / $332,631.30 — unchanged
```

### 10.2 Weekly Operations

```bash
# Run in this order every Monday 06:00 ET (after morning_scrape.sh):
python3 e72_ingestion.py --source usaspending --mode delta
python3 e72_ingestion.py --source nih_reporter --mode delta
python3 e72_entity_resolver.py --mode unresolved   # process only new NULL rnc_regid rows
python3 e72_legislative_tracer.py --mode unattached # process only new NULL sponsor rows
psql ... -c "SELECT candidate.refresh_appointment_profiles();"
python3 e72_api.py --action notify-brain            # push new T01/T02 triggers to E20 Brain
```

### 10.3 Quarterly Operations

```bash
# NC OpenBudget fresh export:
python3 e72_ingestion.py --source nc_openbudget --mode full
python3 e72_entity_resolver.py --mode all           # re-resolve all records (new spine data)
python3 e72_legislative_tracer.py --mode all
psql ... -c "SELECT candidate.refresh_appointment_profiles();"
```

### 10.4 Hard Rules

- **Canary before and after every batch.** If it fails: STOP. Write incident report. Do not proceed.
- **`candidate.*` only.** Never write `raw.*`, `core.*`, `spine.*`, `donor_intelligence.*`.
- **`rnc_regid` is TEXT, not INTEGER.** Match exactly — no type casting.
- **No record deletion.** Corrections are applied forward via upsert. The historical record is immutable.
- **Match confidence < 0.600 = do not write `rnc_regid`.** Leave NULL, flag for human review.
- **No credentials in GitHub.** API keys for USASpending, NIH, SAM.gov live in `.env` or 1Password, never in code.

---

## 11. ML and Scoring Implications

### 11.1 Features Added to the Donor Fingerprint Vector

The E72 enrichment adds three binary/continuous features to the donor fingerprint (`donor_intelligence.donor_fingerprint` and `candidate.donor_fingerprint`):

| Feature | Type | Signal Strength |
|---|---|---|
| `gov_grant_count` | Integer (0–N) | Moderate — institutional engagement score |
| `gov_grant_total` | Continuous ($0–N) | Moderate — economic alignment magnitude |
| `gave_to_grant_sponsor` | Binary (0/1) | **High** — proven political-economic alignment |

`gave_to_grant_sponsor` is one of the strongest binary predictors of repeat large donation behavior. A donor who funds the legislators who fund their institution is not a casual donor — they are a structurally motivated donor. This feature should be included in all microsegment scoring for legislative races.

### 11.2 Cross-Candidate Learning (Stage 3 of competitive landscape recommendations)

E72 is a natural anchor for the hierarchical Bayesian cross-candidate learning model described in the competitive landscape analysis. The grant→sponsor→donor triples are structured data that train well under partial pooling:

- Candidates in the same appropriations subcommittee share grant program → donor profiles
- Hierarchical pooling lets a new candidate to an appropriations seat inherit the grant-alignment donor profiles from similar predecessors

When the cross-candidate learning model (Stage 3, per `E72_CAMPAIGN_INVESTMENT_ENGINE_COMPETITIVE_LANDSCAPE_2026-06-04.md`) is built, E72 grant records are the training substrate.

---

## 12. Privacy and Legal Guardrails

- **All data is public record.** Federal grant data (USASpending, NIH RePORTER) and state grant data (NC OpenBudget) are public. Political donation data (NC BOE, FEC) is public by law. No private data is ingested.
- **Entity resolution uses public officer records only.** 990 filings (public), SAM.gov entity registrations (public), NC Secretary of State (public). No private databases.
- **`rnc_regid` is the only cross-table join key.** Raw donor PII (name, address, email) is never embedded in E72 tables — only the opaque `rnc_regid` key.
- **No E72 data is shared across candidate accounts.** The grant record dataset is platform-wide, but donor fingerprint enrichment is per-candidate. Cross-candidate learning operates only via noised aggregate hyperparameters (not raw records).
- **Concentration analysis is a factual pattern, not an allegation.** The overlap signal (donor gave to their grant's sponsor) is documented, lawful political giving correlated with documented public awards. It does not imply quid pro quo — it implies alignment.

---

## 13. Build Completion Verification Checklist

Per `docs/canonical/CURSOR_BUILD_VERIFICATION_STANDARD.md`:

### File Structure
- [ ] `backend/python/ecosystems/ecosystem_e72_campaign_investment.py` — main module
- [ ] `backend/python/ecosystems/e72_ingestion.py` — ingestion layer
- [ ] `backend/python/ecosystems/e72_entity_resolver.py` — entity resolution
- [ ] `backend/python/ecosystems/e72_legislative_tracer.py` — legislative trace
- [ ] `backend/python/ecosystems/e72_api.py` — REST API server
- [ ] `database/migrations/e72_candidate_gov_grant_record_2026-06-04.sql` — deployed
- [ ] `docs/ecosystems/E72/MANIFEST.md` — Nexus-filed ecosystem manifest
- [ ] `docs/ecosystems/E72/COMPLETION_CERTIFICATE_YYYY-MM-DD.md` — filed by Cursor post-build

### Database Verification
- [ ] `candidate.gov_grant_record` exists on Hetzner 37.27.169.232
- [ ] `candidate.donor_fingerprint` has `gov_grant_count`, `gov_grant_total`, `gave_to_grant_sponsor`
- [ ] `candidate.v_grant_donor_sponsor_overlap` exists
- [ ] `candidate.refresh_appointment_profiles()` function exists
- [ ] `brain.triggers` has E72-T01, E72-T02, E72-T03

### WFIRM Smoke Test (mandatory before declaring LIVE)
- [ ] Load 6 WFIRM awards
- [ ] Atala `rnc_regid` resolves correctly
- [ ] `v_grant_donor_sponsor_overlap` shows Atala → Foxx/Berger/etc. with `principal_funded_sponsor = TRUE`
- [ ] `gave_to_grant_sponsor = TRUE` in `candidate.donor_fingerprint` for Atala
- [ ] Canary post-smoke: 147 / $332,631.30 ✓

### Brain Integration
- [ ] E72-T01 trigger active in `brain.triggers`
- [ ] E72-T02 trigger active in `brain.triggers`
- [ ] E72-T03 trigger active in `brain.triggers`
- [ ] Brain offline fallback coded in `ecosystem_e72_campaign_investment.py`

---

## 14. Certification Threshold

Per the BroyhillGOP Ecosystem Completeness Certification Template, E72 requires ≥85/100 to be declared LIVE:

| Category | Max Points | E72 Target |
|---|---|---|
| Schema correctness | 20 | 20 — schema is precisely defined |
| Data load verified | 20 | 18 — WFIRM smoke test + partial NC load |
| Brain integration live | 20 | 20 — 3 triggers defined and active |
| API endpoints responding | 15 | 15 — 7 endpoints defined |
| Downstream consumers wired | 15 | 12 — E20, E24, E51 wired; E21/E60 pending LP rebuild |
| Documentation complete | 10 | 10 — this spec + MANIFEST.md + COMPLETION_CERTIFICATE |
| **Total** | **100** | **95** |

---

*Architecture spec authored by Claude — 2026-06-05*  
*Based on: competitive landscape analysis (Nexus, 2026-06-04), gov_grant_loader_spec (Claude, 2026-06-04), Atala donor trace (Claude cowork, 2026-06-04)*  
*For deployment by: Cursor, under Ed Broyhill authorization*  
*Verification standard: `docs/canonical/CURSOR_BUILD_VERIFICATION_STANDARD.md`*
