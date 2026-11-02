---
title: E72 — Campaign Investment Engine / Cost-Benefit Variance ML
ecosystem: E72
tier: ecosystem
type: overview
keywords: [e72, campaign-investment, cost, benefit, variance, ml, brain, automation, e20, e40, welford, bayesian, thompson-sampling, knapsack, attribution, throttle, cost-rate-card]
topics: [overview, e72, ml]
ships: Week 1 parallel
depends_on: []
version: 1.0
last_modified: 2026-07-01
---

# E72 — Campaign Investment Engine / Cost-Benefit Variance ML

**Status:** SCAFFOLD COMPLETE, RENAMED FROM OLD E61 | **Migration:** `database/migrations/004_e72_campaign_investment_engine.sql` | **Namespace cleanup required before DB apply**

**2026-07-01 ruling:** this package was rescued from the old `E61_cost_benefit_variance` number and reassigned to E72. E61 now belongs to Source Ingestion & Identity Resolution (SIIRE).

**Do not execute the migration yet.** The rescued SQL and several code comments/imports still contain old `E61` / `e61` names. Complete namespace cleanup before any Hetzner DDL apply.

The keystone ecosystem. Every action across the platform emits cost; every observed outcome attributes benefit; variance is tracked online; Bayesian Thompson sampling selects next actions; brain signals drive E20 priorities; throttles drive E40 enforcement.

## Files

```
E72_campaign_investment_engine/
├── ml/
│   ├── welford.py                 — streaming variance (Welford + discount-weighted)
│   ├── bayesian.py                — hierarchical Normal-Normal + Thompson sampling
│   ├── budget_optimizer.py        — knapsack with risk constraint (PuLP MIP + greedy fallback)
│   ├── attribution_resolver.py    — last-touch / linear / time-decay / Markov chains
│   └── variance_snapshotter.py    — hourly read-optimized snapshots for dashboards
├── brain/
│   └── signal_emitter.py          — emits action_recommendation, throttle_recommendation,
│                                    variance_alert, budget_reallocation, pause_channel to E20
├── automation/
│   └── throttle_controller.py     — feeds E40 Automation Control with per-channel throttles
└── control_panel/
    └── api_spec.md                — Master/Candidate/Staff tier API endpoints + Inspinia views
```

## Integration contract

- **Inputs:** every ecosystem calls `shared.observability.cost_benefit_emitter` to emit costs and benefits
- **Outputs after namespace cleanup:**
  - E20 Central Brain signals
  - E40 Automation Control throttles
  - variance snapshots for control panel dashboards

## Why this ships first

Without this engine, the action ecosystems emit actions that are never measured. The platform cannot learn. The data flywheel does not turn. E72 is the investment feedback layer after the 2026-07-01 split ruling.

## Locked rules

- Network priors are anonymized (no candidate_id leaks downstream of aggregation)
- Welford state is hot-path; snapshots are derived
- Discount factor (halflife = 14 days default) prevents stale data from anchoring posteriors during campaign shifts
- Minimum acceptable ROI (default 1.5x, configurable per silo) is enforced by the budget optimizer's risk constraint
- Cost rate card is version-controlled; historical rates preserved
- AI cost tracked per-token, per-model, refreshed quarterly from Anthropic/upstream pricing
