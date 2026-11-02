"""
ecosystems/E61_cost_benefit_variance/tests/test_welford_and_bayesian.py

Pure-math unit tests for E61's ML core. No DB required.

Run with: pytest -xvs tests/test_welford_and_bayesian.py
"""

# SEARCH-INDEX: ecosystem=E61 tier=tests
# SEARCH-KEYWORDS: e61 tests welford bayesian unit-tests


from __future__ import annotations

import math
import statistics
import sys
import os

# Allow running from repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from ecosystems.E61_cost_benefit_variance.ml.welford import (
    WelfordState, DiscountedWelfordState, discount_weight,
)
from ecosystems.E61_cost_benefit_variance.ml.bayesian import (
    Prior, Observation, normal_normal_update, thompson_select, ActionCandidate, Posterior,
    bootstrap_ci,
)


# ---------------------------------------------------------------------------
# Welford
# ---------------------------------------------------------------------------

def test_welford_matches_statistics_module():
    data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    state = WelfordState()
    for x in data:
        state.update(x)

    assert state.n == len(data)
    assert math.isclose(state.mean, statistics.mean(data), rel_tol=1e-9)
    assert math.isclose(state.variance, statistics.variance(data), rel_tol=1e-9)
    assert math.isclose(state.stddev, statistics.stdev(data), rel_tol=1e-9)


def test_welford_merge_equivalent_to_combined():
    a = [1, 2, 3, 4, 5]
    b = [6, 7, 8, 9, 10]
    s_a = WelfordState()
    s_b = WelfordState()
    for x in a: s_a.update(x)
    for x in b: s_b.update(x)
    merged = s_a.merge(s_b)

    s_full = WelfordState()
    for x in a + b: s_full.update(x)

    assert merged.n == s_full.n
    assert math.isclose(merged.mean, s_full.mean, rel_tol=1e-9)
    assert math.isclose(merged.variance, s_full.variance, rel_tol=1e-6)


def test_discount_weight_halflife():
    # weight at age == halflife should be 0.5
    assert math.isclose(discount_weight(14.0, halflife_days=14.0), 0.5, rel_tol=1e-9)
    # weight at 0 days = 1.0
    assert math.isclose(discount_weight(0.0, halflife_days=14.0), 1.0, rel_tol=1e-9)
    # weight at 28 days (2 halflives) = 0.25
    assert math.isclose(discount_weight(28.0, halflife_days=14.0), 0.25, rel_tol=1e-9)


def test_discounted_welford_recent_weighted_higher():
    """A spike of high values recently should pull weighted_mean above unweighted mean."""
    dw = DiscountedWelfordState()
    # 20 old observations near 1.0, then 5 recent ones near 100.0
    for _ in range(20):
        dw.update(1.0, weight=discount_weight(60.0))   # 60 days old, very low weight
    for _ in range(5):
        dw.update(100.0, weight=discount_weight(0.0))  # today, weight 1.0
    assert dw.weighted_mean > 50.0   # heavily pulled toward recent


# ---------------------------------------------------------------------------
# Bayesian Normal-Normal
# ---------------------------------------------------------------------------

def test_no_data_posterior_is_prior():
    prior = Prior(mu=2.0, sigma_sq=1.0, n=100)
    obs = Observation(sample_mean=99.0, n=0)
    post = normal_normal_update(prior, obs, obs_sigma_sq=1.0)
    assert math.isclose(post.mu, prior.mu, rel_tol=1e-9)
    assert math.isclose(post.sigma_sq, prior.sigma_sq, rel_tol=1e-9)


def test_lots_of_data_dominates_prior():
    prior = Prior(mu=2.0, sigma_sq=1.0, n=100)
    obs = Observation(sample_mean=10.0, n=10_000)
    post = normal_normal_update(prior, obs, obs_sigma_sq=1.0)
    # With n=10k and obs_sigma_sq=1, likelihood precision dwarfs prior precision
    assert abs(post.mu - 10.0) < 0.01
    assert post.sigma_sq < 0.001


def test_thompson_picks_mostly_high_mean():
    """With clear separation, Thompson should pick the high-mean action most of the time."""
    import random
    random.seed(42)
    candidates = [
        ActionCandidate("low", {}, Posterior(mu=1.0, sigma_sq=0.1)),
        ActionCandidate("high", {}, Posterior(mu=10.0, sigma_sq=0.1)),
    ]
    picks = [thompson_select(candidates).selected.action_type for _ in range(1000)]
    high_rate = picks.count("high") / 1000
    assert high_rate > 0.95


def test_thompson_explores_high_uncertainty():
    """When two actions have similar means but different uncertainty, the uncertain one
    should still be picked sometimes."""
    import random
    random.seed(42)
    candidates = [
        ActionCandidate("certain", {}, Posterior(mu=5.0, sigma_sq=0.01)),
        ActionCandidate("uncertain", {}, Posterior(mu=5.0, sigma_sq=10.0)),
    ]
    picks = [thompson_select(candidates).selected.action_type for _ in range(1000)]
    uncertain_rate = picks.count("uncertain") / 1000
    # Should be roughly 50/50 since means are equal
    assert 0.35 < uncertain_rate < 0.65


def test_bootstrap_ci_contains_mean():
    import random
    random.seed(42)
    data = [random.gauss(5.0, 1.0) for _ in range(100)]
    sample_mean = sum(data) / len(data)
    lo, hi = bootstrap_ci(data, iterations=1000, level=0.95)
    assert lo < sample_mean < hi
    # CI width should be on the order of standard error (~0.2 for n=100, sigma=1)
    assert (hi - lo) < 1.0


if __name__ == "__main__":
    # Allow running without pytest
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS  {name}")
            except AssertionError as e:
                print(f"FAIL  {name}: {e}")
            except Exception as e:
                print(f"ERROR {name}: {e}")
