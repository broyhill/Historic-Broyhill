# E06 Analytics Engine — Full Requirements Master (Dataiku-class)

**Date:** 2026-08-10  
**Authority:** Derived from `ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE.docx` (2026-02-17) + Dataiku DSS audit / June install + Dec 2025 seven-model spine + E20 closed-loop doctrine  
**Status:** REQUIREMENTS INVENTORY — design; no DDL/fire  
**Canary:** cluster `372171` = 147 / $332,631.30  

**One sentence:** E06 is the Dataiku-class unified analytics + predictive + visualization + insight-to-action plane that **feeds E20 Brain** (and Campaign Chief). It is not a four-bullet summary.

**Boundary (do not confuse numbers):**
| Organ | Owns |
|---|---|
| **E06** | Analytics product: metrics warehouse, models, dashboards, narrative, activate-from-insight (observe→authorize→fire) |
| **Dataiku DSS (June)** | Design / Automation / API Node fabric that trains & scores models E06 publishes |
| **E21** | ML clustering / unsupervised segmentation (feeds E06 segments) |
| **E60 ZEUS** | LP allocation / shadow prices (consumes E06+E21 scores) |
| **E72 CBV** | Cost/benefit/variance learning loop |
| **E20** | Constitutional GO/NO-GO + trigger/queue execution |
| **E29/E27/E28** | Dashboard *faces* may render E06 widgets — they do not replace E06 SoR |

---

## A. Platform / Dataiku fabric (must exist for “equates to Dataiku”)

| ID | Requirement |
|---|---|
| A1 | Design Node: project flows, feature engineering recipes, notebooks for every E06 model |
| A2 | Automation Node: scheduled scenarios (nightly refresh, retrain, drift jobs) |
| A3 | API Node: low-latency real-time scoring endpoints for Brain / Wizard / dashboards |
| A4 | API Deployer path: Design → Automation / API packages versioned |
| A5 | Feature store / managed features for donor, voter, channel, precinct entities |
| A6 | Dataset lineage + provenance on every published score (source, run_id, timestamp, model_version) |
| A7 | Model registry: version, metrics, champion/challenger, rollback |
| A8 | Batch scoring + real-time scoring modes |
| A9 | Drift detection (feature + prediction) with alert hooks to E20/E73 |
| A10 | Scenario triggers callable from BGOP (retrain after CBV variance threshold) |
| A11 | Async non-blocking client from FastAPI/Brain (no sync block of event loop) |
| A12 | Secrets / API keys only via vault — never in repo |
| A13 | Multi-tenant silo keys: `candidate_id` / office / district on every score row |
| A14 | Canary-gated deploys: sacred cluster unchanged after any E06 DDL |

---

## B. Data ingestion & metric warehouse (Brain cannot act without this)

| ID | Requirement |
|---|---|
| B1 | Live `e06` (or designated analytics) schema — additive DDL only |
| B2 | Unified fact tables refreshed from spine/core ecosystems (donors, voters, volunteers, comms, media, opposition, brain outcomes) |
| B3 | Connector set: Postgres/Hetzner spine + DataTrust + NCBOE + FEC (+ WinRed receipts where co-admin) |
| B4 | Calculated fields SoR: donor retention, volunteer impact/hour, campaign ROI, CPA, $/email, doors/donation |
| B5 | Filter dimensions: district, precinct, date range, donor tier, issue, ecosystem, campaign, silo |
| B6 | Data quality score: freshness + completeness per source (Admin Master Dashboard) |
| B7 | System health metrics: API uptime, query latency, sync status |
| B8 | Real-time / hourly / daily refresh policies (configurable) |
| B9 | Idempotent metric writes (event_id / period grain) |
| B10 | `campaign_metrics_daily` (or successor) **populated** — not empty |
| B11 | Closed-loop writeback: action outcomes → metrics → model refresh |

---

## C. KPI catalog — Campaign Overview (Command Center 3.1)

| ID | Requirement |
|---|---|
| C1 | Win Probability (%) with confidence intervals |
| C2 | Fundraising Health ($ raised, $ goal, velocity) |
| C3 | Volunteer Momentum (active, hours/week, retention) |
| C4 | Media Sentiment (% pos/neg/neutral) |
| C5 | Opponent Comparison (side-by-side + win-margin projection) |

---

## D. Fundraising analytics (3.2)

| ID | Requirement |
|---|---|
| D1 | Revenue by period (daily / weekly / monthly) |
| D2 | Donor acquisition funnel (prospect → donor → major) |
| D3 | Retention waterfall (new vs repeat, churn) |
| D4 | Average gift trends by donor tier |
| D5 | PRIME / pipeline stage conversion rates |
| D6 | Channel attribution (which channels drive gifts) |
| D7 | ROI by campaign (cost per dollar raised by channel) |

---

## E. Voter analytics (3.3)

| ID | Requirement |
|---|---|
| E1 | Registered voters by precinct (choropleth) |
| E2 | Turnout prediction by precinct |
| E3 | Persuadable voter segments (demo/psycho) |
| E4 | Early vote tracking by location |
| E5 | Absentee ballot request/return analysis |

---

## F. Volunteer analytics (3.4)

| ID | Requirement |
|---|---|
| F1 | Active rate WoW |
| F2 | Hours distribution histogram |
| F3 | Impact metrics (doors, calls, events) |
| F4 | Skill utilization (% in optimal roles) |
| F5 | Geographic coverage heat map |
| F6 | Retention funnel (recruit → active → ambassador) |

---

## G. Communication analytics (3.5)

| ID | Requirement |
|---|---|
| G1 | Email: open / click / conversion |
| G2 | SMS: delivery / response / opt-out |
| G3 | Social: impressions / engagement / viral coefficient |
| G4 | Direct mail: sent / response / cost per response |
| G5 | Phone: connect rate + disposition |
| G6 | Multi-channel attribution waterfall |

---

## H. Opponent analytics (3.6)

| ID | Requirement |
|---|---|
| H1 | Fundraising comparison |
| H2 | Social comparison |
| H3 | News coverage share + sentiment + reach |
| H4 | Issue position comparison map |
| H5 | Endorsement tracking + influence score |

---

## I. Custom dashboards & widgets (3.7 + §6)

| ID | Requirement |
|---|---|
| I1 | Widget library ≥50 (KPI, gauge, charts, maps, funnel, waterfall, table) |
| I2 | Drag-drop dashboard builder |
| I3 | Save & share dashboards |
| I4 | Refresh rate selector (real-time / hourly / daily) |
| I5 | Pre-built pages: Campaign Overview, Fundraising, Voter/Turnout, Volunteer, Comms/Media |
| I6 | Advanced charts: heat map, scatter, treemap, bubble, Sankey, forecast overlay, network |
| I7 | Data tables: donors, volunteers, voter contacts, email performance, activity log |
| I8 | Export CSV / Excel / PDF |
| I9 | Mobile-first responsive (phone/tablet field ops) |
| I10 | Embedded analytics widgets in Command Center + Admin Panel |
| I11 | Campaign narrative “stories” (race story dashboards) |
| I12 | Molecular drill-down (dashboard → segment → person where authorized) |

---

## J. Admin / Deep Analytics (4.1–4.2) — Dataiku science face

| ID | Requirement |
|---|---|
| J1 | Master dashboard: unified KPIs across all ecosystems |
| J2 | Aggregate campaigns / fundraising / volunteer hours / email / DQ / health |
| J3 | Correlation analysis → drivers of win probability |
| J4 | Regression models: activity → outcomes |
| J5 | Cohort analysis (voter / volunteer / donor tier) |
| J6 | Attribution modeling (channel → conversion) |
| J7 | Anomaly detection + investigation queue |
| J8 | Time-series forecasting for all key metrics |
| J9 | Feature importance / explainability per prediction |
| J10 | Experiment registry link (E22 A/B results readable in E06) |

---

## K. Prediction engine outputs (must publish to Brain-readable tables)

| ID | Requirement |
|---|---|
| K1 | Win Probability — Monte Carlo election outcomes |
| K2 | Fundraising Forecast — revenue trajectory |
| K3 | Voter Turnout Prediction — by precinct |
| K4 | Volunteer Retention Risk — high-value volunteers |
| K5 | Email Open Probability |
| K6 | Donor Upgrade Likelihood |
| K7 | Persuasion Rate — % persuadables reached |
| K8 | Response Probability (6-factor: base × relevance × recency × channel × timing × tier) |
| K9 | Relevance Score (geo + issue + timing + target; threshold ≥95) |
| K10 | Expected ROI `(R−C)/C` with min gate (framework 10:1) |
| K11 | Cost Calculation per donor per channel |
| K12 | Confidence Score 0–100 on every recommendation |
| K13 | Faction-stratified scores (13-faction system) where applicable |
| K14 | Every prediction row: `model_version`, `scored_at`, `silo_keys`, `provenance` |

---

## L. E20 Brain controls & closed loop (4.3 + §5) — why Brain can act

| ID | Requirement |
|---|---|
| L1 | E06 is primary **output visualization + score publish** layer for E20 |
| L2 | Prediction sensitivity control (conservative ↔ aggressive) |
| L3 | Alert thresholds → Brain/IFTTT events when crossed |
| L4 | Dashboard refresh rate control |
| L5 | Data source priority on conflicts |
| L6 | Anomaly sensitivity control |
| L7 | Model retrain control (manual + scheduled) |
| L8 | AI tooltip on every chart |
| L9 | Trend arrows (momentum) |
| L10 | Predictive overlays on charts |
| L11 | Anomaly flags on dashboards |
| L12 | Recommended actions at every dashboard level |
| L13 | Published `E06Insight` / `E06ScoreBatch` contract consumed by E20 (not observe_log fiction alone) |
| L14 | Brain may only auto-queue actions from E06 in OBSERVE until Ed authorizes fire |
| L15 | Action Socket path for Activate (not dead `/api/e30/...` orphans) |

---

## M. Campaign Chief narrative (§8)

| ID | Requirement |
|---|---|
| M1 | “How am I doing?” pulls live E06 metrics |
| M2 | Runs win probability + trajectory |
| M3 | Opponent comparative narrative |
| M4 | Top / underperforming segment callouts |
| M5 | Plain-language summary + expected-impact actions |
| M6 | Monitors: win prob, fundraising velocity, volunteer geo/hours, email by segment, persuasion by issue, opponent media/endorsements, early vote, donor retention/upgrade |
| M7 | Recommendation library (persuasion precinct, major-donor raise, volunteer recruit, media shift, rapid response, campus deploy, GOTV) |

---

## N. Search / Sort / Save / Activate (§7)

| ID | Requirement |
|---|---|
| N1 | Global search: dashboards, metrics, campaigns |
| N2 | Metric finder by name |
| N3 | Campaign selector |
| N4 | Date range picker (global) |
| N5 | Advanced filters (precinct, district, tier, skill, …) |
| N6 | Table column sort |
| N7 | Widget drag-reorder |
| N8 | Sort by performance / recency / custom saved |
| N9 | Save view (filters + sort + layout) |
| N10 | Save as permanent custom dashboard |
| N11 | Save reusable filter sets |
| N12 | Export view PDF/image |
| N13 | View version restore |
| N14 | **Activate — email** to selected segment |
| N15 | **Activate — volunteer routing** |
| N16 | **Activate — door-knock** |
| N17 | **Activate — phone bank schedule** |
| N18 | **Activate — social** |
| N19 | **Activate — donor solicitation** |
| N20 | **Activate — volunteer task update** |
| N21 | All Activate gated: Wizard Tier 1 + Legal Tier 2 + Ed AUTHORIZED for external sends |

---

## O. Reports / compliance (4.4)

| ID | Requirement |
|---|---|
| O1 | FEC-format finance disclosures (where applicable; no PCI; BGOP does not process cards) |
| O2 | Campaign team custom reports |
| O3 | Donor cultivation reports |
| O4 | Media coverage reports |
| O5 | Volunteer impact / recognition reports |
| O6 | Weekly executive digest |

---

## P. User journey (end-to-end acceptance)

| ID | Requirement |
|---|---|
| P1 | Role login → Campaign Chief / Command Center / Admin |
| P2 | Data refresh & aggregation runs |
| P3 | KPI visualization with drill-down |
| P4 | AI interpretation + predictions |
| P5 | Interactive explore (filter/sort/compare) |
| P6 | Insight generation (Chief narrative) |
| P7 | Action execution (Activate) under gates |
| P8 | Performance tracking feeds models (closed loop) |

---

## Q. Wiring to allocation stack (Dataiku-class → ZEUS)

| ID | Requirement |
|---|---|
| Q1 | E06 scores → coefficient views for E60 LP (observe first) |
| Q2 | E06 + E21 segments → Dual Whopper / Lens features where applicable |
| Q3 | E72 variance residuals → E06/Dataiku retrain scenarios |
| Q4 | Shadow prices / ROI pane readable beside E06 KPIs in Wizard |
| Q5 | No fire until Action Socket observe drain proven |

---

## R. Non-functional

| ID | Requirement |
|---|---|
| R1 | p99 scoring latency budget for API Node path (document target; ≤1.5s fail-soft for Brain) |
| R2 | RLS / candidate silo isolation on all E06 tables |
| R3 | Audit log of every Activate attempt (who, what, silo, authorize ref) |
| R4 | No DROP/RENAME of live schemas (Schema Fortress) |
| R5 | Orphan originals retained (`ECOSYSTEM_REPORTS/E06_ANALYTICS_ENGINE.docx`) |
| R6 | Sacred canary unchanged after every phase |

---

## Coverage attestation

| Source | Mapped |
|---|---|
| E06_ANALYTICS_ENGINE.docx §§1–8 + Tableau table | → A–P, I, N, O |
| Dataiku DSS Design/Automation/API + MLOps | → A1–A14, J, K8–K14 |
| Seven-model math spine | → K8–K12 |
| E20 closed-loop / Action Socket | → L, N14–N21, Q5 |
| Live gap (2026-08-10) | `e06` tables=0; `campaign_metrics_daily`=0; Brain has no E06 score feed |

**Count:** A14 + B11 + C5 + D7 + E5 + F6 + G6 + H5 + I12 + J10 + K14 + L15 + M7 + N21 + O6 + P8 + Q5 + R6 = **163** discrete requirements.

---

*Cursor · 2026-08-10 · replaces the four-bullet shorthand with the full engine contract*
