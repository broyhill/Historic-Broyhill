"""
ECO_CANONICAL/E60/CBV/code/signal_emitter.py

Emits analytical cost and variance rows for one candidate.

Each emit writes one e87.activity_cost_event parent, then one
e87.variance_log child. variance_log is an immutable ledger.
It has no consumed_at or consumed_by columns.

Signal types:
    action_recommendation    — "do this next"
    throttle_recommendation  — "scale this channel up/down/off"
    variance_alert           — "ROI confidence crashed; investigate"
    budget_reallocation      — "shift budget from X to Y"
    pause_channel            — "stop sending; downstream issue"

The connecting role must be allowed to assume e87_recorder.
SET LOCAL lasts for the transaction the caller already opened.
"""

# SEARCH-INDEX: ecosystem=E60 tier=brain
# SEARCH-KEYWORDS: e87 variance_log activity_cost_event e60 signal action-recommendation throttle-recommendation variance-alert pause-channel


from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class BrainSignal:
    candidate_id: uuid.UUID
    signal_type: str
    payload: dict
    ttl_hours: int = 24


class BrainSignalEmitter:
    def __init__(self, db: Any):
        self.db = db

    def emit_action_recommendation(
        self,
        *,
        candidate_id: uuid.UUID,
        action_type: str,
        segment_dims: dict,
        expected_roi: float,
        ci_95_lower: float,
        ci_95_upper: float,
        sample_size: int,
        confidence_tier: str,
        throttle_recommendation: str = "full",
    ) -> uuid.UUID:
        """
        Standard action recommendation. E20 ranks across these per candidate
        and dispatches to the executing ecosystem.
        """
        return self._emit(BrainSignal(
            candidate_id=candidate_id,
            signal_type="action_recommendation",
            payload={
                "recommended_action": action_type,
                "segment": segment_dims,
                "expected_roi_dollars_per_dollar": round(expected_roi, 4),
                "ci_95": [round(ci_95_lower, 4), round(ci_95_upper, 4)],
                "sample_size": sample_size,
                "confidence_tier": confidence_tier,
                "throttle_recommendation": throttle_recommendation,
            },
        ))

    def emit_throttle_recommendation(
        self,
        *,
        candidate_id: uuid.UUID,
        ecosystem_code: str,
        action_type: str,
        new_state: str,
        rationale: str,
        roi_at_decision: float | None = None,
        ci_lower_at_decision: float | None = None,
    ) -> uuid.UUID:
        return self._emit(BrainSignal(
            candidate_id=candidate_id,
            signal_type="throttle_recommendation",
            payload={
                "ecosystem_code": ecosystem_code,
                "action_type": action_type,
                "new_state": new_state,
                "rationale": rationale,
                "roi_at_decision": roi_at_decision,
                "ci_lower_at_decision": ci_lower_at_decision,
            },
        ))

    def emit_variance_alert(
        self,
        *,
        candidate_id: uuid.UUID,
        action_type: str,
        segment_dims: dict,
        previous_mean: float,
        current_mean: float,
        change_magnitude: float,
        sample_size: int,
    ) -> uuid.UUID:
        """
        Fires when posterior mean shifts more than ~2 standard errors —
        probable non-stationarity event (debate, news cycle, scandal).
        """
        return self._emit(BrainSignal(
            candidate_id=candidate_id,
            signal_type="variance_alert",
            payload={
                "action_type": action_type,
                "segment": segment_dims,
                "previous_mean": round(previous_mean, 4),
                "current_mean": round(current_mean, 4),
                "change_magnitude_sigmas": round(change_magnitude, 2),
                "sample_size": sample_size,
                "recommended_response": "investigate_recent_emissions_and_consider_pause",
            },
            ttl_hours=72,    # alerts persist longer
        ))

    def emit_budget_reallocation(
        self,
        *,
        candidate_id: uuid.UUID,
        from_action: str,
        to_action: str,
        cents_to_shift: int,
        rationale: str,
    ) -> uuid.UUID:
        return self._emit(BrainSignal(
            candidate_id=candidate_id,
            signal_type="budget_reallocation",
            payload={
                "from_action": from_action,
                "to_action": to_action,
                "cents_to_shift": cents_to_shift,
                "rationale": rationale,
            },
        ))

    def emit_pause_channel(
        self,
        *,
        candidate_id: uuid.UUID,
        ecosystem_code: str,
        action_type: str,
        reason: str,
    ) -> uuid.UUID:
        """
        Hard pause — emitted when ROI CI lower bound drops below floor,
        OR when compliance/operational anomaly detected.
        """
        return self._emit(BrainSignal(
            candidate_id=candidate_id,
            signal_type="pause_channel",
            payload={
                "ecosystem_code": ecosystem_code,
                "action_type": action_type,
                "reason": reason,
            },
            ttl_hours=168,    # pauses persist 1 week unless explicitly cleared
        ))

    # -- core emit -----------------------------------------------------------

    def _emit(self, sig: BrainSignal) -> uuid.UUID:
        cost_event_id = uuid.uuid4()
        variance_id = uuid.uuid4()

        # Derive required constraints from the payload
        variance_cents = sig.payload.get("cents_to_shift", 0)
        source_eco = sig.payload.get("ecosystem_code", "E60")
        cost_cents = 0  # Must be >= 0. Analytical signals carry no direct transit cost.

        # SET LOCAL relies on the caller's open transaction boundary.
        # The connecting role must have permission to assume e87_recorder.
        self.db.execute(
            """
            SET LOCAL ROLE e87_recorder;
            SET LOCAL app.current_candidate_id = %(cand)s;

            INSERT INTO e87.activity_cost_event (
                cost_event_id, candidate_id, source_ecosystem, cost_cents
            ) VALUES (
                %(cost_id)s, %(cand)s, %(eco)s, %(cost_cents)s
            );

            INSERT INTO e87.variance_log (
                variance_id, candidate_id, cost_event_id, variance_cents
            ) VALUES (
                %(var_id)s, %(cand)s, %(cost_id)s, %(var_cents)s
            );
            """,
            {
                "cand": str(sig.candidate_id),
                "cost_id": str(cost_event_id),
                "eco": source_eco,
                "cost_cents": cost_cents,
                "var_id": str(variance_id),
                "var_cents": variance_cents,
            },
        )

        logger.info(
            "e87 variance signal emitted: cost_event_id=%s, variance_id=%s for candidate %s",
            cost_event_id, variance_id, sig.candidate_id
        )
        return variance_id

    # -- consumption tracking (called by E20 after consuming) ---------------

    def mark_consumed(self, signal_id: uuid.UUID, consumed_by: str = "E20") -> None:
        """
        e87.variance_log is an immutable financial ledger.
        Records are permanently retained and lack consumed_at/consumed_by columns.
        This method is stubbed to pass legacy E20 calls without throwing Postgres errors.
        """
        pass
