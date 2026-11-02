# E72 — Campaign Investment Engine
**Version:** 1.0  
**Date:** 2026-06-05  
**Author:** Nexus E51 (Perplexity Computer) — architecture synthesized from competitive research (2026-06-04), NBD Engine spec v0.1 (2026-06-04), gov_grant_loader spec (Claude Cowork, 2026-06-04), and LP decision engine architecture  
**Status:** SPEC — awaiting ecosystem number confirmation from Ed, then TWO PHASE DDL  
**Depends on:** E63 (news/heat tensor), E42 (Radar), Brain Worker daemon (running PID 863301), lp.* schema (24 tables live), LP decision engine (E64), Next-Best-Donor Engine (brain.next_best_donor, spec v0.1)  
**Feeds into:** E64 LP Builder (as budget-commitment input), candidate approval queue (E51), morning brief cron (cd842628)

---

## 0. What This Is (Plain English)

A candidate commits a dollar amount ("I want to spend $10,000 this month on fundraising"). E72 answers three questions before a single dollar is spent:

1. **Where should it go?** — a channel allocation plan (email, SMS, call time, direct mail, digital ads, events) optimized against the candidate's specific donor universe and historical response rates
2. **What will it produce?** — a probabilistic ROI forecast showing expected donations raised, cost per dollar raised, and a confidence interval (not just a point estimate)
3. **What will we learn?** — every result feeds a cross-candidate learning model so the next candidate's estimates start better

After approval, E72 routes execution to the existing channel ecosystems (E58 email, E47 call/RVM, E19 social, E30 SMS), tracks actuals against forecast in real time, and closes the loop.

**Why this doesn't exist elsewhere:** Enterprise marketing automation (Adobe, HubSpot, Salesforce) splits planning and execution — nobody closes the loop to execution. Political tech (NGP VAN, i360, WinRed, Numinar) scores donors but has no commit→allocate→forecast→execute engine. Ad tech (Google, Meta, The Trade Desk) does this for advertising but not for political fundraising across heterogeneous channels. E72 is the first.

---

## 1. The Five-Phase Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        E72 CAMPAIGN INVESTMENT ENGINE                       │
│                                                                             │
│  PHASE 1          PHASE 2           PHASE 3          PHASE 4    PHASE 5    │
│  COMMIT      →   ALLOCATE      →   FORECAST     →  EXECUTE  →  LEARN      │
│                                                                             │
│  Candidate        LP optimizer      Bayesian         Route to   Cross-      │
│  enters           runs channel      posterior ROI    E58/E47/   candidate   │
│  budget +         allocation        intervals +      E47/E19    hierarchical│
│  goal             w/ saturation     approval card    E30/mail/  Bayesian    │
│                   curves            for candidate    events     model       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1 — Commit
The candidate (or campaign manager) enters:
- Total budget to commit (`budget_amount`, numeric)
- Time window (`window_start`, `window_end`)
- Primary goal: `maximize_revenue` | `maximize_new_donors` | `maximize_reactivations` | `maximize_event_rsvps`
- Optional constraints: channel exclusions, minimum/maximum per channel, geographic focus

The commit is stored as an immutable record in `e72.budget_commitments`. Once approved, it drives the allocation and becomes the denominator for all subsequent ROI tracking. Amendments are new commits — the old one is never mutated.

### Phase 2 — Allocate
The LP optimizer takes the committed budget and distributes it across eligible channels by solving:

```
maximize   Σ_k  response_curve(k, spend_k)
subject to Σ_k  spend_k  ≤  budget
           spend_k ≥ min_channel_k   (for each required channel)
           spend_k ≤ max_channel_k   (for each channel with a cap)
           compliance_constraints    (TCPA, FEC, fatigue, opt-out)
```

Where `response_curve(k, spend)` is a diminishing-returns saturation function fit per channel per candidate from historical data. A new candidate with no history inherits the population prior from the cross-candidate Bayesian model (Phase 5). 

The allocator returns a `spend_plan`: channel → dollar amount → expected donors contacted → expected responses. This is the input to Phase 3.

### Phase 3 — Forecast
Before execution, E72 shows the candidate a pre-approval card containing:

| Field | Example |
|---|---|
| Allocated budget | $10,000 |
| Projected donations raised | $24,200 — $38,700 (80% CI) |
| Most likely outcome | $31,000 |
| Cost per dollar raised (CPDR) | $0.26 — $0.41 |
| Net revenue (donations − cost) | $18,200 — $28,700 |
| Expected new donors reached | 847 |
| Expected response rate | 12.3% (± 4.1 pp) |
| Confidence basis | 14 past commitments + 73 pooled analog campaigns |
| Channel breakdown | email 40%, call 25%, SMS 20%, mail 15% |

The forecast is a **calibrated Bayesian posterior** — not a point estimate, not a vendor-invented "best case / commit / pipeline" bucket. The 80% confidence interval means that 80% of similar commitments historically have landed within that range. Forecast accuracy is tracked per commitment and reported back to Ed at session start.

The candidate approves or modifies the plan. No spend moves until approved.

### Phase 4 — Execute
Approved spend plans route directly to the channel ecosystems:

| Channel | Target Ecosystem | Handoff |
|---|---|---|
| Email | E58 (Email System) | `brain.campaign_queue` INSERT with `channel='email'`, `budget_allocation_id` FK |
| SMS | E30 (SMS/10DLC) | Same pattern, TCPA opt-in gate enforced |
| RVM / Call | E47 (Phone Bank) | Scheduled call list + volunteer assignment |
| Digital ads | E19 (Social / E56 de-anon) | Ad set instructions + audience sync |
| Direct mail | E28 (Financial Dashboard) / Lob webhook | Lob job creation with `budget_allocation_id` |
| Events | E67 (Event Scheduler) | RSVP block + budget allocation record |

Execution is **TWO PHASE** — the allocation is written to `e72.spend_plan_items` (Phase A), then a separate approval write kicks off channel dispatch (Phase B). Neither phase bypasses the channel ecosystems.

### Phase 5 — Learn
After the window closes (or in real time as donations arrive), actuals are compared to forecast:

```
e72.commitment_actuals:
  commitment_id       FK
  channel             text
  actual_spend        numeric
  actual_donations    numeric    (from WinRed / Anedot / direct webhooks)
  actual_donors       int
  actuals_at          timestamptz
  vs_forecast_pct     numeric    (actuals / forecast_midpoint)
```

Actual results flow back into the **hierarchical Bayesian cross-candidate model** as new observations, updating the population-level hyperparameters. A candidate's own estimates sharpen with each commitment. New candidates inherit the current population prior — cold-start is structurally solved.

---

## 2. Data Architecture

### 2a. Hetzner Schema — `e72.*`

```sql
-- HELD DDL — requires I AUTHORIZE THIS ACTION before Cursor executes

CREATE SCHEMA IF NOT EXISTS e72;

-- The immutable budget commitment
CREATE TABLE e72.budget_commitments (
    commitment_id       BIGSERIAL PRIMARY KEY,
    candidate_id        BIGINT NOT NULL,                    -- RLS anchor — NEVER NULL
    committee_id        TEXT REFERENCES committee.party_map(committee_id),
    budget_amount       NUMERIC(12,2) NOT NULL CHECK (budget_amount > 0),
    window_start        DATE NOT NULL,
    window_end          DATE NOT NULL,
    primary_goal        TEXT NOT NULL CHECK (primary_goal IN
                            ('maximize_revenue','maximize_new_donors',
                             'maximize_reactivations','maximize_event_rsvps')),
    channel_constraints JSONB DEFAULT '{}',                 -- {min_by_channel, max_by_channel, excluded}
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','approved','executing','closed','cancelled')),
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_window CHECK (window_end > window_start)
);

-- The LP-optimized spend plan (generated after commit, before approval)
CREATE TABLE e72.spend_plans (
    plan_id             BIGSERIAL PRIMARY KEY,
    commitment_id       BIGINT REFERENCES e72.budget_commitments(commitment_id),
    candidate_id        BIGINT NOT NULL,
    model_version       TEXT NOT NULL,                      -- e.g. 'v0-heuristic', 'v1-bayesian-pooled'
    forecast_low        NUMERIC(12,2),                      -- 10th percentile
    forecast_mid        NUMERIC(12,2),                      -- median
    forecast_high       NUMERIC(12,2),                      -- 90th percentile
    forecast_cpdr_low   NUMERIC(8,4),                       -- cost per dollar raised, 10th pct
    forecast_cpdr_high  NUMERIC(8,4),
    forecast_new_donors INT,
    forecast_response_rate NUMERIC(6,4),
    confidence_basis    TEXT,                               -- "14 commitments + 73 pooled analogs"
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Line items per channel in the spend plan
CREATE TABLE e72.spend_plan_items (
    item_id             BIGSERIAL PRIMARY KEY,
    plan_id             BIGINT REFERENCES e72.spend_plans(plan_id),
    commitment_id       BIGINT REFERENCES e72.budget_commitments(commitment_id),
    candidate_id        BIGINT NOT NULL,
    channel             TEXT NOT NULL CHECK (channel IN
                            ('email','sms','rvm','call','digital_ad','direct_mail','event','other')),
    allocated_amount    NUMERIC(12,2) NOT NULL,
    expected_contacts   INT,
    expected_responses  INT,
    expected_revenue    NUMERIC(12,2),
    dispatch_status     TEXT DEFAULT 'pending'
                            CHECK (dispatch_status IN ('pending','dispatched','complete','cancelled')),
    ecosystem_ref       TEXT,                               -- e.g. 'E58', 'E47', 'E30'
    dispatched_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Actuals collected from channel webhooks + donation processors
CREATE TABLE e72.commitment_actuals (
    actual_id           BIGSERIAL PRIMARY KEY,
    commitment_id       BIGINT REFERENCES e72.budget_commitments(commitment_id),
    plan_id             BIGINT REFERENCES e72.spend_plans(plan_id),
    candidate_id        BIGINT NOT NULL,
    channel             TEXT NOT NULL,
    actual_spend        NUMERIC(12,2) DEFAULT 0,
    actual_donations    NUMERIC(12,2) DEFAULT 0,
    actual_donors       INT DEFAULT 0,
    actual_responses    INT DEFAULT 0,
    vs_forecast_pct     NUMERIC(8,4),                       -- actuals / forecast_mid
    source              TEXT,                               -- 'winred_webhook', 'anedot_webhook', 'manual'
    collected_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-candidate learning model — population-level hyperparameters
-- Updated after every closed commitment. Never exposes per-candidate raw data.
CREATE TABLE e72.population_model (
    model_id            BIGSERIAL PRIMARY KEY,
    model_version       TEXT NOT NULL,
    channel             TEXT NOT NULL,
    office_class        TEXT,                               -- NULL = all classes pooled
    alpha_shape         NUMERIC(10,6),                      -- Bayesian prior shape (response rate)
    alpha_scale         NUMERIC(10,6),                      -- Bayesian prior scale
    saturation_k        NUMERIC(10,6),                      -- Hill function k parameter
    saturation_n        NUMERIC(10,6),                      -- Hill function n parameter
    n_campaigns         INT,                                -- number of campaigns contributing
    last_updated        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (model_version, channel, office_class)
);

-- Forecast accuracy tracking (the closed-loop quality signal)
CREATE TABLE e72.forecast_accuracy_log (
    log_id              BIGSERIAL PRIMARY KEY,
    commitment_id       BIGINT REFERENCES e72.budget_commitments(commitment_id),
    candidate_id        BIGINT NOT NULL,
    horizon_days        INT,                                -- 7, 14, 30, 90
    forecast_mid        NUMERIC(12,2),
    actual_at_horizon   NUMERIC(12,2),
    within_80ci         BOOLEAN,
    within_50ci         BOOLEAN,
    error_pct           NUMERIC(8,4),
    logged_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Grant overlap enrichment (dependency on gov_grant_loader — see §5)
CREATE TABLE e72.grant_influence_signals (
    signal_id           BIGSERIAL PRIMARY KEY,
    commitment_id       BIGINT REFERENCES e72.budget_commitments(commitment_id),
    candidate_id        BIGINT NOT NULL,
    rnc_regid           TEXT,                               -- donor who is also a grant recipient/principal
    grant_award_amount  NUMERIC(14,2),
    awarding_agency     TEXT,
    program_name        TEXT,
    sponsor_match       BOOLEAN DEFAULT FALSE,              -- donor also funded the grant's sponsor
    signal_weight       NUMERIC(6,4),                       -- boost to EVNA for this donor
    source              TEXT DEFAULT 'candidate.gov_grant_record',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON e72.budget_commitments (candidate_id, status);
CREATE INDEX ON e72.budget_commitments (committee_id, window_start);
CREATE INDEX ON e72.spend_plans (commitment_id);
CREATE INDEX ON e72.spend_plan_items (commitment_id, channel);
CREATE INDEX ON e72.spend_plan_items (candidate_id, dispatch_status);
CREATE INDEX ON e72.commitment_actuals (commitment_id, channel);
CREATE INDEX ON e72.forecast_accuracy_log (candidate_id, horizon_days);
CREATE INDEX ON e72.grant_influence_signals (rnc_regid);
CREATE INDEX ON e72.grant_influence_signals (commitment_id, signal_weight DESC);
```

**RLS policy:** Every table carries `candidate_id`. Row-level security must enforce `candidate_id = auth.candidate_id()` before this schema is exposed to the candidate portal. No candidate can read another candidate's commitments, actuals, or forecasts.

### 2b. lp.* Tables Used (already live — 24 tables)
E72 reads from and writes to `lp.engagement_queue` and `lp.pages` for landing page ROI attribution:
- `lp.engagement_queue` — page-view events routed back to commitment attribution
- `lp.conversions` — donation conversion events from WinRed/Anedot landing pages
- `lp.ab_tests` / `lp.ab_assignments` — channel A/B test coordination (Phase 5 learning)

### 2c. intelligence.* Schema (not yet on Hetzner — 0 tables)
The `intelligence.district_tag_matrix` (Claude's spec, migration `002_intelligence_district_tag_matrix.sql`, not yet run) feeds E72 with:
- District-level issue salience weights → adjust `strategic_weight(c)` in the EVNA formula
- Office-class response curves for new candidates with no history

**Dependency:** intelligence schema must be deployed (held SQL in GitHub) before E72 v1 Bayesian model can use district-level priors. E72 v0 heuristic does not require it.

---

## 3. The LP Optimizer (Phase 2 Detail)

### v0 — Heuristic Allocator (ship first, no ML required)
For candidates with no history, allocate using the population-average CPDR per channel:

```python
POPULATION_CPDR = {
    'email':       0.08,   # cheapest, highest volume
    'sms':         0.14,
    'rvm':         0.19,
    'call':        0.32,   # volunteer time is not free
    'digital_ad':  0.41,
    'direct_mail': 0.55,   # highest unit cost
    'event':       0.28,   # high ROI but low throughput
}

def v0_allocate(budget, goal, constraints, donor_universe_size):
    """
    Greedy allocation: sort channels by CPDR, fill from cheapest
    until budget exhausted or saturation limit reached.
    Returns {channel: dollar_amount}.
    """
```

### v1 — Bayesian Response Curve Optimizer
Each channel's response is modeled as a Hill saturation function:
```
response(spend) = (spend^n) / (k^n + spend^n)  × scale
```
Parameters `k` (EC50 — spend at half-max response) and `n` (steepness) are estimated per candidate from historical commitments, with Bayesian priors drawn from `e72.population_model`.

The optimizer (HiGHS, already in the LP decision engine) solves:
```
maximize   Σ_k  Hill(k, spend_k, θ_k)
subject to Σ_k  spend_k ≤ budget
           spend_k ∈ [min_k, max_k]
```

For new candidates (no history): θ_k is drawn entirely from population priors, producing a "population-average" plan with wide credible intervals. As the candidate accumulates commitments, their own data shrinks the prior toward their observed parameters (hierarchical Bayesian partial pooling).

### v2 — Cross-Candidate Hierarchical Bayesian Model
Population-level hyperparameters in `e72.population_model` are fit via PyMC/NumPyro:
```python
# Conceptual model structure
with pm.Model() as e72_model:
    # Population hyperpriors (shared across all candidates)
    mu_k = pm.HalfNormal('mu_k', sigma=5000, dims='channel')
    sigma_k = pm.HalfNormal('sigma_k', sigma=2000, dims='channel')
    
    # Per-candidate parameters (shrink toward population)
    k_cand = pm.HalfNormal('k_cand', mu=mu_k, sigma=sigma_k,
                            dims=('candidate', 'channel'))
    
    # Likelihood: observed (spend, donations) pairs
    predicted = hill(spend_obs, k_cand[candidate_idx], n_cand[candidate_idx])
    pm.Normal('obs', mu=predicted, sigma=sigma_obs, observed=donations_obs)
```

**Privacy architecture:** Only the population-level hyperparameters (`mu_k`, `sigma_k` per channel per office class) ever leave a candidate's silo. Per-candidate `k_cand` values are computed locally and used only to update the shared hyperparameters via noised sufficient statistics. No candidate's raw donor data or actuals are exposed to any other candidate.

---

## 4. Brain Worker Integration

### Trigger Definitions
E72 depends on the Brain Worker daemon (running, PID 863301 as of 2026-06-03). Six triggers are required:

| Trigger Name | Fires When | E72 Action |
|---|---|---|
| `e72.commitment_approved` | Status changes to 'approved' | Dispatch spend_plan_items to channel ecosystems |
| `e72.window_closing_72h` | 72 hours before window_end | Alert candidate: actuals vs forecast snapshot |
| `e72.window_closed` | window_end passes | Close commitment, run accuracy log, update population model |
| `e72.donation_received` | WinRed/Anedot webhook with matching attribution | Increment commitment_actuals |
| `e72.forecast_calibration_daily` | Daily at 06:15 EDT (after morning brief) | Compute vs_forecast_pct for all active commitments |
| `e72.cold_start_new_candidate` | New candidate with 0 commitments fires first budget entry | Pull population prior, generate v0 plan, alert Nexus |

These 6 triggers join the 905 existing triggers in `brain.triggers`. They must be seeded via SQL before being live (same pattern as all other brain triggers).

### Brain Worker Event Flow
```
WinRed/Anedot webhook
    → brain.event_queue INSERT (type='donation_received', payload includes attribution_id)
    → Brain Worker daemon picks up
    → routes to e72.commitment_actuals via attribution lookup
    → fires e72.forecast_calibration_daily at next tick
    → updates lp.engagement_queue if LP landing page was involved
```

### Relay Messages
E72 posts to `bell.agent_messages` (Hetzner `bell.*`) when:
- A commitment is approved (to=cursor: "dispatch e72 plan ID {x}")
- A window closes with a calibration surprise (>25% forecast error) (to=nexus: "E72 calibration alert: commitment {x} missed by {y}%")

---

## 5. Gov Grant Loader Integration (E72 × Claude Jun 4 Spec)

The `gov_grant_loader_spec_2026-06-04.md` (Claude Cowork) created a 4-stage pipeline populating `candidate.gov_grant_record` and `candidate.v_grant_donor_sponsor_overlap`. E72 reads from these to produce **grant influence signals** — a category of donor-level strategic weight not available in any competing platform.

### The Signal
When a donor is both:
- A grant recipient's principal (resolved via `rnc_regid` in `candidate.gov_grant_record`)
- A past donor to the candidate (or a likely prospect per NBD Engine)

...their EVNA score receives a boost because:
1. They have an established pattern of channeling money through government relationships
2. They have a known interest in the policy area that authorized the grant
3. They are likely sensitive to election outcomes that affect their grant programs

### Data Flow
```
candidate.gov_grant_record          (populated by gov_grant_loader)
    → candidate.v_grant_donor_sponsor_overlap
    → e72.grant_influence_signals   (written by E72 enrichment job)
    → brain.next_best_donor EVNA    (signal_weight added to EVNA formula)
    → e72.spend_plan_items          (high-signal donors flagged for call/in-person channel preference)
```

### Weekly Refresh Cadence
The gov_grant_loader runs weekly (USASpending/NIH delta). E72 enrichment job runs after each loader completion, refreshing `e72.grant_influence_signals` for all active commitments. The refresh is idempotent — same upsert pattern keyed on `(commitment_id, rnc_regid)`.

### Grant-Influenced Channel Preference
Donors flagged `sponsor_match = TRUE` in `candidate.v_grant_donor_sponsor_overlap` are systematically preferred for **personal call** or **in-person event** channels in the spend plan, because the relationship is complex enough to warrant a conversation. Email and RVM are deprioritized for this segment. This is implemented as a constraint in the Phase 2 allocator:

```python
if donor.grant_sponsor_match:
    channel_constraints['email']['max_weight'] *= 0.4
    channel_constraints['call']['min_weight'] *= 1.8
```

---

## 6. Donor Spine Integration

E72's optimizer and forecaster are only as good as the donor universe they operate on. The following tables from the existing spine are read at commitment time and held in `e72.spend_plans` as a snapshot:

| Source Table | Fields Used | Purpose |
|---|---|---|
| `core.donor_profile` | `rnc_regid`, `donor_grade`, `intensity`, `republican_party_score`, all channel-flag columns | Eligible universe, capacity, propensity |
| `spine.donor_rollup` | `total_amount`, `last_gift_date`, `gift_count` | Recency/frequency/monetary for EVNA |
| `spine.donor_transactions_deduped` | Recent transactions in window | Headroom calculation (FEC/NCSBE per-election limit − YTD) |
| `core.datatrust_voter_nc` | `state_voter_id`, district, precinct | Geographic filtering for district-specific commitments |
| `brain.next_best_donor` | `evna`, `recommended_channel`, `ask_mid`, `suppression` | Pre-computed EVNA queue (if populated); E72 uses or overrides |
| `e72.grant_influence_signals` | `signal_weight`, `sponsor_match` | Grant-derived strategic boost |

**Read-only.** E72 never writes to spine, gold, raw, or core tables. All E72 writes go to `e72.*` and `brain.next_best_donor` (update only, not insert of new persons).

### Universe Sizing at Commit Time
When a candidate enters a commitment, E72 immediately reports:
- Total in-district donors with headroom (can still legally give)
- Distribution by grade tier (A++/A+/A → expected large gift; B → reliable mid; C/D → mass)
- Suppression count (opt-outs, deceased, fatigue-blocked)
- Estimated reachable universe per channel (respecting TCPA/10DLC consent)

This sizing determines whether the budget commitment is realistic. If the in-district universe is too small to absorb the budget without fatiguing donors, E72 warns before Phase 3.

---

## 7. EVNA Formula (Full Version)

From the Next-Best-Donor Engine spec (v0.1, 2026-06-04), the EVNA formula that E72 aggregates at the commitment level:

```
EVNA(d, c, k) = P_give(d, c, k) × E_amount(d, c) × strategic_weight(c)
                − channel_cost(k) − fatigue_penalty(d)
                + grant_signal_weight(d, c)          ← E72 addition
```

Where:
- **P_give** — propensity to donate via channel k (v0: grade/intensity heuristic; v1: LightGBM; v2: two-tower embedding)
- **E_amount** — expected gift size (anchor = min(next ladder tier, max-out headroom, capacity ceiling))
- **strategic_weight(c)** — multiplier for tight/bellwether races, match-unlocking gifts, deadline proximity; fed from E63 heat tensor (news-driven) and district tag matrix (issue salience)
- **channel_cost(k)** — per-contact cost by channel (RVM $0.004, email ~$0, mail high, call = volunteer-minutes × opportunity cost)
- **fatigue_penalty(d)** — recent contacts / over-ask suppression
- **grant_signal_weight(d, c)** — new in E72: additional weight when donor is a grant recipient principal with sponsor overlap

The commitment-level forecast is the sum of EVNA over the approved universe, segmented by channel and aggregated over the spend window.

---

## 8. Candidate Approval Card UI

The pre-approval forecast card (Phase 3) surfaces in the candidate portal as a single-screen approval interface matching the approval queue architecture (E51). Fields:

```
┌─────────────────────────────────────────────────────────────────┐
│  INVESTMENT PLAN — October 2026 · $10,000 committed             │
│  Goal: Maximize revenue · Window: Oct 1–31, 2026               │
├─────────────────────────────────────────────────────────────────┤
│  PROJECTED RETURN                                               │
│  ████████████████████░░░░  $24,200 — $38,700  (80% confidence) │
│                             Most likely: $31,000               │
│  Cost per dollar raised:   $0.26 – $0.41                       │
│  Net revenue:              $18,200 – $28,700                   │
├─────────────────────────────────────────────────────────────────┤
│  CHANNEL PLAN                                                   │
│  Email        $4,000   ▓▓▓▓▓▓▓▓░░░░░░░░  Expected: 847 sent   │
│  Call time    $2,500   ▓▓▓▓▓░░░░░░░░░░░  Expected: 62 calls   │
│  SMS          $2,000   ▓▓▓▓░░░░░░░░░░░░  Expected: 712 sent   │
│  Direct mail  $1,500   ▓▓▓░░░░░░░░░░░░░  Expected: 145 pieces │
├─────────────────────────────────────────────────────────────────┤
│  CONFIDENCE BASIS                                               │
│  Based on 14 past commitments · 73 pooled analog campaigns     │
│  Historical accuracy at 30 days: 76% within 80% CI            │
├─────────────────────────────────────────────────────────────────┤
│  GRANT-INFLUENCE DONORS: 4 in universe (personal call flagged) │
│                                                                 │
│  [APPROVE & EXECUTE]   [MODIFY PLAN]   [CANCEL]                │
└─────────────────────────────────────────────────────────────────┘
```

The card is generated by `e72/api/spend_plan_preview.py` (FastAPI endpoint, same pattern as E69 search API). It reads `e72.spend_plans` + `e72.grant_influence_signals` + `e72.forecast_accuracy_log` (to compute the "historical accuracy" line). Candidate approves by clicking — the approval writes `e72.budget_commitments.status = 'approved'` and fires the `e72.commitment_approved` Brain Worker trigger.

---

## 9. Integration with E64 LP Builder

E72 is a **budget commitment feed** for E64. The existing LP Builder (24 `lp.*` tables live) handles landing page rendering, A/B testing, and donation processing. E72 adds the upstream layer: instead of ad-hoc landing page spends, every LP campaign now traces back to a formal budget commitment with an ROI forecast.

Integration points:
- `lp.pages.e72_commitment_id` (new FK, additive column, not DDL-breaking) — links a landing page campaign to the E72 commitment that authorized it
- `lp.conversions.e72_commitment_id` — donation conversion events feed `e72.commitment_actuals` via the Brain Worker donation_received trigger
- `lp.ab_tests` — channel-level A/B tests (email subject lines, ask amounts, SMS vs email) produce response-rate actuals that train the Phase 5 model

---

## 10. Build Order

### v0 — Heuristic (no ML, ship value immediately)
1. **Deploy `e72.*` DDL** (held above — requires `I AUTHORIZE THIS ACTION`)
2. **Population constants seeded** in `e72.population_model` from known CPDR benchmarks (no ML required — use the table in §3 v0)
3. **Spend plan preview endpoint** (`api/e72_spend_plan_preview.py`) — reads committed budget, runs v0 heuristic allocator, returns the approval card JSON
4. **Commitment approval write** — updates status, fires Brain Worker trigger → routes to channel ecosystems
5. **Actuals collection** — wire WinRed/Anedot webhooks (existing webhook infrastructure from `api-contract` skill) to populate `e72.commitment_actuals`
6. **Morning brief integration** — e72 summary block added to cron cd842628 (weekday 8AM EDT)

### v1 — Bayesian Single-Candidate
7. **Response curves per candidate** — fit Hill functions from actuals once 3+ commitments exist
8. **HiGHS optimizer** (already in E64 LP engine) — replace v0 greedy with constrained nonlinear solve
9. **Calibrated credible intervals** — Bayesian posterior replaces heuristic forecast ranges
10. **Forecast accuracy log population** — `e72.forecast_accuracy_log` filled; accuracy reporting added to morning brief

### v2 — Cross-Candidate Learning
11. **PyMC hierarchical model** — multi-level partial pooling across candidates, fit on all closed commitments
12. **DP noise layer** — differential privacy on shared hyperparameter updates
13. **Population model updates** — `e72.population_model` updated after each closed commitment
14. **Cold-start inheritance** — new candidates automatically receive current population prior
15. **intelligence.district_tag_matrix** — deployed and wired as a prior predictor for office-class-specific models

### Cursor Dispatch Criteria
- v0 DDL: Cursor executes after `I AUTHORIZE THIS ACTION` from Ed
- v0 endpoints: Cursor deploys to Hetzner alongside existing FastAPI services (E69 pattern)
- v1 optimizer: Nexus writes spec → Claude writes HiGHS integration → Cursor executes
- v2 model: Nexus writes PyMC spec → Claude writes model → Cursor runs fit on Hetzner GPU if available, otherwise Colab

---

## 11. Ecosystem Identity

### Ecosystem Number
Number **E72** is confirmed in NEXUS_TODO as the Campaign Investment Engine. The `docs/ecosystems/missing/E72_MISSING.md` file (auto-generated 2026-05-31) previously described E72 as "FEC Filings" — that was an **incorrect auto-generated placeholder**. The correct identity, established in the June 4 session, is the Campaign Investment Engine. The E72_MISSING.md file must be deleted or replaced by this spec.

### Office Class Coverage
E72 operates across all 10 office classes defined in the race-relational scoring system:
- Federal-only (Congress, Senate)
- Party committee (NCGOP, county GOP)
- Statewide-executive (Governor, AG, SoS, etc.)
- NCGA (House + Senate districts)
- Judicial (Superior Court, COA, Supreme Court)
- DA-Sheriff (local law enforcement)
- Local (county commissioner, city council, school board)
- Single-office-specialist
- Cross-class-strategic
- Unknown / other

Population priors in `e72.population_model` are segmented by `office_class` so that a new county commissioner candidate inherits priors from other county commissioner campaigns, not from statewide campaigns with radically different donor universes.

---

## 12. What E72 Does NOT Do

- Does not replace WinRed or Anedot as the payment processor
- Does not write to `raw.*`, `gold.*`, `core.*`, or `spine.*` — read only
- Does not bypass TWO PHASE authorization for any channel dispatch
- Does not expose one candidate's donor data to another candidate in any form — including through the cross-candidate model (only noised population hyperparameters are shared)
- Does not forecast for non-Republican candidates
- Does not override the `suppression` flags in `brain.next_best_donor` — suppressed donors stay suppressed

---

## 13. Hard Rules (E72-specific, in addition to platform-wide rules)

1. **NEVER move committed funds without `e72.budget_commitments.status = 'approved'`.** Draft plans are read-only speculation.
2. **NEVER write a spend plan item above the committed budget.** `SUM(allocated_amount) ≤ budget_amount` must be enforced at insert time with a CHECK constraint.
3. **Forecast intervals must be honest.** If historical accuracy for a given office class is low, widen the CI — do not tighten it for UX reasons. The morning brief reports calibration to Ed; he will notice.
4. **CPDR must include all channel costs**, including volunteer time valued at $15/hour. No vanity CPDR that excludes soft costs.
5. **Grant influence signals are intelligence, not targeting.** They inform the channel preference and EVNA boost but do not trigger any outreach on their own. Every outreach still goes through the normal approval queue.
6. **Cross-candidate pooling requires completed commitments only.** Active/in-flight commitment actuals are excluded from the population model update until the window closes and actuals are final.
7. **Sacred canary check before any E72 schema operation.** `raw.ncboe_donations` cluster 372171 = 147 / $332,631.30 / ed@broyhill.net.

---

## 14. Open Questions for Ed

**Q1.** Confirm E72 = Campaign Investment Engine (not FEC Filings as the auto-generated placeholder had it). If confirmed, `docs/ecosystems/missing/E72_MISSING.md` should be deleted.

**Q2.** Is there a Financial Intelligence Engine sitting between E64 (LP Builder / current LP optimizer) and E28 (Financial Dashboard) that needs a separate ecosystem number? NEXUS_TODO item #9 under DECISIONS NEEDED. E72 assumes it inherits E64's HiGHS solver — if the Financial Intelligence Engine is separate, the dependency chain changes.

**Q3.** What is the Year 1 BGOP annual license fee for demo math? E72's approval card shows CPDR, and the platform white paper will use illustrative numbers. NEXUS_TODO item #10.

**Q4.** Should E72 actuals collection wire to both WinRed AND Anedot, or WinRed only for v0? Both processors have existing webhook patterns in the `api-contract` skill.

---

## 15. Dependencies Summary

| Dependency | Status | Blocking |
|---|---|---|
| Brain Worker daemon | RUNNING (PID 863301) | Not blocking |
| `lp.*` schema (24 tables) | LIVE on Supabase | Not blocking |
| E64 LP Builder HiGHS solver | Committed (spec SHA dcf16e8) | v1 optimizer |
| `brain.next_best_donor` table | Spec written (v0.1) — DDL not yet deployed | v0 enrichment |
| `intelligence.district_tag_matrix` | Migration committed, not on Hetzner | v2 model |
| `candidate.gov_grant_record` | DDL committed (Claude Jun 4), loader pending | Grant signals |
| WinRed webhook | Existing infrastructure (see api-contract skill) | Actuals collection |
| Anedot webhook | Existing infrastructure | Actuals collection v1 |
| E72 DDL `e72.*` | HELD — requires `I AUTHORIZE THIS ACTION` | Everything |

---

*End of E72 Campaign Investment Engine Architecture Spec v1.0*  
*Nexus E51 (Perplexity Computer) — 2026-06-05 21:29 EDT*  
*Source research: docs/research/strategy/E72_CAMPAIGN_INVESTMENT_ENGINE_COMPETITIVE_LANDSCAPE_2026-06-04.md*  
*Companion specs: nexus-claude-cursor/gov_grant_loader_spec_2026-06-04.md · docs/canonical/seamless-research/NEXT_BEST_DONOR_ENGINE_SPEC_v0.1_2026-06-04.md*
