---
name: variance-reconciliation
description: The learning-loop spine — reconciling projected vs actual results in ops.variance_ledger after any campaign activity. Load when writing back actual cost/revenue/conversion/recipients, computing forecast variance, building the reconciliation daemon, or feeding the bandit allocator. This is what turns fired weapons into training signal.
---

# Variance Reconciliation

## Position in the chain
```
Weapons fire → results land → variance ledger records projected vs actual → ML improves the next run
```
`ops.variance_ledger` (installed as deploy 33) records: cost projected/actual, recipients projected/actual, conversion projected/actual, revenue projected/actual, and the variance between forecast and reality. It does not do ML itself — it **creates the training signal**.

## Reconciliation process (per campaign/send batch)
1. **Projected row exists first** — written at launch time with funnel_id+version, weapon_id, munition_id, segment, district silo (labels are mandatory; unlabeled variance is untrainable)
2. **Actuals collection** — provider stats (delivery/opens/clicks), attributed conversions/revenue (respecting the donation boundary: LP attribution only, BGOP never processes donations), true cost
3. **Write-back of actuals** — UPDATE the ledger row (requires authorization; the write-back path is the deploy lane's, per two-phase protocol)
4. **Variance computation** — actual − projected per metric; large misses flagged for review, not silently averaged
5. **Rollups** — feed `ops.funnel_performance_rollup`, `ops.weapon_segment_performance`, `ops.munition_segment_performance`, and munition potency_score updates
6. **Bandit allocator** — a view over variance + weapon + munition + funnel labels proposes the next run's channel/message mix; proposals only, never auto-fire

## Rules
- Never fabricate actuals; missing provider data = NULL + a noted gap, not a guess
- Attribution writes never touch `core.di_donor_attribution` (sacred)
- Idempotent: re-reconciling a batch updates the same rows, never duplicates
- Canary bookends + deploy_log row for any write session
- Daemon design (reconciliation cron/worker) is dry-run until Ed authorizes; no daemon may trigger sends
