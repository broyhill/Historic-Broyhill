"""Iterable → Hetzner propensity sync (Export API → staging.iterable_propensity).

Direction 1 of the dual wire (Nova teardown §4):
  Brand Affinity / Predictive Goals / Channel / STO / Frequency → LP coefficients.

Does NOT write sacred tables. Dry-run safe without DB when dry_run=True.
Live INSERT requires Ed AUTHORIZE + applied dry-run DDL.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ecosystems.e30_email.iterable_client import IterableClient

logger = logging.getLogger("e30.iterable_propensity_sync")


@dataclass
class PropensityRow:
    user_id: str
    brand_affinity_label: Optional[str] = None
    predictive_goal_score: Optional[float] = None
    channel_propensity: Optional[str] = None
    send_time_slot: Optional[str] = None
    frequency_cap: Optional[int] = None
    raw_fields: Dict[str, Any] = field(default_factory=dict)
    pulled_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


def extract_propensity_fields(user_payload: Dict[str, Any]) -> PropensityRow:
    """Map Iterable user/export payload → PropensityRow."""
    user_id = str(
        user_payload.get("userId")
        or user_payload.get("user_id")
        or user_payload.get("email")
        or ""
    )
    fields = user_payload.get("dataFields") or user_payload
    itbl = fields.get("itblDS") if isinstance(fields.get("itblDS"), dict) else {}

    affinity = (
        itbl.get("brandAffinityLabel")
        or fields.get("brandAffinityLabel")
        or fields.get("itblDS.brandAffinityLabel")
    )
    score_raw = (
        fields.get("predictiveGoalScore")
        or fields.get("likelihoodToConvert")
        or itbl.get("predictiveGoalScore")
    )
    try:
        score = float(score_raw) if score_raw is not None else None
    except (TypeError, ValueError):
        score = None

    freq_raw = fields.get("frequencyCap") or fields.get("recommendedFrequency")
    try:
        freq = int(freq_raw) if freq_raw is not None else None
    except (TypeError, ValueError):
        freq = None

    return PropensityRow(
        user_id=user_id,
        brand_affinity_label=affinity,
        predictive_goal_score=score,
        channel_propensity=fields.get("preferredChannel") or fields.get("channelDecision"),
        send_time_slot=fields.get("sendTimeDecision") or fields.get("bestSendTime"),
        frequency_cap=freq,
        raw_fields=fields if isinstance(fields, dict) else {},
    )


class IterablePropensitySync:
    """Pull propensities from Iterable Export / user API into staging."""

    def __init__(self, client: Optional[IterableClient] = None, db_conn=None):
        self.client = client or IterableClient()
        self.db_conn = db_conn

    def pull_user(self, user_id: str) -> Optional[PropensityRow]:
        resp = self.client.get_user_by_id(user_id)
        if not resp.ok:
            logger.warning("Iterable get_user failed for %s: %s", user_id, resp.error)
            return None
        user = resp.body.get("user") or resp.body
        return extract_propensity_fields(user)

    def upsert_rows(self, rows: List[PropensityRow], *, dry_run: bool = True) -> int:
        if dry_run or self.db_conn is None:
            logger.info("Propensity sync dry_run: %d rows (no DB write)", len(rows))
            return len(rows)

        sql = """
            INSERT INTO staging.iterable_propensity (
                user_id, brand_affinity_label, predictive_goal_score,
                channel_propensity, send_time_slot, frequency_cap,
                raw_fields, pulled_at
            ) VALUES (
                %(user_id)s, %(brand_affinity_label)s, %(predictive_goal_score)s,
                %(channel_propensity)s, %(send_time_slot)s, %(frequency_cap)s,
                %(raw_fields)s::jsonb, %(pulled_at)s::timestamptz
            )
            ON CONFLICT (user_id) DO UPDATE SET
                brand_affinity_label = EXCLUDED.brand_affinity_label,
                predictive_goal_score = EXCLUDED.predictive_goal_score,
                channel_propensity = EXCLUDED.channel_propensity,
                send_time_slot = EXCLUDED.send_time_slot,
                frequency_cap = EXCLUDED.frequency_cap,
                raw_fields = EXCLUDED.raw_fields,
                pulled_at = EXCLUDED.pulled_at
        """
        import json

        cur = self.db_conn.cursor()
        for row in rows:
            cur.execute(
                sql,
                {
                    "user_id": row.user_id,
                    "brand_affinity_label": row.brand_affinity_label,
                    "predictive_goal_score": row.predictive_goal_score,
                    "channel_propensity": row.channel_propensity,
                    "send_time_slot": row.send_time_slot,
                    "frequency_cap": row.frequency_cap,
                    "raw_fields": json.dumps(row.raw_fields),
                    "pulled_at": row.pulled_at,
                },
            )
        self.db_conn.commit()
        return len(rows)
