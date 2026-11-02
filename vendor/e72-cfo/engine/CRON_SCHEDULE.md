# E72 Cron Schedule — Held Until Namespace Cleanup

This file was rescued from the old `E61_cost_benefit_variance` package and reassigned to E72 on 2026-07-01.

Do not install this cron schedule until package imports, module paths, and SQL schema references are renamed away from old E61 ownership or explicitly bridged.

All times UTC. All jobs idempotent. All jobs safe to retry on failure.

## Schedule

```
*/5  *  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E19_social/bio.click_attribution_worker
0    *  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator snapshot
30   *  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator anomaly
0    6  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator allocate
30   6  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator throttle
0    2  *  *  0   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator priors
*/30 *  *  *  *   /usr/bin/python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator cleanup
```

## Job descriptions

| Cadence | Job | Purpose | Typical duration | Failure tolerance |
|---|---|---|---|---|
| every 5 min | click_attribution_worker | Resolve click rows to known contacts via attribution token / cookie / fingerprint | <30 sec | Skip-locked, multi-worker safe |
| hourly :00 | snapshot | Materialize variance_snapshots from variance_state hot path | <2 min | Read-only on hot path; safe to skip |
| hourly :30 | anomaly | Detect ROI shifts >2σ, emit variance_alert signals | <1 min | Dedupes 24hr per segment |
| daily 06:00 | allocate | Compute per-candidate per-channel daily budget (MIP knapsack) | ~5 sec per candidate | Greedy fallback if MIP times out |
| daily 06:30 | throttle | Auto-set throttle states based on ROI confidence | <2 min | Only writes on state change |
| weekly Sun 02:00 | priors | Recompute network-aggregate Bayesian priors | ~5–15 min at scale | Idempotent UPSERT |
| every 30 min | cleanup | Drop expired unconsumed brain signals | <10 sec | Cheap |

## Monitoring

Each job writes a structured log line at completion:

```
2026-04-26T06:00:32Z INFO orchestrator: job=allocate success=true duration=4.2s rows=87
```

The platform's existing log aggregator (Hetzner-side) ingests these. Alerts trigger on:
- Any job duration >3× typical
- Any job failure (success=false)
- `allocate` rows_processed dropping below 80% of yesterday (signal of candidate provisioning issue)
- `anomaly` emitting >50 alerts in one run (signal of dataset corruption or stale priors)

## Manual invocation

For backfill or ad-hoc runs:

```bash
# Dry run — show what would execute
python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator priors --dry-run

# Run all jobs in sequence (testing only, not production)
python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator all

# Single candidate budget recompute (operator override)
python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator allocate \
    --candidate-id 9c8b7a6d-... --date 2026-04-26
```

## What runs WHERE

| Job | Server | Reason |
|---|---|---|
| click_attribution_worker | Hetzner web tier | Co-located with click ingestion |
| snapshot, anomaly, cleanup | Hetzner batch tier | Read-heavy DB queries |
| allocate | Hetzner batch tier | Per-candidate MIP solve |
| throttle | Hetzner batch tier | Reads snapshots, writes throttles |
| priors | Hetzner batch tier (weekly) | Heavy aggregation, off-peak |

## Calendar gates

- **Before first run of `priors`:** need ≥5 candidates × ≥100 observations per (action_type, segment_key) for any prior to compute. Until then, the table stays empty and the conjugate update uses uninformative defaults.
- **Before first run of `anomaly`:** need n≥30 observations per segment. Most candidates won't trip this for ~2 weeks post-launch.
- **`throttle` evaluator should be silent for first 7 days post-launch** to avoid acting on noise. Recommend deploying with a `--report-only` flag the first week.
