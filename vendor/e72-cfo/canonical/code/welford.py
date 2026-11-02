"""
ecosystems/E61_cost_benefit_variance/ml/welford.py

Streaming variance via Welford's algorithm.

Numerically stable, single-pass, no full history required.
Updates the e61.variance_state row in place via UPSERT.

Also maintains a discount-weighted version for non-stationary tracking
(campaigns are non-stationary — a candidate's bounce after a debate or
scandal shifts the ROI distribution).
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 welford streaming-variance online-algorithm discount-weighting halflife


from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any


@dataclass
class WelfordState:
    n: int = 0
    mean: float = 0.0
    m2: float = 0.0    # sum of squared deviations from mean

    @property
    def variance(self) -> float:
        return self.m2 / (self.n - 1) if self.n > 1 else 0.0

    @property
    def stddev(self) -> float:
        return math.sqrt(self.variance) if self.n > 1 else 0.0

    def update(self, x: float) -> None:
        """Standard Welford update for a single observation."""
        self.n += 1
        delta = x - self.mean
        self.mean += delta / self.n
        delta2 = x - self.mean
        self.m2 += delta * delta2

    def merge(self, other: "WelfordState") -> "WelfordState":
        """Combine two Welford states (for hierarchical aggregation)."""
        if self.n == 0:
            return WelfordState(n=other.n, mean=other.mean, m2=other.m2)
        if other.n == 0:
            return WelfordState(n=self.n, mean=self.mean, m2=self.m2)
        n_total = self.n + other.n
        delta = other.mean - self.mean
        new_mean = self.mean + delta * (other.n / n_total)
        new_m2 = self.m2 + other.m2 + (delta ** 2) * self.n * other.n / n_total
        return WelfordState(n=n_total, mean=new_mean, m2=new_m2)


@dataclass
class DiscountedWelfordState:
    """
    Welford with per-observation weights (for time-decay).
    Weight w_i applied to observation x_i:
        N = sum(w_i)
        mean = sum(w_i * x_i) / N
        M2 = sum(w_i * (x_i - mean)^2)  (computed online via West algorithm)
    """
    weighted_n: float = 0.0
    weighted_mean: float = 0.0
    weighted_m2: float = 0.0

    def update(self, x: float, weight: float) -> None:
        if weight <= 0:
            return
        new_n = self.weighted_n + weight
        delta = x - self.weighted_mean
        new_mean = self.weighted_mean + (weight / new_n) * delta
        delta2 = x - new_mean
        new_m2 = self.weighted_m2 + weight * delta * delta2
        self.weighted_n = new_n
        self.weighted_mean = new_mean
        self.weighted_m2 = new_m2

    @property
    def weighted_variance(self) -> float:
        if self.weighted_n <= 1:
            return 0.0
        return self.weighted_m2 / (self.weighted_n - 1)


def discount_weight(observation_age_days: float, halflife_days: float = 14.0) -> float:
    """
    Exponential decay: weight = 0.5 ^ (age / halflife).
    Default halflife of 14 days matches roughly one news cycle.
    """
    return 0.5 ** (observation_age_days / halflife_days)


# ============================================================================
# Persistence layer — read/update e61.variance_state
# ============================================================================

class VarianceStateStore:
    def __init__(self, db: Any):
        self.db = db

    def update(
        self,
        *,
        scope: str,                           # 'network' | 'candidate'
        candidate_id: uuid.UUID | None,
        action_type: str,
        segment_key: str,
        segment_dims: dict,
        roi_observation: float,
        observation_age_days: float = 0.0,
        halflife_days: float = 14.0,
        observation_at: datetime | None = None,
    ) -> WelfordState:
        # Read current state
        row = self.db.fetch_one(
            """
            SELECT n, mean_roi, m2,
                   weighted_n, weighted_mean_roi, weighted_m2
              FROM e61.variance_state
             WHERE scope = %(scope)s
               AND (candidate_id = %(cand)s OR (candidate_id IS NULL AND %(cand)s IS NULL))
               AND action_type = %(at)s
               AND segment_key = %(sk)s
             FOR UPDATE
            """,
            {
                "scope": scope,
                "cand": str(candidate_id) if candidate_id else None,
                "at": action_type,
                "sk": segment_key,
            },
        )

        state = WelfordState()
        dwstate = DiscountedWelfordState()
        if row:
            state.n = row["n"]
            state.mean = float(row["mean_roi"])
            state.m2 = float(row["m2"])
            dwstate.weighted_n = float(row["weighted_n"])
            dwstate.weighted_mean = float(row["weighted_mean_roi"])
            dwstate.weighted_m2 = float(row["weighted_m2"])

        # Update both states
        state.update(roi_observation)
        dwstate.update(roi_observation, discount_weight(observation_age_days, halflife_days))

        # UPSERT
        self.db.execute(
            """
            INSERT INTO e61.variance_state (
                scope, candidate_id, action_type, segment_key, segment_dims,
                n, mean_roi, m2,
                weighted_n, weighted_mean_roi, weighted_m2,
                last_observation_at, updated_at
            ) VALUES (
                %(scope)s, %(cand)s, %(at)s, %(sk)s, %(sd)s::jsonb,
                %(n)s, %(mean)s, %(m2)s,
                %(wn)s, %(wmean)s, %(wm2)s,
                COALESCE(%(obs_at)s, NOW()), NOW()
            )
            ON CONFLICT (scope, candidate_id, action_type, segment_key) DO UPDATE
               SET n = EXCLUDED.n,
                   mean_roi = EXCLUDED.mean_roi,
                   m2 = EXCLUDED.m2,
                   weighted_n = EXCLUDED.weighted_n,
                   weighted_mean_roi = EXCLUDED.weighted_mean_roi,
                   weighted_m2 = EXCLUDED.weighted_m2,
                   last_observation_at = EXCLUDED.last_observation_at,
                   updated_at = NOW()
            """,
            {
                "scope": scope,
                "cand": str(candidate_id) if candidate_id else None,
                "at": action_type,
                "sk": segment_key,
                "sd": _json(segment_dims),
                "n": state.n,
                "mean": state.mean,
                "m2": state.m2,
                "wn": dwstate.weighted_n,
                "wmean": dwstate.weighted_mean,
                "wm2": dwstate.weighted_m2,
                "obs_at": observation_at,
            },
        )
        return state

    def read(
        self,
        *,
        scope: str,
        candidate_id: uuid.UUID | None,
        action_type: str,
        segment_key: str,
    ) -> WelfordState | None:
        row = self.db.fetch_one(
            """
            SELECT n, mean_roi, m2 FROM e61.variance_state
             WHERE scope = %(scope)s
               AND (candidate_id = %(cand)s OR (candidate_id IS NULL AND %(cand)s IS NULL))
               AND action_type = %(at)s
               AND segment_key = %(sk)s
            """,
            {
                "scope": scope,
                "cand": str(candidate_id) if candidate_id else None,
                "at": action_type,
                "sk": segment_key,
            },
        )
        if not row:
            return None
        return WelfordState(
            n=row["n"], mean=float(row["mean_roi"]), m2=float(row["m2"])
        )


def _json(d: dict) -> str:
    import json
    return json.dumps(d, sort_keys=True)
