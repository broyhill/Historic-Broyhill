---
title: E61 Control Panel — API Specification
ecosystem: E61
tier: control_panel
type: api_spec
keywords: [e61, control-panel, api, master-roi, variance-heatmap, throttle-override, brain-signal-feed, rate-card-editor, prior-manager, sse, websocket, daily-roi]
topics: [ui, api, e61]
version: 1.0
last_modified: 2026-04-26
---

# E61 Control Panel — API Specification

## Master tier endpoints (all silos)

### `GET /api/v1/master/e61/roi`

Network-wide ROI rollup.

Query params:
- `from_date`, `to_date` (default: last 30 days)
- `group_by`: `ecosystem | action_type | segment_grade | candidate` (default: `ecosystem`)
- `attribution_model`: `last_touch | linear | time_decay | markov` (default: `last_touch`)

Response:
```json
{
  "totals": {
    "cost_cents": 18742300,
    "attributed_value_cents": 412350000,
    "roi": 22.0,
    "n_actions": 184220,
    "n_benefits": 9412
  },
  "groups": [
    {
      "key": "E19_social",
      "cost_cents": 4200,
      "attributed_value_cents": 8400000,
      "roi": 2000.0,
      "n_actions": 42000,
      "n_benefits": 1880,
      "ci_95": [1820.0, 2180.0]
    }
  ]
}
```

### `GET /api/v1/master/e61/variance`

Variance posterior heatmap.

Query params:
- `action_type` (optional)
- `min_n` (default: 30; filters out segments with insufficient data)
- `confidence_tier` (default: all)

Response: rows of `(action_type, segment_dims, n, mean_roi, ci_95_lower, ci_95_upper, confidence_tier)`. Renders as heatmap in Inspinia panel — color by `mean_roi`, opacity by `n`.

### `GET /api/v1/master/e61/throttles`

All current throttles across all silos.

### `POST /api/v1/master/e61/throttles`

Override a throttle. Body:
```json
{
  "candidate_id": "...",
  "ecosystem_code": "E19_social",
  "action_type": "send_dm_instagram",
  "throttle_state": "pause",
  "rationale": "FEC complaint pending; pausing all DM emission",
  "expires_at": "2026-05-01T00:00:00Z"
}
```

Writes `set_by = 'staff_override'` (or `'master_override'` for Eddie). Audit logged.

### `GET /api/v1/master/e20/signals`

Brain signal feed (server-sent events for live stream, paginated GET for historical).

Query params: `signal_type`, `candidate_id`, `since` (ISO timestamp), `limit`.

### `GET /api/v1/master/e61/rate_card`
### `POST /api/v1/master/e61/rate_card`
### `PATCH /api/v1/master/e61/rate_card/:id`

Maintain cost rate card. PATCH closes off old version (`effective_to = NOW()`) and inserts new row. No in-place edits to historical rates — version history preserved.

### `GET /api/v1/master/e61/priors`
### `POST /api/v1/master/e61/priors/recompute`

View priors. Recompute triggers a full pass over all candidate-scope variance_state rows, aggregates by action × segment, writes new network prior rows.

---

## Candidate tier endpoints (single silo, RLS-enforced)

### `GET /api/v1/candidate/roi/today`

Today's spend / attributed donations / ROI for the candidate.

Response:
```json
{
  "date": "2026-04-26",
  "spend_cents": 14200,
  "attributed_value_cents": 285000,
  "roi": 20.07,
  "by_channel": {
    "E19_social": {"spend_cents": 800, "value_cents": 145000, "roi": 181.25},
    "E19_social": {"spend_cents": 50, "value_cents": 12000, "roi": 240.00},
    "E33":   {"spend_cents": 13350, "value_cents": 128000, "roi": 9.59}
  }
}
```

### `GET /api/v1/candidate/roi/trend`

Daily ROI trend, last 90 days. Renders as line chart.

### `GET /api/v1/candidate/throttles`

Read-only view of throttles affecting this candidate.

### `POST /api/v1/candidate/throttles/request_override`

Submit an override request to staff. Does NOT directly change throttle state. Creates a row in `e61.throttle_override_requests` (separate table — not in current migration; add in v2).

### `GET /api/v1/candidate/compliance/status`

Disclaimer version, TCPA consent counts (active / revoked), STOP keyword list size.

---

## Staff tier endpoints

### `GET /api/v1/staff/e61/anomalies`

Detects sudden ROI shifts per silo per channel. Computed by comparing 7-day vs 28-day weighted means; flags >2σ deviations. Surfaces candidates whose campaigns may have shifted (debate bounce, scandal, news cycle).

### `GET /api/v1/staff/e61/throttle_overrides`

Pending throttle override requests from candidates. Staff approves/denies.

---

## SSE / WebSocket endpoints

For real-time master tier dashboards:

- `GET /api/v1/master/e61/events?stream=true` — SSE stream of all cost/benefit emissions across the platform (heavily filtered, sample 1% by default to keep bandwidth manageable)
- `GET /api/v1/master/e20/signals?stream=true` — full firehose of brain signals (volume manageable, no sampling)

---

## Inspinia panel integration notes

- Master ROI Dashboard: extends `dashboard_4.html` template (already in repo). Adds 4 KPI cards on top, then network-vs-best-candidate split bar chart, then per-ecosystem waterfall.
- Variance Heatmap: extends `chart_chartjs.html`. Custom heatmap built on Chart.js matrix plugin (already a dep).
- Throttle Override Console: extends `clients.html` table pattern; one row per `(candidate, ecosystem, action_type)` with inline edit.
- Brain Signal Feed: extends `mailbox.html` chronological list pattern; replace mail items with signal cards.

No new top-level HTML templates beyond what Inspinia ships. New panels = derived pages following existing template conventions.
