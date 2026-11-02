"""
ecosystems/E61_cost_benefit_variance/brain/signal_emitter.py

Emits structured signals to E20 Central Brain.

E20 reads e61.brain_signals to prioritize the daily action queue
across the entire stack per candidate. Signals are short-lived
(default 24h TTL) — E20 either consumes or they expire.

Signal types:
    action_recommendation    — "do this next"
    throttle_recommendation  — "scale this channel up/down/off"
    variance_alert           — "ROI confidence crashed; investigate"
    budget_reallocation      — "shift budget from X to Y"
    pause_channel            — "stop sending; downstream issue"

The emitter is the only writer to e61.brain_signals. E20 is the only consumer.
"""

# SEARCH-INDEX: ecosystem=E61 tier=brain
# SEARCH-KEYWORDS: e61 brain e20 signal action-recommendation throttle-recommendation variance-alert pause-channel


from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
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
        expires_at = datetime.utcnow() + timedelta(hours=sig.ttl_hours)
        row = self.db.fetch_one(
            """
            INSERT INTO e61.brain_signals (
                candidate_id, signal_type, payload, expires_at
            ) VALUES (
                %(cand)s, %(stype)s, %(payload)s::jsonb, %(exp)s
            )
            RETURNING id
            """,
            {
                "cand": str(sig.candidate_id),
                "stype": sig.signal_type,
                "payload": json.dumps(sig.payload),
                "exp": expires_at,
            },
        )
        sig_id = uuid.UUID(str(row["id"]))
        logger.info(
            "brain signal emitted: %s for candidate %s (id=%s)",
            sig.signal_type, sig.candidate_id, sig_id,
        )
        return sig_id

    # -- consumption tracking (called by E20 after consuming) ---------------

    def mark_consumed(self, signal_id: uuid.UUID, consumed_by: str = "E20") -> None:
        self.db.execute(
            """
            UPDATE e61.brain_signals
               SET consumed_at = NOW(),
                   consumed_by = %(by)s
             WHERE id = %(id)s
            """,
            {"id": str(signal_id), "by": consumed_by},
        )
