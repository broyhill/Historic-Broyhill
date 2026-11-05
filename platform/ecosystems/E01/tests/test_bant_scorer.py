"""Unit tests for BANT scorer — no DB required."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `from bant...` when tests run from repo root
ROOT = Path(__file__).resolve().parents[3]  # ECO_CANONICAL
E01_CODE = Path(__file__).resolve().parents[1] / "code"
sys.path.insert(0, str(E01_CODE))

from bant.config import BantConfig
from bant.scorer import BantScorer
from bant.features import assemble_from_mapping, normalize_donation_total


def test_high_capacity_high_heat_scores_tier_a_or_b():
    scorer = BantScorer(BantConfig())
    features = {
        "F_DON_TOTAL_10Y": 0.95,
        "F_DON_RECENCY_DAYS": 0.9,
        "F_DON_FREQUENCY": 0.8,
        "F_VOTE_PRIMARY_R": 0.85,
        "F_VOTE_TURNOUT": 0.7,
        "F_ACX_AFFLUENCE": 0.8,
        "F_ENTITY_PAC_INT": 0.6,
        "F_HEAT_ISSUE": 0.9,
        "F_SEG_ALIVE_HIT": True,
        "F_FATIGUE_HEADROOM": 0.85,
    }
    score = scorer.score_one(
        silo_id="candidate_demo",
        cluster_id=1001,
        features=features,
        jurisdiction_key="NC-SD-31",
    )
    assert score.tier in {"A", "B"}
    assert 0 <= score.budget_score <= 100
    assert 0 <= score.bant_composite <= 100
    assert 0 <= score.p_act <= 1
    assert score.opponent_safe is True
    assert "capacity_high" in score.microsegment_hints or score.budget_score >= 60


def test_empty_features_returns_low_tier():
    scorer = BantScorer(BantConfig())
    score = scorer.score_one(silo_id="s1", cluster_id=2, features={})
    assert score.tier in {"U", "D", "C"}
    assert score.bant_composite < 55


def test_feature_hash_stable():
    a = assemble_from_mapping("s", 9, {"F_HEAT_ISSUE": 0.5})
    b = assemble_from_mapping("s", 9, {"F_HEAT_ISSUE": 0.5})
    assert a.source_hash() == b.source_hash()


def test_normalize_donation_total_monotonic():
    assert normalize_donation_total(0) == 0
    assert normalize_donation_total(500) < normalize_donation_total(5000)


def test_batch_scores_preserve_order():
    scorer = BantScorer(BantConfig())
    items = [
        {"cluster_id": 1, "features": {"F_DON_TOTAL_10Y": 0.1}},
        {"cluster_id": 2, "features": {"F_DON_TOTAL_10Y": 0.9}},
    ]
    out = scorer.score_batch("silo", items)
    assert [o.cluster_id for o in out] == [1, 2]
    assert out[1].budget_score >= out[0].budget_score
