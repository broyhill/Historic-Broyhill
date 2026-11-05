"""Feature assembly for BANT — maps platform spines into a score vector.

When a DB connection is provided, pulls live aggregates. Without DB (unit tests /
observe dry path), accepts an explicit feature dict.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, Mapping, Optional, Protocol


class DbCursor(Protocol):
    def execute(self, query: str, params: Any = None) -> Any: ...
    def fetchone(self) -> Any: ...


@dataclass
class FeatureVector:
    silo_id: str
    cluster_id: int
    jurisdiction_key: Optional[str] = None
    values: Dict[str, float] = field(default_factory=dict)
    flags: Dict[str, bool] = field(default_factory=dict)
    meta: Dict[str, Any] = field(default_factory=dict)

    def source_hash(self) -> str:
        payload = {
            "silo_id": self.silo_id,
            "cluster_id": self.cluster_id,
            "jurisdiction_key": self.jurisdiction_key,
            "values": self.values,
            "flags": self.flags,
        }
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def to_json(self) -> Dict[str, Any]:
        return asdict(self)


# Default weights aligned with bant.feature_dictionary seed
DEFAULT_FEATURE_WEIGHTS: Dict[str, float] = {
    "F_DON_TOTAL_10Y": 0.18,
    "F_DON_RECENCY_DAYS": 0.12,
    "F_DON_FREQUENCY": 0.10,
    "F_VOTE_PRIMARY_R": 0.10,
    "F_VOTE_TURNOUT": 0.06,
    "F_ACX_AFFLUENCE": 0.08,
    "F_ENTITY_PAC_INT": 0.08,
    "F_HEAT_ISSUE": 0.10,
    "F_SEG_ALIVE_HIT": 0.08,
    "F_FATIGUE_HEADROOM": 0.10,
}


def _clamp01(x: float) -> float:
    if x < 0:
        return 0.0
    if x > 1:
        return 1.0
    return float(x)


def normalize_donation_total(amount: float) -> float:
    """Log-ish capacity curve: $0→0, ~$500→0.5, $10k+→~1."""
    if amount <= 0:
        return 0.0
    import math

    return _clamp01(math.log1p(amount) / math.log1p(10000.0))


def normalize_recency_days(days: Optional[float]) -> float:
    """Fresher gifts score higher. None / very old → low."""
    if days is None:
        return 0.15
    if days < 0:
        days = 0
    # 0 days → 1.0; 365 → ~0.37; 1095 → ~0.05
    import math

    return _clamp01(math.exp(-float(days) / 365.0))


def assemble_from_mapping(
    silo_id: str,
    cluster_id: int,
    features: Mapping[str, Any],
    jurisdiction_key: Optional[str] = None,
) -> FeatureVector:
    """Build a FeatureVector from an explicit mapping (API / tests)."""
    values: Dict[str, float] = {}
    flags: Dict[str, bool] = {}
    for key, raw in features.items():
        if isinstance(raw, bool):
            flags[key] = raw
            values[key] = 1.0 if raw else 0.0
        else:
            try:
                values[key] = float(raw)
            except (TypeError, ValueError):
                continue
    return FeatureVector(
        silo_id=silo_id,
        cluster_id=int(cluster_id),
        jurisdiction_key=jurisdiction_key,
        values=values,
        flags=flags,
    )


def assemble_from_db(
    cur: DbCursor,
    silo_id: str,
    cluster_id: int,
    jurisdiction_key: Optional[str] = None,
) -> FeatureVector:
    """
    Best-effort live feature pull. Tolerates missing tables (returns zeros).
    Does NOT touch sacred write paths — SELECT only.
    """
    values: Dict[str, float] = {k: 0.0 for k in DEFAULT_FEATURE_WEIGHTS}
    flags: Dict[str, bool] = {"F_SEG_ALIVE_HIT": False}
    meta: Dict[str, Any] = {"source": "db", "partial": False}

    # Donation rollup from the canonical spine (same table as the LTV lane)
    try:
        cur.execute(
            """
            SELECT
              COALESCE(SUM(s.amount), 0) AS total,
              COUNT(*)::float AS freq,
              EXTRACT(EPOCH FROM (NOW() - MAX(s.donation_date))) / 86400.0 AS recency_days
            FROM spine.donor_transactions s
            JOIN core.donor_profile d ON d.rnc_regid = s.rnc_regid
            WHERE d.cluster_id = %s AND s.amount > 0
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row:
            total, freq, recency = row[0], row[1], row[2]
            values["F_DON_TOTAL_10Y"] = normalize_donation_total(float(total or 0))
            values["F_DON_FREQUENCY"] = _clamp01(float(freq or 0) / 20.0)
            values["F_DON_RECENCY_DAYS"] = normalize_recency_days(
                float(recency) if recency is not None else None
            )
    except Exception as exc:  # noqa: BLE001 — observe path must not crash scorer
        meta["partial"] = True
        meta["donation_error"] = str(exc)

    # Opponent-safe hint if column exists (R4)
    try:
        cur.execute(
            """
            SELECT COALESCE(opponent_donor_safe, TRUE)
            FROM core.donor_profile
            WHERE cluster_id = %s
            LIMIT 1
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row is not None:
            meta["opponent_safe"] = bool(row[0])
    except Exception:
        meta["opponent_safe"] = True

    # F_ACX_AFFLUENCE — modeled income as affluence proxy.
    # income_modeled is an Acxiom TEXT band; map to a midpoint, fall back to ACS.
    try:
        cur.execute(
            """
            SELECT COALESCE(
              CASE income_modeled
                WHEN 'Less than $15000'      THEN 7500
                WHEN '$15000 - $19999'       THEN 17500
                WHEN '$20000 - $29999'       THEN 25000
                WHEN '$30000 - $39999'       THEN 35000
                WHEN '$40000 - $49999'       THEN 45000
                WHEN '$50000 - $74999'       THEN 62500
                WHEN '$75000 - $99999'       THEN 87500
                WHEN '$100000 - $124999'     THEN 112500
                WHEN 'Greater than $124999'  THEN 150000
              END,
              acs_median_household_income, 0)
            FROM core.donor_profile WHERE cluster_id = %s LIMIT 1
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row and row[0]:
            values["F_ACX_AFFLUENCE"] = _clamp01(float(row[0]) / 250000.0)
    except Exception as exc:  # noqa: BLE001
        meta["partial"] = True
        meta["acx_error"] = str(exc)

    # F_SEG_ALIVE_HIT — live microsegment membership
    try:
        cur.execute(
            """
            SELECT MAX(segment_match_score)
            FROM e59.donor_segment_assignment WHERE cluster_id = %s
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row and row[0] is not None:
            # segment_match_score is 0-100 live (verified 50-92 range)
            values["F_SEG_ALIVE_HIT"] = _clamp01(float(row[0]) / 100.0)
            flags["F_SEG_ALIVE_HIT"] = True
    except Exception as exc:  # noqa: BLE001
        meta["partial"] = True
        meta["seg_error"] = str(exc)

    # F_VOTE_PRIMARY_R + F_VOTE_TURNOUT — DataTrust vote signals
    try:
        cur.execute(
            """
            SELECT COALESCE(republican_ballot_score,0),
                   COALESCE(voter_turnout_score,0),
                   COALESCE(is_primary_voter, FALSE)
            FROM core.donor_profile WHERE cluster_id = %s LIMIT 1
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row:
            # republican_ballot_score and voter_turnout_score are 0-1 live
            values["F_VOTE_PRIMARY_R"] = _clamp01(
                float(row[0]) + (0.2 if row[2] else 0.0)
            )
            values["F_VOTE_TURNOUT"] = _clamp01(float(row[1]))
    except Exception as exc:  # noqa: BLE001
        meta["partial"] = True
        meta["vote_error"] = str(exc)

    # F_FATIGUE_HEADROOM — 7-day touch headroom vs K
    try:
        cur.execute(
            """
            SELECT COUNT(*) FROM brain.channel_fatigue_ledger f
            JOIN core.donor_profile d ON d.rnc_regid = f.rnc_regid
            WHERE d.cluster_id = %s
              AND f.created_at >= NOW() - INTERVAL '7 days'
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        touches = float(row[0]) if row else 0.0
        k_cap = 3.0
        values["F_FATIGUE_HEADROOM"] = _clamp01(max(0.0, k_cap - touches) / k_cap)
    except Exception:  # noqa: BLE001 — ledger empty/absent = full headroom
        values["F_FATIGUE_HEADROOM"] = 1.0
        meta["fatigue_note"] = "ledger empty -> full headroom"

    # F_ENTITY_PAC_INT — share of giving to PAC/527 buckets
    try:
        cur.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN s.bucket IN ('fec_pac','irs_527','nc_pac_indiv')
                                THEN s.amount ELSE 0 END), 0) AS pac_amt,
              COALESCE(SUM(s.amount), 0) AS tot_amt
            FROM spine.donor_transactions s
            JOIN core.donor_profile d ON d.rnc_regid = s.rnc_regid
            WHERE d.cluster_id = %s AND s.amount > 0
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if row and row[1] and float(row[1]) > 0:
            values["F_ENTITY_PAC_INT"] = _clamp01(float(row[0]) / float(row[1]))
    except Exception as exc:  # noqa: BLE001
        meta["partial"] = True
        meta["pac_error"] = str(exc)

    # F_HEAT_ISSUE — BLOCKED: E42 issue-donor join layer is empty (0 rows).
    # Intentionally left at 0.0. Wire when the E42 join layer populates.
    meta["heat_blocked"] = "E42 join layer empty 2026-08-07"

    return FeatureVector(
        silo_id=silo_id,
        cluster_id=int(cluster_id),
        jurisdiction_key=jurisdiction_key,
        values=values,
        flags=flags,
        meta=meta,
    )
