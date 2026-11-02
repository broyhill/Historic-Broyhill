"""
ecosystems/E61_cost_benefit_variance/ml/anomaly_detector.py

Detects sudden ROI shifts per (candidate, action_type, segment) and emits
variance_alert brain signals when |new_mean - prev_mean| > 2 * sigma.

Why 2 sigma:
    - Below 2σ: normal noise, ignore
    - 2σ to 3σ: notable, warrants brain attention but not panic
    - Above 3σ: campaign-shifting event (debate bounce, scandal, news cycle)

The detector compares two weighted Welford states from variance_state:
    short window: weighted_mean_roi (halflife ≈ 7 days)
    long window:  weighted_mean_roi (halflife ≈ 30 days)

When they diverge significantly, we emit. E20 brain decides what to do
(typically: re-allocate budget toward whichever direction changed favorably,
or pause if change is adverse).

This worker is conservative — it emits at most one alert per
(candidate, action_type, segment) per 24-hour window to avoid alert storms.
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 anomaly detector variance-alert sigma-shift brain-signal


from __future__ import annotations

import logging
import math
import uuid
from typing import Any

logger = logging.getLogger(__name__)


SIGMA_THRESHOLD = 2.0
ALERT_DEDUPE_HOURS = 24
MIN_SAMPLE_SIZE = 30


class AnomalyDetector:
    def __init__(self, db: Any, brain_emitter):
        self.db = db
        self.brain = brain_emitter

    def detect_and_emit(self) -> int:
        """
        Single pass over candidate-scope variance_state. Returns count of
        alerts emitted.
        """
        # Pull all candidate-scope rows with enough samples
        rows = self.db.fetch_all(
            """
            SELECT vs.scope, vs.candidate_id, vs.action_type, vs.segment_key,
                   vs.segment_dims, vs.n, vs.mean_roi, vs.m2,
                   vs.weighted_n, vs.weighted_mean_roi, vs.weighted_m2,
                   vs.last_observation_at
              FROM e61.variance_state vs
             WHERE vs.scope = 'candidate'
               AND vs.n >= %(min_n)s
               AND vs.last_observation_at > NOW() - INTERVAL '7 days'
            """,
            {"min_n": MIN_SAMPLE_SIZE},
        )

        alerts_emitted = 0
        for row in rows:
            try:
                if self._should_alert(row):
                    self._emit_alert(row)
                    alerts_emitted += 1
            except Exception:
                logger.exception(
                    "anomaly detection failed for candidate=%s action=%s segment=%s",
                    row["candidate_id"], row["action_type"], row["segment_key"],
                )
        logger.info("anomaly_detector emitted %d alerts", alerts_emitted)
        return alerts_emitted

    def _should_alert(self, row: dict) -> bool:
        # Compare unweighted mean (long-run truth) vs weighted mean (recent)
        long_mean = float(row["mean_roi"])
        short_mean = float(row["weighted_mean_roi"])

        # Long-run stddev
        n = row["n"]
        if n <= 1:
            return False
        variance = float(row["m2"]) / (n - 1)
        stddev = math.sqrt(max(variance, 0.0))
        if stddev <= 0:
            return False

        sigma_distance = abs(short_mean - long_mean) / stddev
        if sigma_distance < SIGMA_THRESHOLD:
            return False

        # Dedupe: any alert in last 24h for this same combo?
        recent = self.db.fetch_one(
            """
            SELECT 1 FROM e61.brain_signals
             WHERE candidate_id = %(cand)s
               AND signal_type = 'variance_alert'
               AND payload->>'action_type' = %(at)s
               AND payload->>'segment_key' = %(sk)s
               AND emitted_at > NOW() - INTERVAL '%(h)s hours'
             LIMIT 1
            """,
            {
                "cand": str(row["candidate_id"]),
                "at": row["action_type"],
                "sk": row["segment_key"],
                "h": ALERT_DEDUPE_HOURS,
            },
        )
        if recent:
            return False

        return True

    def _emit_alert(self, row: dict) -> None:
        long_mean = float(row["mean_roi"])
        short_mean = float(row["weighted_mean_roi"])
        n = row["n"]
        variance = float(row["m2"]) / (n - 1)
        stddev = math.sqrt(max(variance, 0.0))
        sigma_distance = abs(short_mean - long_mean) / stddev

        # Recommendation: directional
        if short_mean > long_mean:
            recommendation = "increase_allocation"
        else:
            recommendation = "reduce_or_investigate"

        # Severity-based payload — E20 decides priority
        severity = "high" if sigma_distance >= 3.0 else "medium"

        self.brain.emit_variance_alert(
            candidate_id=uuid.UUID(str(row["candidate_id"])),
            action_type=row["action_type"],
            segment_dims=row["segment_dims"],
            prev_mean=long_mean,
            new_mean=short_mean,
            sigma_distance=sigma_distance,
            recommendation=recommendation,
        )
        logger.info(
            "variance_alert emitted: candidate=%s action=%s segment=%s "
            "long_mean=%.2f short_mean=%.2f sigma_dist=%.2f severity=%s",
            row["candidate_id"], row["action_type"], row["segment_key"],
            long_mean, short_mean, sigma_distance, severity,
        )
