"""
ecosystems/E61_cost_benefit_variance/ml/bayesian.py

Hierarchical Bayesian action selection.

Normal-Normal conjugate update:
    network prior  ~ Normal(mu_net, sigma_net^2)         [shared across candidates]
    obs noise      ~ Normal(0, sigma_obs^2)              [empirical from variance state]
    candidate posterior:
        mu_c     = (n_c * sample_mean / sigma_obs^2 + mu_net / sigma_net^2)
                   / (n_c / sigma_obs^2 + 1 / sigma_net^2)
        sigma_c2 = 1 / (n_c / sigma_obs^2 + 1 / sigma_net^2)

Thompson sampling: for each candidate action, draw sample ~ Normal(mu_c, sigma_c2).
Pick the action with the highest sample. Naturally explores high-uncertainty
actions (wide sigma) and exploits high-mean low-uncertainty actions.

No PyMC, no Stan. Pure numpy. Fast enough for online decisions per request.
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 bayesian normal-normal conjugate-update thompson-sampling hierarchical-prior posterior bootstrap-ci


from __future__ import annotations

import math
import random
import uuid
from dataclasses import dataclass
from typing import Any


@dataclass
class Posterior:
    mu: float
    sigma_sq: float

    @property
    def sigma(self) -> float:
        return math.sqrt(max(self.sigma_sq, 0.0))

    def sample(self) -> float:
        return random.gauss(self.mu, self.sigma)

    def credible_interval(self, level: float = 0.95) -> tuple[float, float]:
        # Approximate normal CI (level=0.95 → ~1.96 sigmas)
        z = _z_for_level(level)
        return (self.mu - z * self.sigma, self.mu + z * self.sigma)


def _z_for_level(level: float) -> float:
    # Simple lookup; enough precision for action selection.
    table = {0.80: 1.282, 0.90: 1.645, 0.95: 1.960, 0.99: 2.576}
    return table.get(round(level, 2), 1.960)


@dataclass
class Prior:
    mu: float
    sigma_sq: float
    n: int


@dataclass
class Observation:
    sample_mean: float
    n: int


def normal_normal_update(prior: Prior, obs: Observation, obs_sigma_sq: float) -> Posterior:
    """
    Conjugate Normal-Normal update.

    obs_sigma_sq is the within-observation variance (noise around the true mean).
    Estimated empirically from the variance_state row's sample variance.
    """
    if obs.n <= 0:
        # No data — posterior IS the prior.
        return Posterior(mu=prior.mu, sigma_sq=prior.sigma_sq)

    # Avoid divide-by-zero; floor obs_sigma_sq
    obs_sigma_sq = max(obs_sigma_sq, 1e-6)
    prior_sigma_sq = max(prior.sigma_sq, 1e-6)

    precision_likelihood = obs.n / obs_sigma_sq
    precision_prior = 1.0 / prior_sigma_sq

    posterior_precision = precision_likelihood + precision_prior
    posterior_mu = (
        obs.sample_mean * precision_likelihood + prior.mu * precision_prior
    ) / posterior_precision
    posterior_sigma_sq = 1.0 / posterior_precision

    return Posterior(mu=posterior_mu, sigma_sq=posterior_sigma_sq)


# ============================================================================
# Selection: Thompson sampling
# ============================================================================

@dataclass
class ActionCandidate:
    action_type: str
    segment_dims: dict
    posterior: Posterior


@dataclass
class SelectionResult:
    selected: ActionCandidate
    sampled_value: float
    all_samples: list[tuple[ActionCandidate, float]]


def thompson_select(candidates: list[ActionCandidate]) -> SelectionResult:
    if not candidates:
        raise ValueError("no candidate actions to select from")

    samples = [(c, c.posterior.sample()) for c in candidates]
    best = max(samples, key=lambda x: x[1])
    return SelectionResult(
        selected=best[0],
        sampled_value=best[1],
        all_samples=samples,
    )


# ============================================================================
# Bootstrap CI for small-n cases (n < 30)
# ============================================================================

def bootstrap_ci(
    observations: list[float],
    iterations: int = 10_000,
    level: float = 0.95,
) -> tuple[float, float]:
    """
    Returns (lower_ci, upper_ci) at the given confidence level.
    Bootstrap with replacement. Use when sample size < 30.

    For larger samples, prefer the analytical Welford-derived CI in
    variance_snapshot computation.
    """
    if not observations:
        return (0.0, 0.0)
    n = len(observations)
    means = []
    for _ in range(iterations):
        sample = [observations[random.randint(0, n - 1)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    lo_idx = int(((1 - level) / 2) * iterations)
    hi_idx = int((1 - (1 - level) / 2) * iterations) - 1
    return (means[lo_idx], means[hi_idx])


# ============================================================================
# Persistence: read priors and observations, compute posteriors
# ============================================================================

class BayesianActionSelector:
    def __init__(self, db: Any):
        self.db = db

    def get_posterior(
        self,
        *,
        candidate_id: uuid.UUID,
        action_type: str,
        segment_key: str,
    ) -> Posterior:
        # Read network prior
        prior_row = self.db.fetch_one(
            """
            SELECT prior_mu, prior_sigma_sq, prior_n, obs_sigma_sq
              FROM e61.bayesian_priors
             WHERE action_type = %(at)s
               AND segment_key = %(sk)s
            """,
            {"at": action_type, "sk": segment_key},
        )
        if prior_row:
            prior = Prior(
                mu=float(prior_row["prior_mu"]),
                sigma_sq=float(prior_row["prior_sigma_sq"]),
                n=prior_row["prior_n"],
            )
            obs_sigma_sq = float(prior_row["obs_sigma_sq"])
        else:
            # No prior yet — uninformative wide prior
            prior = Prior(mu=1.0, sigma_sq=100.0, n=0)
            obs_sigma_sq = 1.0

        # Read candidate-level observation
        cand_row = self.db.fetch_one(
            """
            SELECT n, mean_roi FROM e61.variance_state
             WHERE scope = 'candidate'
               AND candidate_id = %(cand)s
               AND action_type = %(at)s
               AND segment_key = %(sk)s
            """,
            {"cand": str(candidate_id), "at": action_type, "sk": segment_key},
        )

        if cand_row:
            obs = Observation(
                sample_mean=float(cand_row["mean_roi"]),
                n=cand_row["n"],
            )
        else:
            obs = Observation(sample_mean=0.0, n=0)

        return normal_normal_update(prior, obs, obs_sigma_sq)

    def select_action(
        self,
        *,
        candidate_id: uuid.UUID,
        available: list[tuple[str, dict, str]],
        # available = [(action_type, segment_dims, segment_key), ...]
    ) -> SelectionResult:
        candidates = []
        for action_type, segment_dims, segment_key in available:
            post = self.get_posterior(
                candidate_id=candidate_id,
                action_type=action_type,
                segment_key=segment_key,
            )
            candidates.append(ActionCandidate(
                action_type=action_type,
                segment_dims=segment_dims,
                posterior=post,
            ))
        return thompson_select(candidates)
