"""
ecosystems/E61_cost_benefit_variance/ml/network_prior_recomputer.py

Weekly batch that aggregates candidate-scope variance_state rows
into network-aggregate priors.

Mathematical contract:
    For each (action_type, segment_key) tuple appearing across enough
    candidates (n_candidates >= MIN_CANDIDATES_FOR_PRIOR), compute:

        prior_mu        = pooled mean across candidate means
        prior_sigma_sq  = between-candidate variance (how much candidates differ)
        obs_sigma_sq    = pooled within-candidate variance (action-level noise)
        prior_n         = sum of candidate sample sizes

    These priors anchor new candidates' posteriors when they have no data,
    and smoothly let candidate-specific signal dominate as n grows.

The prior table is shared (no candidate_id) — RLS-bypass write only.
Candidates can read priors but never see other candidates' contributions.

Run weekly (Sunday 02:00 UTC). Heavy job — full table scan but only ~minutes
at 100K-row variance_state scale.
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 network-prior bayesian-prior recompute weekly hierarchical aggregation


from __future__ import annotations

import json
import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


MIN_CANDIDATES_FOR_PRIOR = 5    # need ≥5 candidates contributing before computing a network prior
MIN_TOTAL_SAMPLES = 100         # and ≥100 total observations


class NetworkPriorRecomputer:
    def __init__(self, db: Any):
        self.db = db

    def recompute_all(self) -> int:
        """
        Returns number of priors written/updated.
        """
        # Group candidate-scope variance_state by (action_type, segment_key)
        rows = self.db.fetch_all(
            """
            SELECT action_type, segment_key, segment_dims,
                   COUNT(*) AS n_candidates,
                   SUM(n) AS total_n,
                   ARRAY_AGG(mean_roi) AS candidate_means,
                   ARRAY_AGG(m2) AS candidate_m2s,
                   ARRAY_AGG(n) AS candidate_ns
              FROM e61.variance_state
             WHERE scope = 'candidate'
             GROUP BY action_type, segment_key, segment_dims
            HAVING COUNT(*) >= %(min_c)s AND SUM(n) >= %(min_n)s
            """,
            {"min_c": MIN_CANDIDATES_FOR_PRIOR, "min_n": MIN_TOTAL_SAMPLES},
        )

        written = 0
        for row in rows:
            try:
                prior = self._compute_prior(row)
                self._upsert_prior(row, prior)
                written += 1
            except Exception:
                logger.exception(
                    "prior recompute failed for action=%s segment=%s",
                    row["action_type"], row["segment_key"],
                )

        logger.info("network_prior_recomputer wrote/updated %d priors", written)
        return written

    def _compute_prior(self, row: dict) -> dict:
        """
        Hierarchical pooling:
            μ_net   = weighted mean of candidate sample_means (weighted by n)
            σ²_net  = variance OF candidate means around μ_net (between-cand)
            σ²_obs  = average within-candidate variance (within-cand noise)
            n_eff   = sum of candidate ns (used for posterior precision)
        """
        means = [float(m) for m in row["candidate_means"]]
        m2s = [float(m) for m in row["candidate_m2s"]]
        ns = [int(n) for n in row["candidate_ns"]]

        total_n = sum(ns)
        if total_n == 0:
            return {"mu": 1.0, "sigma_sq": 100.0, "obs_sigma_sq": 1.0, "n": 0}

        # Pooled grand mean (weighted by n)
        grand_mean = sum(m * n for m, n in zip(means, ns)) / total_n

        # Between-candidate variance: how much do candidate means scatter
        # around the grand mean? This is σ²_net.
        if len(means) > 1:
            between_var = sum(n * (m - grand_mean) ** 2 for m, n in zip(means, ns)) / total_n
        else:
            between_var = 1.0   # single candidate; uninformative wide prior

        # Pooled within-candidate variance: σ²_obs
        within_sum = sum(m2 for m2 in m2s)
        within_n_minus_one = sum(max(n - 1, 0) for n in ns)
        within_var = within_sum / within_n_minus_one if within_n_minus_one > 0 else 1.0

        # Floor variances to avoid divide-by-zero in posterior updates
        between_var = max(between_var, 1e-4)
        within_var = max(within_var, 1e-4)

        return {
            "mu": grand_mean,
            "sigma_sq": between_var,
            "obs_sigma_sq": within_var,
            "n": total_n,
        }

    def _upsert_prior(self, row: dict, prior: dict) -> None:
        self.db.execute(
            """
            INSERT INTO e61.bayesian_priors (
                action_type, segment_key, segment_dims,
                prior_mu, prior_sigma_sq, prior_n, obs_sigma_sq,
                last_recomputed_at
            ) VALUES (
                %(at)s, %(sk)s, %(sd)s::jsonb,
                %(mu)s, %(ss)s, %(n)s, %(os)s,
                NOW()
            )
            ON CONFLICT (action_type, segment_key) DO UPDATE
               SET prior_mu          = EXCLUDED.prior_mu,
                   prior_sigma_sq    = EXCLUDED.prior_sigma_sq,
                   prior_n           = EXCLUDED.prior_n,
                   obs_sigma_sq      = EXCLUDED.obs_sigma_sq,
                   segment_dims      = EXCLUDED.segment_dims,
                   last_recomputed_at = NOW()
            """,
            {
                "at": row["action_type"],
                "sk": row["segment_key"],
                "sd": json.dumps(row["segment_dims"]),
                "mu": prior["mu"],
                "ss": prior["sigma_sq"],
                "n": prior["n"],
                "os": prior["obs_sigma_sq"],
            },
        )
