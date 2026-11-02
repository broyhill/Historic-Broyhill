"""
ecosystems/E61_cost_benefit_variance/ml/variance_snapshotter.py

Hourly batch job that reads e61.variance_state and writes
e61.variance_snapshots with computed CIs and confidence tiers.

Why a separate snapshot table:
    - variance_state is hot-path UPSERT (every benefit event)
    - snapshots are read-heavy (dashboards, brain queries)
    - separating reads from writes prevents lock contention

Confidence tier rules:
    very_high : n >= 1000 and (CI half-width / mean) <= 0.10
    high      : n >=  300 and (CI half-width / mean) <= 0.20
    medium    : n >=  100 and (CI half-width / mean) <= 0.40
    low       : everything else
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 variance-snapshot hourly dashboard ci-95


from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class VarianceSnapshotter:
    def __init__(self, db: Any):
        self.db = db

    def snapshot_all(self, only_candidate_ids: list[uuid.UUID] | None = None) -> int:
        """
        Materialize variance_snapshots for all (or specified) candidates.
        Returns count of rows written.
        """
        where = ""
        params = {}
        if only_candidate_ids:
            where = "WHERE candidate_id = ANY(%(cands)s)"
            params["cands"] = [str(c) for c in only_candidate_ids]

        rows = self.db.fetch_all(
            f"""
            SELECT scope, candidate_id, action_type, segment_key, segment_dims,
                   n, mean_roi, m2
              FROM e61.variance_state
             {where}
            """,
            params,
        )

        snapshot_at = datetime.utcnow()
        written = 0
        for r in rows:
            n = r["n"]
            mean = float(r["mean_roi"]) if r["mean_roi"] else 0.0
            m2 = float(r["m2"]) if r["m2"] else 0.0

            if n > 1:
                variance = m2 / (n - 1)
                stddev = math.sqrt(variance)
                sem = stddev / math.sqrt(n)
                ci_lo = mean - 1.96 * sem
                ci_hi = mean + 1.96 * sem
            else:
                stddev = None
                ci_lo = ci_hi = None

            tier = self._confidence_tier(n, mean, ci_lo, ci_hi)

            self.db.execute(
                """
                INSERT INTO e61.variance_snapshots (
                    candidate_id, snapshot_at, action_type, segment_key, segment_dims,
                    n, mean_roi, stddev_roi,
                    ci_95_lower, ci_95_upper, confidence_tier
                ) VALUES (
                    %(cand)s, %(at)s, %(action)s, %(sk)s, %(sd)s::jsonb,
                    %(n)s, %(mean)s, %(stddev)s,
                    %(lo)s, %(hi)s, %(tier)s
                )
                """,
                {
                    "cand": str(r["candidate_id"]) if r["candidate_id"] else None,
                    "at": snapshot_at,
                    "action": r["action_type"],
                    "sk": r["segment_key"],
                    "sd": r["segment_dims"] if isinstance(r["segment_dims"], str) else __import__("json").dumps(r["segment_dims"]),
                    "n": n,
                    "mean": mean,
                    "stddev": stddev,
                    "lo": ci_lo,
                    "hi": ci_hi,
                    "tier": tier,
                },
            )
            written += 1

        logger.info("variance snapshots written: %d at %s", written, snapshot_at)
        return written

    @staticmethod
    def _confidence_tier(n: int, mean: float, lo: float | None, hi: float | None) -> str:
        if lo is None or hi is None or mean == 0:
            return "low"
        half_width = (hi - lo) / 2
        ratio = abs(half_width / mean) if mean else 1.0
        if n >= 1000 and ratio <= 0.10:
            return "very_high"
        if n >= 300 and ratio <= 0.20:
            return "high"
        if n >= 100 and ratio <= 0.40:
            return "medium"
        return "low"
