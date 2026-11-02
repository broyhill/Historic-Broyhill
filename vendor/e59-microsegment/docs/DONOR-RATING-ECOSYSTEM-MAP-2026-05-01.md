# Donor Rating & Scoring — Ecosystem Map and Deployment Report

**Author:** Nexus (Perplexity Computer)
**Date:** 2026-05-01 EDT, session resume
**Status:** REPORT. Held in proposals/ awaiting Ed's review. No DDL applied. No deployment authorized.
**Authority:** Ed's twelve principles dictated 2026-05-01 14:48 → 16:55 EDT, captured verbatim in this session's transcript. Strategy takes precedence over any prior ecosystem definitions where they conflict.

**What this is:** an ecosystem-by-ecosystem review of where the twelve donor-rating principles land against the live BroyhillGOP build on Hetzner, with cost accounting, machine learning, and brain control wired into the plan. The deliverable is the deployment plan — not the deployment itself.

**What this is NOT:** held SQL, schema drafts, weight proposals, scoring math, or any net-new naming. Existing ecosystem names, schema names, classifier types, and grade letters are quoted from the live registry, not invented or revised.

---

## Section 0 — Ground truth: the live ecosystem registry

The platform's canonical ecosystem catalog is **`platform.ecosystems` on Hetzner** (60 rows, read live 2026-05-01 14:55 EDT). It supersedes both `SUPREME-MASTERPLAN/BLUEPRINT.md` and `reference/ecosystem-audit.md` where they disagree. Every reference to an ecosystem in this report uses the Hetzner-registered name and code.

**The seven universes** (`platform.universes`):

| Code | Name | Holds |
|---|---|---|
| DATA | Data & Intelligence | E00–E06, E15, E21, E52 |
| COMMS | Communications & Outreach | E17, E30–E33, E35–E36, E48, E57 |
| MEDIA | Media & Content | E08–E09, E14, E16, E18–E19, E23, E45–E47, E49, E53 |
| OPS | Campaign Operations | E05, E12, E34, E37–E39, E41, E43, E54 |
| INTEL | Intelligence & Brain | E07, E10, E13, E20, E22, E42, E56, E59, E60 |
| PORTAL | Portals & Dashboards | E24–E29 |
| INFRA | Infrastructure & Platform | E11, E40, E44, E50–E51, E55 |

**Drift flag (carry to Ed):** `SUPREME-MASTERPLAN/BLUEPRINT.md` (last edited 2026-04-23) does not match the live `platform.ecosystems` registry. BLUEPRINT calls E12 "Scoring & Grades"; the live registry calls E12 "Campaign Operations." BLUEPRINT calls E42 "ACH/Stripe"; the live registry calls E42 "News Intelligence." This drift is not for me to resolve — flagging only. Live registry wins until you say otherwise.

---

## Section 1 — The twelve principles, restated verbatim from session transcript

These are the strategy. Ecosystem mappings below are anchored to them. The principles are not for me to revise.

1. **Lifetime total dollars is the senior axis.** The donor who contributes the most in total donations deserves the highest rating-score under any matrix search and sort.
2. **Spouse household.** If a donor has a spouse and they share near-identical candidate choice, household total drives both ratings; the individual donor and spouse rate alike.
3. **Office-category percentage matrix.** Every donor profiled by what % of lifetime giving goes to each office category (Federal / NC State [House, Senate, Council of State, Superintendent of Public Instruction] / Local-Municipal-County / Judicial [DA, Sheriff, District Court, Superior Court, Court of Appeals, Supreme Court, Chief Justice, AG] / disguised channels [party committees, PACs, c4s federal/state]). The matrix turns "biggest donor" into "biggest probable donor for *this seat*."
4. **Personal-contact CSV override.** Candidate uploads phone-contact CSV → contacts get `personal` tag → matrix scoring is bypassed for those contacts. Pullable into any campaign activity directly.
5. **Candidate sees donors scored to their own seat.** The state's #1 donor doesn't appear at the top of every candidate's view. Each candidate's view ranks by relevance to the seat — size and repetitiveness of donations to matching office × district.
6. **Recency decay + concentration bounds.** A donor who hasn't given since 2022 has diminished 2026 score even with high lifetime total. A $100K once-and-done gift to a presidential committee scores huge for presidential and zero for local sheriff.
7. **c3/c4 issue-coalition donor lists** (NC Faith and Freedom, TPUSA, etc.) → declared issue tags with provenance. Used to define donor stereotype, intensity, hot-issue tags. Tags drive funnels and triggers.
8. **Professional/corporate/special-interest PACs** (NC Realtors PAC, Duke Energy PAC) → declared interest tags. **Same priority as 7. Complementary, not competing.**
9. **Issue-org and interest tags modulate (not replace) candidate-spine scoring.** Diminish score-impact when issue is dormant; amplify when issue is live AND donor has stacked declared confirmations across multiple sources. The 95%-candidate / 95%-party / 95%-NRA donor gets *heightened*, not just preserved.
10. **Candidate-by-candidate litmus tags.** Curated table of candidates whose donor lists are themselves diagnostic (Trump, Biden, Mark Walker, Mark Robinson, Mark Harris, Mike Whatley, Pat McCrory, …). Stripes default to permanent (Mark Walker = ordained-minister Christian Republican across every race). When stripes genuinely shift, candidate is **kept** if donor list still produces a unique archetype (Pat McCrory = Mecklenburg / Charlotte business establishment / Chamber-aligned / often anti-Trump — the canonical drift exception). Removed only if donor list becomes incoherent noise. Anti-Trump and pro-Republican coexist as a valid archetype (Louise Broyhill canonical case).
11. **Vertical dimension — News Intelligence.** Issue-heat readings tagged by issue, geography, time-decaying. When news heat lights up a tagged issue, the multiplier amplifies the donor's intensity for that moment. This dimension is what breaks donors out of the middle band when horizontal scoring alone collapses to ~50%.
12. **Non-candidate-committee priority registry.** Every PAC, c3, c4, trade association, advocacy org has a row with declared primary objectives and top priorities (sourced from website + scorecards + lobbying disclosures + alert traffic). Policy events get scored against this registry — orgs are the editorial board of what counts as heat for their constituency. **Lives canonically in the decision-layer ecosystem** with the other 11 principles. **Also accessed by News Intelligence** for employer-cohort heat detection — donors who never give to the industry PAC but whose declared employer puts them in that constituency surface during matching policy events. `core.donor_profile.employer_normalized` / `naics_code` / `sic_division` (already populated) are the path.

---

## Section 2 — Live build inventory (what exists on Hetzner today, read 2026-05-01)

Fourteen schemas, 269 objects total. Status by relevance to donor rating:

### Substrate — populated and usable

| Object | Live state | Role in rating |
|---|---:|---|
| `raw.ncboe_donations` | 321,348 / 98,303 clusters | Candidate-spine donations. Source for principles 1, 3, 5, 6 |
| `staging.ncboe_party_committee_donations` | 293,396 / 60,238 clusters (v2) | Party-committee giving channel. Source for principle 3 (disguised channel) and partial principle 8 (PAC-routed giving captured here for NCBOE-disclosed PACs) |
| `core.donor_profile` | 98,303 | The living donor rollup. Has **`grade text` column — all 98,303 rows NULL.** Has populated `lifetime_total`, `largest_gift`, `txn_count`, `first_gift_date`, `last_gift_date`, `committees_sboe_ids[]`, `committee_count`, `candidates_given_to[]`, `candidate_count`, `employer_normalized`, `naics_code`, `sic_division`, `industry_sector`, `trump_rally_donor`, `is_volunteer`, `is_military`, `dark_donor_business_likely`, `home_matches_voter`, `address_class`. **The substrate columns for principles 1, 3, 5, 6, 12 are populated. The grade column is empty.** |
| `core.datatrust_voter_nc` | 7,727,637 | The voter-file bridge (carries both state_voter_id and rnc_regid). Source for geographic eligibility (principle 5), voter-history (principle 6 LAW_ORDER precinct-bond example), turnout/persuasion substrate (Acxiom join). |
| `core.acxiom_ap_models` / `acxiom_ibe` / `acxiom_market_indices` | 7,655,593 each | Behavioral/lifestyle enrichment. Source for inferred Tier-1 issue affinity. **Note:** Acxiom has no direct identity fields for evangelical/Catholic/NRA/fiscal-conservative/school-choice; behavioral proxies only — confirmed by 2026-05-01 catalog grep. |
| `ref.acxiom_variables` | 1,909 | Acxiom catalog. Zero drift vs canonical 2025-08-08 (verified earlier today). |
| `core.di_person_canonical` | 75,085 | Canonical person identity layer. Foundation for spousal rollup (principle 2) via `core.di_person_relationship` (14 rows — sparsely populated). |
| `core.di_person_alias` | 92,253 | Name-variation index. |
| `core.di_donor_attribution` | 153 | Legal-donor → credited-to rollups (where Ed's family-office aggregation lives). |
| `core.donor_relationship` | 10,509 | Cluster-to-cluster spouse/parent links. Substrate for principle 2. |
| `core.republican_power_brokers` | **2,664** | **Discovered live in this review. Not previously named in our session.** Likely candidate for the litmus list / archetype-relevant donor population. Schema not yet inspected — flagged for next-session inspection per the "find first" rule. |
| `core.ncgop_candidates` | 704 | NCGOP candidate registry. Likely the seed for principle 10's litmus table. |
| `core.ncgop_statewide_contact_enrichment` | 110,948 | Statewide contact enrichment. May overlap with E52 Contact Intelligence. |
| `core.ncboe_committee_registry` | 2,032 | NCBOE committee registry. Foundation for principle 12 (priority registry) for NC state-side orgs. |
| `committee.committee_id_canonical_name` | 1,998 | Committee name translator. |
| `committee.fec_committee_candidate_lookup` | 2,012 | FEC committee → candidate lookup. |
| `committee.boe_donation_candidate_map` | 338,213 | Donation → candidate match output. |
| `audit.v_candidate_donor_cluster_rollup_audit_v1` | 98,303 | Audit view aligned with `core.donor_profile`. |

### Designed but empty (DDL exists, zero rows)

| Object | DDL state | Why it matters |
|---|---|---|
| `donor_intelligence.person_master` | Full schema, 65 columns including `donor_grade text` | Designed as the unified golden record fusing voter+donor+Acxiom. Empty. |
| `donor_intelligence.contribution_map` | Junction table | Empty. |
| `donor_intelligence.committee_candidate_map` | Junction table | Empty. |
| `donor_intelligence.mv_donation_summary` | Materialized view, sound RFM definition | Never populated. |
| `brain.event_queue` (partitioned by month, partitions through 2026_08) | Full DDL | Empty. **The brain bus has no events.** |
| `brain.triggers` | Declarative trigger definitions, JSON logic tree | Empty. (BLUEPRINT.md claimed 905 triggers loaded — inconsistent with live state. Drift flag.) |
| `brain.candidate_triggers` / `decisions` / `learning` / `contact_fatigue` / `budgets` / `candidate_metrics` | Full DDL | All empty. |
| `audit.activity_log` (partitioned, 2026_04 through 2026_07) | Full DDL | Empty. |
| `platform.candidate_ecosystems` / `ecosystem_features` / `ecosystem_dependencies` / `ecosystem_health` / `ecosystem_versions` | Full DDL | Empty. **Per-candidate ecosystem activation is undefined.** |
| `core.campaigns` / `candidates` / `donor_address_book` / `donor_attribution` / `person_canonical` / `person_alias` / `di_household` / `cluster_trusted_alias` / `employer_entity` / `employer_entity_alias` | DDL only | Various stages of partial implementation. Some are duplicates of live tables (the `di_*` versions are populated; the unprefixed versions are empty). Drift flag for cleanup. |

### Not built — design exists in repo but no DDL on Hetzner

These are the gaps relative to the twelve principles:

- **No `litmus_candidates` table** anywhere in any schema — principle 10's archetype-anchor list. The closest live table is `core.republican_power_brokers` (2,664 rows, schema not yet inspected) which may serve this purpose, or `core.ncgop_candidates` (704 rows). Find-first inspection deferred to next session.
- **No `org_priority_registry` table** anywhere — principle 12's non-candidate-committee priority registry. `core.ncboe_committee_registry` (2,032 rows) is the registry of *committees* but does not carry their declared priorities.
- **No `donor_archetype_tag` / `donor_issue_tag` / `donor_interest_tag` table** — the output side of principles 7, 8, 10. The donor's `core.donor_profile` carries `trump_rally_donor`/`is_volunteer`/`is_military` as boolean flags but no general-purpose tag table.
- **No `news_event` / `policy_event` / `issue_heat` table** — principle 11 (vertical dimension) and the policy-event-detection layer. News Intelligence (E42 in registry) has no live tables on Hetzner.
- **No `donor_score_per_candidate` table or view** — the principle-5 output. `core.donor_profile` carries lifetime-total but no per-candidate scoring projection.
- **No `cost_attribution` / `outcome_ledger` table** — cost accounting layer (Ed's added context this session). `brain.budgets` exists but is per-candidate-channel daily/weekly budget, not the per-action variance ledger.

---

## Section 3 — Ecosystem-by-ecosystem mapping of the twelve principles

Per universe, in execution-relevance order. Each ecosystem entry: live state, principles it owns or consumes, what's built, what's missing, what next deployment looks like.

### Universe DATA — substrate

#### E00 DataHub (DATA, T1, CORE, active)
**Role:** The ingestion floor. Every certified data source lands here first.
**Live state:** `raw.*` schema (2 tables). Owns `raw.ncboe_donations` and the FEC staging.
**Principle ownership:** none directly — it's the source feed, not the rating logic.
**Consumes:** none.
**Feeds:** E01 Donor Intelligence, E03 Candidate Management, E10 Compliance.
**Gap:** FEC migration (415K rows pending per TO-DOS-CURRENT). `raw.fec_donations` not loaded.
**Next deployment:** unrelated to donor rating — own track.

#### E01 Donor Intelligence (DATA, T1, CORE, active) ★ ★ ★
**Role:** The donor rollup, identity resolution, person spine, donor grading.
**Live state:** `core.donor_profile` (98,303), `core.di_person_canonical` (75,085), `core.di_person_alias` (92,253), `core.di_donor_attribution` (153), `core.donor_relationship` (10,509). Plus `donor_intelligence.*` (designed, empty).
**Principle ownership — heavy:**
- **Principle 1 (lifetime total senior axis)** — the rule lives here; substrate columns populated.
- **Principle 2 (spouse household)** — substrate via `core.donor_relationship`; rollup logic missing.
- **Principle 3 (office-category percentage matrix)** — derived from `committees_sboe_ids[]` + `candidates_given_to[]` + `committee.boe_donation_candidate_map`. Computation logic missing.
- **Principle 6 (recency decay + concentration)** — substrate columns (`first_gift_date`, `last_gift_date`, `txn_count`) populated. Decay/concentration math missing.
- **Principle 7/8 declared tags storage** — no general-purpose tag table; `trump_rally_donor`/`is_volunteer`/`is_military` are ad-hoc booleans. Architectural gap.
- **Principle 10 archetype tag storage** — same gap. The output of litmus matching has nowhere to land.
- **Principle 12 employer cohort path** — `employer_normalized`/`naics_code`/`sic_division` columns populated. Rule layer missing.
- **The `grade` column** — present, NULL on all 98,303 rows. Awaiting rubric.

**Consumes:** E00 DataHub (raw donations), E04 Activist Network (boolean flags), E15 Contact Management (employer enrichment).
**Feeds:** E06 Analytics Engine (which computes the scoring math), E07 Issue Tracking, E20 Brain, E59 Microsegment Intelligence, E27 Realtime Dashboard, E29 Analytics Dashboard.

**This is the ecosystem you described that "houses the rules" alongside the other 11.** Per principle 12's locking, it is the canonical home for the decision-layer rules. E06 is the math engine that consumes E01's rules; E20 is the execution layer that fires from E06's outputs.

**Gaps in priority order:**
1. No tag system — `donor_tag` table needed to land issue/interest/archetype tags from principles 7, 8, 10.
2. No grade rubric — column exists, rules don't.
3. No spousal-rollup logic — substrate exists, computation missing.
4. No office-category percentage matrix — derivable, not derived.
5. No litmus-candidate registry inside this ecosystem — flagged for find-first against `core.republican_power_brokers` and `core.ncgop_candidates`.

**Next deployment shape (NOT held SQL — deployment plan only):**
- Step 1: Inspect `core.republican_power_brokers` schema + sample rows; determine if this is the litmus list or a different concept. (Find-first.)
- Step 2: Define the tag system shape — one `core.donor_tag` table or separate tag tables per principle (7/8/10) — Ed's call.
- Step 3: Define grade rubric (Ed's existing locked rubric per memory: A/B/C/D/U with U=Unknown but Qualified, time-axis required) and verify against v2.2 SQL classifier on disk.
- Step 4: Materialize the office-category percentage matrix as a column array on `core.donor_profile` or as a separate `core.donor_office_concentration` table.
- Step 5: Materialize spousal-rollup as either a `household_rating` column on `core.donor_profile` or a `core.household_rollup` table.

Each step is its own `Authorize` gate. Held SQL drafted only after Ed approves the deployment plan.

#### E02 Donation Processing (DATA, T1, CORE, active)
**Role:** WinRed/Anedot/ACH/Stripe ingestion + reconciliation.
**Live state:** Processor integrations are external; reconciliation tables not located in this review.
**Principle ownership:** Indirect — feeds principle 1 substrate when WinRed/Anedot ingestion lands.
**Gap:** WinRed/Anedot integration not deployed. Per BLUEPRINT.md these are PLANNED. This is the layer that closes the donor-economics gap (recency, channel-response, ask-elasticity) most cleanly when it lands.
**Next deployment:** Independent of rating layer in the near-term; eventually critical for principles 6 (recency) and the unstated channel-response axis.

#### E03 Candidate Management (DATA, T1, CORE, active)
**Role:** Candidate registry — the "3,000 paying users" axis.
**Live state:** `core.candidates` (0 rows — empty), `core.ncgop_candidates` (704 rows — populated, may be the seed for the candidate registry).
**Principle ownership:**
- **Principle 5 (per-seat scoring)** — defines the seat × office × district that scoring is filtered against.
- **Principle 10 (candidate-litmus stripes)** — `core.ncgop_candidates` is the candidate universe; the litmus tagging is a flag on a subset of these.
**Gap:** Live `core.candidates` empty. Office × district registry (per principle 5) doesn't exist yet — drafted in `MICROSEGMENT-AT-SCALE-2026-04-30.md` and in held SQL but not applied.
**Next deployment:** Office × district master table is the prerequisite for principle 5; held SQL exists at `proposals/HELD-SQL-2026-04-30-office-and-issue-affinity.sql` Block 1. Apply this block as the foundation.

#### E04 Activist Network (DATA, T1, active)
**Role:** Activist organization roster + memberships. The 52-org E04 roster (12 Tier-1, 15 Tier-2, 15 Tier-3, 10 Tier-4) per `reference/e04-activist-variable-map.md`.
**Live state:** `core.activist_organizations` and `core.activist_memberships` not yet seeded per TO-DOS-CURRENT.md.
**Principle ownership:** **This is one home for principle 7 substrate (c3/c4 issue-coalition rosters).** The 52-org list is the seed for which orgs we ingest donor lists from.
**Consumes:** E07 Issue Tracking (issue codes), E20 Brain (events).
**Feeds:** E01 Donor Intelligence (declared issue tags).
**Gap:** Roster not seeded. No ingestion of c3/c4 donor lists. **Principle 12 priority registry could live here OR in E07 OR in E01 — Ed's call.** My read: principle 12 (org primary objectives + priorities) lives in E04 as a column extension on the 52-org roster, not as a separate table. The orgs ARE the registry; their priorities are attributes of the org row. Cleaner.

#### E06 Analytics Engine (DATA, T1, CORE, active) ★ ★
**Role:** The math layer. Computes the rules E01 declares.
**Live state:** No `analytics.*` schema on Hetzner. The math currently runs (when it runs) as ad-hoc SQL or in Python pipelines.
**Principle ownership — heavy:**
- **Principle 1 math** — the lifetime-total ranking computation.
- **Principle 5 math** — the per-seat filtering and scoring.
- **Principle 6 math** — the recency decay and concentration logic.
- **Principle 9 math** — the modulation function (issue tags multiply candidate-spine scoring conditionally).
- **Principle 11 math** — the vertical-multiplier calculation against news heat.
**Consumes:** E01 Donor Intelligence (rules + substrate), E07 Issue Tracking (issue vectors), E42 News Intelligence (heat readings), E12 Non-cmte priority registry (issue weights).
**Feeds:** E20 Brain (decision inputs), E27 Realtime Dashboard, E29 Analytics Dashboard, E59 Microsegment Intelligence.
**Gap:** Entire ecosystem unbuilt. No tables. No view library. No materialized scoring projections per candidate.
**Next deployment shape:** This is the largest single piece of work after E01 rules are locked. Computes per-(donor, candidate) scores nightly; refreshes vertical multipliers in real time as news heat changes. Schema design is non-trivial — likely partitioned by candidate_id, time-windowed views, materialized base scores + on-the-fly multiplier overlays.

#### E07 Issue Tracking (INTEL, T1, active)
**Role:** Issue vectors per person. Per ecosystem-audit doc: "Clones ISideWith: 30-50 issue questions across ~9 domains. Each person ends up with an issue vector — support/oppose × weight × trust-level."
**Live state:** No live tables on Hetzner under `issue.*` or similar.
**Principle ownership:** **This is the natural home for the 25-issue canonical enumeration** plus any per-donor inferred issue scores. Principle 7 (declared) and principle 12 (heat-driven) connect to this ecosystem.
**Consumes:** E01 Donor Intelligence (donor identity), E04 Activist Network (org-membership-derived issue tags), E42 News Intelligence (issue heat events).
**Feeds:** E06 Analytics Engine (issue scores enter the modulation math), E20 Brain.
**Gap:** Unbuilt. The 25-issue enumeration is in `HELD-SQL-2026-04-30-office-and-issue-affinity.sql` Block 2 awaiting `Authorize`. Tier-1 blend rules in Block 3 (verified Acxiom codes per today's commit `14dbd29`).
**Next deployment:** Apply Block 2 (issue_code_registry seed). Then Block 3 (Tier-1 blend rules — already verified). Then per-donor scoring runs against the 5 priority issues.

#### E15 Contact Management (DATA, T2, active)
**Role:** Email/phone validation, employer enrichment, contact disposition.
**Live state:** Distributed across `core.donor_profile` columns and `core.ncgop_statewide_contact_enrichment`.
**Principle ownership:**
- **Principle 4 (personal-contact CSV override)** — this is where candidate-uploaded CSVs land and get the `personal` tag.
**Gap:** No personal-contact upload pipeline. No `personal_contact` table. The candidate-side workflow doesn't exist.
**Next deployment:** Independent of rating layer. Personal-contact-CSV ingest can ship before or after E01 rules are deployed.

#### E21 ML Clustering (DATA, T3, active)
**Role:** Machine learning on donor data — clustering, propensity, capacity prediction.
**Live state:** No live ML pipeline tables.
**Principle ownership:**
- **Predictive layer above the rules.** Where the rules say "score = lifetime × recency × concentration," ML rides on top to learn:
  - Capacity prediction from public-record signals (Tier-2 substrate per memory)
  - Recency-decay curve calibration (instead of hand-set decay function)
  - Channel-response prediction (which donor responds to which channel)
  - Ask-elasticity prediction
**Consumes:** E01 substrate, E06 base scores, E20 Brain (outcome feedback).
**Feeds:** E06 Analytics Engine (refines scoring), E59 Microsegment Intelligence.
**Gap:** Unbuilt. No model registry, no training data pipeline, no prediction service.
**Architectural note:** ML is **layer 2** in the rating system. Layer 1 is rules + substrate (E01 + E06). Layer 2 is ML refinement on top. Layer 1 must work first. ML before rules is putting prediction on a non-existent foundation.

#### E52 Contact Intelligence (DATA, T9, active)
**Role:** Wealth indicators, property records, employer/SIC enrichment, capacity scoring.
**Live state:** Per ecosystem-audit doc: "transforms a raw NCBOE record into a microsegment-eligible profile." Some substrate exists in `core.donor_profile` (employer, NAICS, SIC). `core.apollo_business_enrichment` (5,714 rows) has business-credit grades.
**Principle ownership:**
- **Capacity-and-wealth axis (the donor-economics gap I named earlier today).** This is the ecosystem that closes that gap — the "Acxiom can't tell us how much they can write a check for, so we look up property records / business filings / 13F" layer.
- **Principle 12 employer cohort enrichment** — enriches donors so the employer-cohort heat detection has rich data to match against.
**Consumes:** E01 Donor Intelligence (donor identity), public-records APIs (property, SoS, 990s), Acxiom enrichment.
**Feeds:** E06 Analytics Engine (capacity factor in scoring), E51 NEXUS Command (top-prospect war room).
**Gap:** Capacity-estimation pipeline unbuilt. Tier-2 subagent research framework unbuilt.
**Next deployment:** After E01 rules are locked, capacity estimation against top 385 donors is the Tier-2 research workstream — needs Ed's budget approval (one of the four standing decisions).

### Universe INTEL — decision and brain

#### E10 Compliance Manager (INTEL, T2, CORE, active)
**Role:** FEC/NCBOE filing compliance, TCPA, 10DLC, audit trail.
**Principle ownership:** Indirect — gates principle 4 (TCPA opt-in for personal contacts), principle 7/8/12 (FEC disclosure of giving channels).
**Out of scope for this report.**

#### E13 AI Hub (INTEL, T2, CORE, active)
**Role:** AI model orchestration / inference services.
**Principle ownership:** Hosts the inference layer — ML models from E21, content-generation models for E48, news-classification models for E42.
**Out of scope for this report directly — it's a runtime, not a rule-owner.**

#### E20 Intelligence Brain (INTEL, T3, CORE, active) ★ ★ ★
**Role:** Event-bus fusion of every other ecosystem. Composes multi-signal microsegments in real time. Fires triggers.
**Live state:** `brain.event_queue` (partitioned by month, empty), `brain.triggers` (empty), `brain.candidate_triggers` (empty), `brain.decisions` (empty), `brain.learning` (empty), `brain.contact_fatigue` (empty), `brain.budgets` (empty), `brain.candidate_metrics` (empty).
**Principle ownership — heavy:**
- **Brain control** (you named this explicitly today) — the execution layer that consumes E06's scores and E07's tags and E42's heat and fires the right action.
- **Principle 9 modulation execution** — when news heat × donor tag aligns, brain fires the matching trigger.
- **Principle 11 trigger firing** — vertical-multiplier crossings light up actions.
**Consumes:** Every other ecosystem (event-bus pattern).
**Feeds:** E22, E25, E27, E40, E41, E48, all channel ecosystems (E30–E36).
**Gap:** **Daemon not running.** All DDL exists; nothing consumes the event queue. BLUEPRINT.md claimed 905 triggers loaded; live `brain.triggers` is empty (drift flag).
**Next deployment:** This is the platform's #1 standing gap per TO-DOS-CURRENT.md. Bringing the brain online is **prerequisite to operationalizing principles 9, 11**. Without the brain, the rating system can compute scores but cannot act on them.

#### E22 A/B Testing Engine (INTEL, T4, active)
**Role:** Multi-arm testing of message variants, cross-candidate learning.
**Principle ownership:** Indirect — feeds the `brain.learning` table (variance-analysis substrate).
**Out of scope for this report's first wave; relevant when the rating system has enough volume to A/B-test.**

#### E42 News Intelligence (INTEL, T6, active) ★ ★ ★
**Role:** Per ecosystem-audit: "Scans 13,000+ sources … detects candidate mentions, opponent mentions, endorsements, crisis events, sentiment shifts per district in 2-5 minutes."
**Live state:** No live tables on Hetzner under `news.*`. Ecosystem registered as active in `platform.ecosystems` but not implemented in DB layer.
**Principle ownership:**
- **Principle 11 source** — produces the heat readings the vertical multiplier consumes.
- **Principle 12 consumer** — reads the priority registry to determine which events count as heat for which constituency.
**Consumes:** External news feeds, RSS, scraping, social listening (E19 overlap).
**Feeds:** E07 Issue Tracking, E06 Analytics Engine, E20 Brain.
**Gap:** Entire ecosystem unbuilt at the database layer. The 6-axis intensity tagging (volume × sentiment × velocity × reach × durability × actionable) per `reference/tagging-spec.md` has no live materialization.
**Next deployment:** Substantial. Needs ingestion pipeline, classification pipeline, heat-decay layer, geographic scoping. **Not the first work to do** — the rating layer (E01 + E06 rules) ships first; news intelligence is the multiplier overlay that comes second.

#### E59 Microsegment Intelligence (INTEL, T9, **development**) ★
**Role:** Microsegment generator. Per `microsegment-selection` skill: three scales (Mass / Small Group / One-to-One), template-based.
**Live state:** **Status = development**, not active. No `segment.*` schema on Hetzner.
**Principle ownership:**
- **Consumer of the entire rating system** — translates donor scores + tags + heat into actionable microsegments.
- Held SQL in `MICROSEGMENT-AT-SCALE-2026-04-30.md` describes templates + runs + partitioning.
**Consumes:** E01, E06, E07, E20, E42.
**Feeds:** E22 A/B Testing, E48 Communication DNA, channels.
**Gap:** Unbuilt. Templates not designed. RLS strategy not chosen.
**Next deployment:** After E01 + E06 + E07 deliver scored donors with tags, microsegment generation becomes possible. This is the consumer of the rating system, not a producer.

#### E60 Psychology Engagement (INTEL, T9, **development**)
**Role:** Engagement-psychology / archetype layer.
**Status = development.** Likely the home for the donor-archetype synthesis (the stack of tags from principles 7, 8, 10 reduced to a stable archetype label).
**Out of first-wave scope; tied to E01 tag system maturity.**

### Universe OPS — campaign-side consumers

#### E12 Campaign Operations (OPS, T2, active) — the live registry name
*Note: BLUEPRINT.md called this "Scoring & Grades." The live registry calls it Campaign Operations. Drift flag.*
**Role:** Campaign-side operations management.
**Out of scope for this report.**

#### E43 Advocacy (OPS, T6, active) ★
**Role:** Per ecosystem-audit: "Tracks every bill in NC General Assembly + US Congress, committee hearings, amendments, rollcall votes, scorecards, regulatory rule changes, public-comment windows."
**Live state:** No live tables on Hetzner under `advocacy.*` or `legislative.*`.
**Principle ownership:**
- **Principle 12 policy-event detection** — bill-tracking is the source of policy events that get cross-referenced against the org priority registry.
- This is the ecosystem that produces the "Bill X is on the floor; here's which orgs care about it" signal that News Intelligence amplifies.
**Consumes:** NC General Assembly feeds, Congress.gov, scorecard publishers.
**Feeds:** E42 News Intelligence (legislative events as heat sources), E12 Org priority registry (which bills the registry should weight).
**Gap:** Unbuilt.
**Next deployment:** Substantial standalone work; tied to E42 News Intelligence rollout but separately scoped. **Critical for principle 12's policy-event-heat path** — without E43 we have headline-volume heat only.

### Universe INFRA — admin, cost accounting

#### E11 Budget Management (INFRA, T2, active) ★ ★
**Role:** Budget management. **This is where cost accounting lives.**
**Live state:** `brain.budgets` (designed, empty) — per-candidate per-channel daily/weekly/monthly budget tracking.
**Principle ownership:**
- **Cost accounting layer** (Ed's added context this session). Every action in E20 Brain checks E11 budget availability before firing. Every outcome (donation, click-through, no-response) is logged with attribution back to the action that produced it.
- The **variance loop** — actual revenue vs. predicted ROI per microsegment per channel per cycle — lives between E11 (cost) and E22 A/B Testing / `brain.learning` (outcome attribution).
**Consumes:** E20 Brain (action firings), E02 Donation Processing (revenue), E22 A/B Testing (channel performance).
**Feeds:** E06 Analytics Engine (variance-decomposition feedback into refining scores), E27/E28 dashboards.
**Gap:** Variance-attribution model unbuilt. Cost-per-action rates not configured. Outcome-ledger structure undefined.
**Next deployment:** After E20 Brain is online and firing actions, E11's variance loop closes. **The accounting/variance-analysis skill (built-in, in the C7 boot stack) is the substrate for this work** — it spells out actual-vs-predicted per microsegment per channel as molecular cost/benefit cells.

#### E40 Automation Control (INFRA, T6, active)
**Role:** Per ecosystem-audit: "Every automation rule (trigger × filter × action) is recorded."
**Principle ownership:** Where Ed-approved microsegment templates from E59 actually fire. Brain modules (E20) consume the queue this ecosystem maintains.
**Out of first-wave scope.**

#### E51 NEXUS AI / Prime Command (INFRA, T8, CORE, active)
**Role:** Ed's command center. Top-50-200 prospect war room.
**Principle ownership:** Top-of-pyramid view that consumes everything else. Tier-3 curated donor profiles live here.
**Out of first-wave scope; consumer of the rating system.**

### Universe PORTAL — what candidates see

#### E24 Candidate Portal / E27 Realtime Dashboard / E28 Financial Dashboard / E29 Analytics Dashboard
These are the **consumers of the rating system from the candidate side.** Principle 5 (candidate sees donors scored to their own seat) materializes in these portals.
**Out of first-wave scope until E01 + E06 produce per-candidate scored donor lists. Then dashboard scaffolding becomes the next layer.**

---

## Section 4 — The wiring diagram

```
                                 ┌─ external news feeds
                                 ▼
   ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
   │ E00 DataHub      │    │ E42 News Intel      │    │ E43 Advocacy         │
   │ raw.* ingestion  │    │ (heat readings)     │    │ (bill tracking)      │
   └─────────┬────────┘    └──────────┬──────────┘    └──────────┬───────────┘
             │                        │                          │
             ▼                        │                          │
   ┌──────────────────┐               │                          │
   │ E01 Donor Intel  │ ◄─────────────┴── employer cohort ◄──────┤
   │ ★ rules + tags   │                                          │
   │ ★ substrate      │                                          │
   └─────┬─────────┬──┘                                          │
         │         │                                             │
         ▼         ▼                                             ▼
   ┌──────────┐  ┌─────────────────┐    ┌────────────────────────────────┐
   │ E04      │  │ E07 Issue       │    │ E12 Org priority registry      │
   │ Activist │  │ Tracking        │ ◄──┤ (priorities mined from         │
   │ Network  │  │ (issue codes,   │    │  websites + scorecards +       │
   │ (52-org) │  │  per-donor      │    │  lobbying + 990s)              │
   └────┬─────┘  │  affinity)      │    └────────────────────────────────┘
        │        └──────┬──────────┘
        │               │
        ▼               ▼
   ┌────────────────────────────┐         ┌──────────────────────────┐
   │ E06 Analytics Engine       │ ◄────── │ E21 ML Clustering        │
   │ ★ scoring math             │         │ (capacity, propensity,   │
   │ ★ per-candidate projection │         │  recency curve, channel) │
   │ ★ vertical multiplier      │         └──────────────────────────┘
   └─────────────┬──────────────┘
                 │
                 ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ E20 Intelligence Brain ★ EXECUTION LAYER                        │
   │  (event_queue → triggers → decisions → action queue)            │
   └────┬───────────────┬───────────────┬──────────────┬────────────┘
        │               │               │              │
        ▼               ▼               ▼              ▼
   ┌──────────┐  ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ E11      │  │ E59      │    │ E22      │    │ E30-E36  │
   │ Budgets  │  │ Microseg │    │ A/B      │    │ Channels │
   │ (cost)   │  │ Generator│    │ Testing  │    │          │
   └─────┬────┘  └──────────┘    └────┬─────┘    └────┬─────┘
         │                            │                │
         └────────────┬───────────────┴────────────────┘
                      ▼
              ┌────────────────────┐
              │ Outcome ledger     │
              │ variance loop      │
              │ → feeds E06 + E21  │
              └────────────────────┘
                      │
                      ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ E24/E27/E28/E29 PORTALS — what the candidate sees per principle 5│
   └─────────────────────────────────────────────────────────────────┘
```

---

## Section 5 — Deployment plan

The plan is sequenced so each layer can ship independently, with `Authorize` gates between each, and so the rules layer (Ed's strategy) ships before any ML or news-overlay layer that depends on it.

### Phase A — Lock the rules and substrate (E01 + E03)

**Goal:** Make the twelve principles materialize in tables and columns under E01 Donor Intelligence with E03's office × district registry as the anchor.

| Step | Owner | Action | Authorize gate |
|---|---|---|---|
| A0 | Nexus | **Find-first review** of `core.republican_power_brokers`, `core.ncgop_candidates`, the v2.2 SQL classifier, and any litmus-related artifact. Quote-back report; do not draft. | n/a (read-only) |
| A1 | Nexus | Present existing donor-grade rubric (Ed's locked A/B/C/D/U, time-axis doctrine) as held doc, verbatim from memory + v2.2 SQL. Ed reviews, corrects, locks. | Ed reviews |
| A2 | Claude | Apply `HELD-SQL-2026-04-30-office-and-issue-affinity.sql` Block 1 (office × district + hot-issue portfolio). | `Authorize` |
| A3 | Nexus | Draft donor-tag system held SQL — one table per principle (7/8/10) or unified `core.donor_tag` (Ed's call). Verified field codes already confirmed for 7/8 in commit `14dbd29`. | Ed reviews held SQL |
| A4 | Claude | Apply A3's tag system DDL. | `Authorize` |
| A5 | Claude | Apply Block 2 (issue_code_registry + Tier-1 blend rules from Block 3). | `Authorize` |
| A6 | Nexus | Draft household-rollup logic for principle 2 (spouse) using `core.donor_relationship` and `core.di_person_relationship`. | Ed reviews |
| A7 | Claude | Apply A6 DDL/views. | `Authorize` |
| A8 | Nexus | Draft office-category percentage matrix held SQL (column array on `core.donor_profile` or separate table). | Ed reviews |
| A9 | Claude | Apply A8 DDL + populate from existing committee mapping. | `Authorize` |
| A10 | Nexus | Draft recency-decay + concentration-bound scoring view (E06 Analytics Engine, the math-engine layer). | Ed reviews |
| A11 | Claude | Apply A10 view; populate `core.donor_profile.grade` for the first time using the locked rubric. | `Authorize` |

**Phase A end state:** Every donor in `core.donor_profile` has a populated grade. The matrix from principle 3 is materialized. Spouse rollup works. Office × district master is populated. Issue-code registry is seeded. Tag system exists. **The rules layer is live.** No news, no ML, no microsegments yet — those come next.

### Phase B — c3/c4/PAC ingestion + priority registry (E04 + E12-equivalent + E07)

**Goal:** Land principles 7, 8, and 12. Donor lists from issue orgs and PACs become declared tags on donors; priority registry becomes the editorial board for what counts as heat.

Steps B1–Bn drafted only after Phase A lands — order depends on Ed's pick of first orgs to ingest.

### Phase C — Litmus list materialization (principle 10)

**Goal:** Land the candidate-by-candidate stripe tags. Pat McCrory exception architecture, Louise canonical case.

Steps C1–Cn drafted only after Phase A's tag system is live.

### Phase D — News Intelligence + Advocacy (E42 + E43)

**Goal:** Land principle 11 vertical multiplier. Bill-tracking + news heat. Policy-event scoring against the org priority registry from Phase B.

Substantial work. Phase D probably lags Phase A by several weeks in real time.

### Phase E — Brain online + cost accounting (E20 + E11)

**Goal:** Bring the brain daemon up. Wire E11 cost tracking. Variance loop closes.

This is the platform's standing #1 gap and is independent of the rating layer in the sense that it can ship in parallel — but it's only useful when there are scores to act on, so practically it sequences after Phase A.

### Phase F — ML refinement + microsegments + portals (E21 + E59 + E24/E27/E28/E29)

**Goal:** ML learns refined scoring. Microsegments generate from templates. Candidates see donors scored to their seat in the portal.

The end-state view of the platform.

---

## Section 6 — What's deployed first

If Ed approves the plan as written, the **first deployment is Phase A** in the sequence above. Concretely:

- A0 (find-first inspection of `core.republican_power_brokers` and existing classifier artifacts) — **next session, read-only, no DDL**.
- A1 (present existing grade rubric verbatim) — **next session, doc-only**.
- A2 (apply Block 1 office × district DDL) — first `Authorize` gate.

A0 + A1 are read-only and doc-only. A2 is the first DDL gate. Each subsequent step is its own gate.

---

## Section 7 — Open standing decisions Ed must make to unblock Phase A

These cannot be inferred or drafted — they are policy choices.

1. **Confirm or correct the locked grade rubric** (A/B/C/D/U with U=Unknown but Qualified, time-axis required) — find-first will surface what's already on file; Ed locks the version.
2. **Tag system shape** — one unified `core.donor_tag` table or separate tables per principle (7/8/10).
3. **Litmus list home** — `core.republican_power_brokers` (find-first will tell us if this is it) or a new dedicated table.
4. **The McCrory drift architecture** — vintage-aware tags or single-tag-Ed-picks-the-vintage. Ed's call.
5. **Org priority registry home** — extension columns on E04 activist roster, separate table in E07/E12, or hybrid.
6. **Per-tenant isolation strategy** — RLS vs schema-per-tenant. Carried from earlier today's standing decision list.
7. **Tier-2 manual-research budget for top 385 donors.** Carried.
8. **The 25-issue canonical enumeration** — current list in held SQL; Ed approves or modifies before Block 2 fires.

---

## Section 8 — What this report does NOT do

- Does not draft any held SQL beyond what already exists in `proposals/`.
- Does not propose grade thresholds, weight values, or decay-curve shapes.
- Does not rename any ecosystem, schema, table, or column.
- Does not commit anything to the database.
- Does not resolve the BLUEPRINT.md vs `platform.ecosystems` drift — that's flagged for Ed's ruling.
- Does not assume the existing `donor_intelligence.*` empty schema is or isn't the right home for E01 work — Phase A0 inspection determines that against the populated `core.*` substrate.

---

## Cross-reference — files touched in this review

**Read live (Hetzner, 2026-05-01):**
- `platform.ecosystems` (60 rows)
- `platform.universes` (7 rows)
- `core.donor_profile` (98,303 rows, all 57 columns)
- `donor_intelligence.person_master` (0 rows, full schema)
- `donor_intelligence.mv_donation_summary` (definition only — never populated)
- `brain.*` (13 objects, all empty)
- `committee.*` (20 objects)
- `audit.*` (9 objects)
- `core.republican_power_brokers` (existence verified, 2,664 rows — schema not yet inspected, deferred to A0)

**Read on disk (repo):**
- `SUPREME-MASTERPLAN/BLUEPRINT.md`
- `reference/ecosystem-audit.md`
- `BroyhillGOP-master-plan/proposals/MICROSEGMENT-AT-SCALE-2026-04-30.md`
- `BroyhillGOP-master-plan/proposals/HELD-SQL-2026-04-30-office-and-issue-affinity.sql` (commit `14dbd29`)

**Memory consulted:**
- `donor_scoring/time_axis_doctrine.md`
- `donor_classifier/classical_republican.md`
- `donor_classifier/country_club_policy.md`
- `donor_classifier/nc_realtors.md`

**NOT touched:**
- Any DDL on Hetzner.
- Any held SQL beyond reading the existing file.
- Any rename of any ecosystem.
- Any new schema design.

---

*Report by Nexus, 2026-05-01 EDT, after Ed's twelve-principle dictation and explicit instruction: review all ecosystems, let strategy take precedence, define what is going to be deployed. Held in proposals/ awaiting Ed's review. No `Authorize` issued during this review.*
