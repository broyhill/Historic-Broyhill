"""
ecosystems/E61_cost_benefit_variance/automation/throttle_controller.py

Reads variance state and writes throttle decisions to e61.automation_throttles.
E40 Automation Control reads that table to enforce per-candidate, per-channel
spending limits and pause underperforming channels.

Decision logic (per candidate × ecosystem × action_type):
    if posterior_n < min_sample_for_decision:
        state = "full" (let exploration continue)
    elif ci_95_lower >= candidate.aggressive_floor:
        state = "expand"  (request budget increase)
    elif ci_95_lower >= candidate.minimum_acceptable_roi:
        state = "full"
    elif ci_95_lower >= candidate.minimum_acceptable_roi * 0.5:
        state = "reduce"  (half the daily ceiling)
    else:
        state = "pause"   (block emission, alert staff)

Decisions are recomputed every 15 minutes by a scheduled job, OR
on-demand when a benefit event lands and shifts the posterior materially.
"""

# SEARCH-INDEX: ecosystem=E61 tier=automation
# SEARCH-KEYWORDS: e61 automation e40 throttle full reduce pause expand ceiling


from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ThrottleDecision:
    candidate_id: uuid.UUID
    ecosystem_code: str
    action_type: str
    new_state: str
    daily_ceiling_usd_cents: int | None
    rationale: str
    posterior_mu: float
    ci_lower: float
    sample_size: int


class ThrottleController:
    MIN_SAMPLE_FOR_DECISION = 30

    def __init__(self, db: Any, signal_emitter=None):
        self.db = db
        self.signal_emitter = signal_emitter

    def evaluate_candidate(
        self,
        *,
        candidate_id: uuid.UUID,
        force_recompute: bool = False,
    ) -> list[ThrottleDecision]:
        """
        Walk every (ecosystem, action_type) the candidate uses; compute
        throttle state per the decision logic; UPSERT into e61.automation_throttles.
        """
        # Fetch candidate's policy floor
        policy = self._get_candidate_policy(candidate_id)

        # Fetch all (ecosystem, action_type) the candidate has emitted in last 30d
        active_actions = self.db.fetch_all(
            """
            SELECT DISTINCT ac.ecosystem_code, ac.action_type
              FROM e61.action_costs ac
             WHERE ac.candidate_id = %(cand)s
               AND ac.emitted_at >= NOW() - INTERVAL '30 days'
            """,
            {"cand": str(candidate_id)},
        )

        decisions = []
        for row in active_actions:
            decision = self._evaluate_one(
                candidate_id=candidate_id,
                ecosystem_code=row["ecosystem_code"],
                action_type=row["action_type"],
                policy=policy,
            )
            if decision is None:
                continue

            # Skip UPSERT if state hasn't changed and not forced
            if not force_recompute and not self._state_changed(decision):
                continue

            self._persist_decision(decision)
            decisions.append(decision)

            # Emit brain signal for material state changes
            if self.signal_emitter and decision.new_state in ("pause", "reduce"):
                self.signal_emitter.emit_throttle_recommendation(
                    candidate_id=candidate_id,
                    ecosystem_code=decision.ecosystem_code,
                    action_type=decision.action_type,
                    new_state=decision.new_state,
                    rationale=decision.rationale,
                    roi_at_decision=decision.posterior_mu,
                    ci_lower_at_decision=decision.ci_lower,
                )

        logger.info(
            "throttle evaluation complete for candidate %s: %d decisions",
            candidate_id, len(decisions),
        )
        return decisions

    # -- decision logic ------------------------------------------------------

    def _evaluate_one(
        self,
        *,
        candidate_id: uuid.UUID,
        ecosystem_code: str,
        action_type: str,
        policy: dict,
    ) -> ThrottleDecision | None:
        # Aggregate variance state across all segments for this action
        agg = self.db.fetch_one(
            """
            SELECT SUM(n) AS total_n,
                   -- weighted average mean across segments by n
                   SUM(n * mean_roi) / NULLIF(SUM(n), 0) AS agg_mean,
                   -- pooled variance
                   SUM(m2) / NULLIF(SUM(n) - 1, 0) AS pooled_variance
              FROM e61.variance_state
             WHERE scope = 'candidate'
               AND candidate_id = %(cand)s
               AND action_type = %(at)s
            """,
            {"cand": str(candidate_id), "at": action_type},
        )
        if not agg or not agg["total_n"]:
            return None

        n = int(agg["total_n"])
        mu = float(agg["agg_mean"]) if agg["agg_mean"] is not None else 0.0
        var = float(agg["pooled_variance"]) if agg["pooled_variance"] else 0.0
        stddev = math.sqrt(var)
        sem = stddev / math.sqrt(n) if n > 0 else 0.0
        ci_lower = mu - 1.96 * sem
        ci_upper = mu + 1.96 * sem

        floor = policy["minimum_acceptable_roi"]
        aggressive = policy["aggressive_floor"]

        if n < self.MIN_SAMPLE_FOR_DECISION:
            state = "full"
            rationale = f"sample size {n} below minimum {self.MIN_SAMPLE_FOR_DECISION}; allowing exploration"
            ceiling = policy["default_daily_ceiling_cents"]
        elif ci_lower >= aggressive:
            state = "expand"
            rationale = f"CI lower {ci_lower:.2f}x exceeds aggressive floor {aggressive}x; recommend budget increase"
            ceiling = int(policy["default_daily_ceiling_cents"] * 1.5)
        elif ci_lower >= floor:
            state = "full"
            rationale = f"CI lower {ci_lower:.2f}x clears acceptable floor {floor}x"
            ceiling = policy["default_daily_ceiling_cents"]
        elif ci_lower >= floor * 0.5:
            state = "reduce"
            rationale = f"CI lower {ci_lower:.2f}x below floor {floor}x but above half-floor; reducing"
            ceiling = int(policy["default_daily_ceiling_cents"] * 0.5)
        else:
            state = "pause"
            rationale = f"CI lower {ci_lower:.2f}x below half-floor {floor * 0.5:.2f}x; pause and investigate"
            ceiling = 0

        return ThrottleDecision(
            candidate_id=candidate_id,
            ecosystem_code=ecosystem_code,
            action_type=action_type,
            new_state=state,
            daily_ceiling_usd_cents=ceiling,
            rationale=rationale,
            posterior_mu=mu,
            ci_lower=ci_lower,
            sample_size=n,
        )

    def _get_candidate_policy(self, candidate_id: uuid.UUID) -> dict:
        row = self.db.fetch_one(
            """
            SELECT minimum_acceptable_roi,
                   aggressive_floor,
                   default_daily_ceiling_cents
              FROM core.candidate_throttle_policy
             WHERE candidate_id = %(cand)s
            """,
            {"cand": str(candidate_id)},
        )
        if row:
            return dict(row)
        # Defaults
        return {
            "minimum_acceptable_roi": 1.5,
            "aggressive_floor": 5.0,
            "default_daily_ceiling_cents": 50_000,    # $500/day default
        }

    def _state_changed(self, decision: ThrottleDecision) -> bool:
        existing = self.db.fetch_one(
            """
            SELECT throttle_state FROM e61.automation_throttles
             WHERE candidate_id = %(cand)s
               AND ecosystem_code = %(eco)s
               AND action_type = %(at)s
            """,
            {
                "cand": str(decision.candidate_id),
                "eco": decision.ecosystem_code,
                "at": decision.action_type,
            },
        )
        return existing is None or existing["throttle_state"] != decision.new_state

    def _persist_decision(self, d: ThrottleDecision) -> None:
        self.db.execute(
            """
            INSERT INTO e61.automation_throttles (
                candidate_id, ecosystem_code, action_type,
                throttle_state, daily_ceiling_usd_cents,
                rationale, set_by, set_at, expires_at
            ) VALUES (
                %(cand)s, %(eco)s, %(at)s,
                %(state)s, %(ceiling)s,
                %(rationale)s, 'e61_auto', NOW(), NOW() + INTERVAL '24 hours'
            )
            ON CONFLICT (candidate_id, ecosystem_code, action_type) DO UPDATE
               SET throttle_state = EXCLUDED.throttle_state,
                   daily_ceiling_usd_cents = EXCLUDED.daily_ceiling_usd_cents,
                   rationale = EXCLUDED.rationale,
                   set_by = EXCLUDED.set_by,
                   set_at = NOW(),
                   expires_at = NOW() + INTERVAL '24 hours'
            """,
            {
                "cand": str(d.candidate_id),
                "eco": d.ecosystem_code,
                "at": d.action_type,
                "state": d.new_state,
                "ceiling": d.daily_ceiling_usd_cents,
                "rationale": d.rationale,
            },
        )
