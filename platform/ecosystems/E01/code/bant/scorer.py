"""BANT scoring engine — pure functions + optional DB persist."""

from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Sequence

from .config import BantConfig
from .features import (
    DEFAULT_FEATURE_WEIGHTS,
    FeatureVector,
    assemble_from_db,
    assemble_from_mapping,
)


@dataclass
class BantScore:
    silo_id: str
    cluster_id: int
    model_id: str
    budget_score: int
    authority_score: int
    need_score: int
    timing_score: int
    bant_composite: float
    p_act: float
    expected_amount: Optional[float]
    tier: str
    reason_vector: List[Dict[str, Any]] = field(default_factory=list)
    microsegment_hints: List[str] = field(default_factory=list)
    jurisdiction_key: Optional[str] = None
    opponent_safe: bool = True
    features_used: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _to_100(x: float) -> int:
    return int(max(0, min(100, round(x * 100))))


class BantScorer:
    """
    Stateless scorer. Call `score_one` / `score_batch`.
    Persistence is optional via `repository` (see db.BantRepository).
    """

    def __init__(self, config: Optional[BantConfig] = None, repository: Any = None):
        self.config = config or BantConfig()
        self.repository = repository

    def score_features(self, fv: FeatureVector) -> BantScore:
        v = fv.values
        w = DEFAULT_FEATURE_WEIGHTS

        # Budget: capacity + history
        budget = (
            0.55 * v.get("F_DON_TOTAL_10Y", 0.0)
            + 0.25 * v.get("F_ACX_AFFLUENCE", 0.0)
            + 0.20 * v.get("F_DON_FREQUENCY", 0.0)
        )
        # Authority: influence / entity alignment / segment membership
        authority = (
            0.40 * v.get("F_ENTITY_PAC_INT", 0.0)
            + 0.35 * v.get("F_SEG_ALIVE_HIT", 0.0)
            + 0.25 * v.get("F_DON_FREQUENCY", 0.0)
        )
        # Need: issue heat + voter alignment to candidate agenda
        need = (
            0.45 * v.get("F_HEAT_ISSUE", 0.0)
            + 0.35 * v.get("F_VOTE_PRIMARY_R", 0.0)
            + 0.20 * v.get("F_VOTE_TURNOUT", 0.0)
        )
        # Timing: recency + fatigue headroom + heat urgency
        timing = (
            0.45 * v.get("F_DON_RECENCY_DAYS", 0.0)
            + 0.35 * v.get("F_FATIGUE_HEADROOM", 0.0)
            + 0.20 * v.get("F_HEAT_ISSUE", 0.0)
        )

        dims = {
            "budget": max(0.0, min(1.0, budget)),
            "authority": max(0.0, min(1.0, authority)),
            "need": max(0.0, min(1.0, need)),
            "timing": max(0.0, min(1.0, timing)),
        }
        weights = self.config.dimension_weights()
        composite01 = sum(dims[k] * weights[k] for k in dims)
        composite = round(composite01 * 100.0, 3)

        # Simple P(act) from composite; expected amount from capacity feature
        p_act = max(0.0, min(1.0, 0.05 + 0.90 * composite01))
        capacity = v.get("F_DON_TOTAL_10Y", 0.0)
        expected_amount = round(25.0 + capacity * 2475.0, 2)  # $25–$2500 curve

        reasons = self._reasons(fv, dims)
        hints = self._segment_hints(fv, dims)
        opponent_safe = bool(fv.meta.get("opponent_safe", True))

        return BantScore(
            silo_id=fv.silo_id,
            cluster_id=fv.cluster_id,
            model_id=self.config.model_id,
            budget_score=_to_100(dims["budget"]),
            authority_score=_to_100(dims["authority"]),
            need_score=_to_100(dims["need"]),
            timing_score=_to_100(dims["timing"]),
            bant_composite=composite,
            p_act=round(p_act, 6),
            expected_amount=expected_amount,
            tier=self.config.tier_for(composite),
            reason_vector=reasons,
            microsegment_hints=hints,
            jurisdiction_key=fv.jurisdiction_key,
            opponent_safe=opponent_safe,
            features_used={k: float(v.get(k, 0.0)) for k in w},
        )

    def score_one(
        self,
        silo_id: str,
        cluster_id: int,
        features: Optional[Dict[str, Any]] = None,
        jurisdiction_key: Optional[str] = None,
        persist: bool = False,
        cur: Any = None,
    ) -> BantScore:
        if features is not None:
            fv = assemble_from_mapping(silo_id, cluster_id, features, jurisdiction_key)
        elif cur is not None:
            fv = assemble_from_db(cur, silo_id, cluster_id, jurisdiction_key)
        else:
            fv = assemble_from_mapping(silo_id, cluster_id, {}, jurisdiction_key)

        score = self.score_features(fv)
        if persist and self.repository is not None:
            self.repository.save_score(score, fv)
        return score

    def score_batch(
        self,
        silo_id: str,
        items: Sequence[Dict[str, Any]],
        persist: bool = False,
    ) -> List[BantScore]:
        out: List[BantScore] = []
        for item in items:
            out.append(
                self.score_one(
                    silo_id=silo_id,
                    cluster_id=int(item["cluster_id"]),
                    features=item.get("features"),
                    jurisdiction_key=item.get("jurisdiction_key"),
                    persist=persist,
                )
            )
        return out

    @staticmethod
    def _reasons(fv: FeatureVector, dims: Dict[str, float]) -> List[Dict[str, Any]]:
        ranked = sorted(dims.items(), key=lambda kv: kv[1], reverse=True)
        reasons = []
        for name, val in ranked[:3]:
            reasons.append(
                {
                    "dimension": name,
                    "strength": round(val, 4),
                    "note": f"Top driver: {name}",
                }
            )
        if fv.flags.get("F_SEG_ALIVE_HIT"):
            reasons.append(
                {
                    "dimension": "segment",
                    "strength": 1.0,
                    "note": "Alive microsegment membership",
                }
            )
        return reasons

    @staticmethod
    def _segment_hints(fv: FeatureVector, dims: Dict[str, float]) -> List[str]:
        hints: List[str] = []
        if dims["need"] >= 0.6:
            hints.append("issue_heat_aligned")
        if dims["budget"] >= 0.6:
            hints.append("capacity_high")
        if dims["timing"] >= 0.6:
            hints.append("timing_window_open")
        if fv.jurisdiction_key:
            hints.append(f"jurisdiction:{fv.jurisdiction_key}")
        return hints
