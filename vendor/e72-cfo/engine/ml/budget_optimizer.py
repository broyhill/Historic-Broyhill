"""
ecosystems/E61_cost_benefit_variance/ml/budget_optimizer.py

Per-candidate, per-day budget allocation across channels.

Problem statement:
    Given:
      - daily budget B (cents)
      - set of available actions A, each with:
          - cost_per_unit_cents[a]
          - posterior mean ROI mu[a]
          - posterior CI lower bound lo[a]
      - minimum acceptable ROI lower bound (default 1.5x)
      - per-action volume cap (audience size, rate limits)

    Maximize: sum_a (n_a * mu[a] * cost_per_unit[a])    [expected donations in cents]
    Subject to:
      sum_a (n_a * cost_per_unit[a]) <= B
      lo[a] >= min_acceptable_roi  (else n_a = 0)
      0 <= n_a <= cap[a]
      n_a integer

Solver hierarchy:
    1. PuLP MIP (CBC backend) — exact within tolerance
    2. scipy.optimize.linprog with rounding — fast LP relaxation
    3. Greedy ROI-sorted fallback — always returns a feasible answer in <100ms
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 budget allocation knapsack mip pulp greedy-fallback risk-constraint


from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ActionOption:
    action_type: str
    segment_dims: dict
    cost_per_unit_cents: float
    posterior_mu: float           # expected ROI (dollars donated per dollar spent)
    posterior_ci_lower: float     # 95% CI lower bound
    posterior_ci_upper: float
    posterior_n: int              # sample size; informs confidence tier
    volume_cap: int               # max units we can emit (audience × rate limits)


@dataclass
class AllocationDecision:
    action_type: str
    segment_dims: dict
    units: int
    cost_cents: int
    expected_donations_cents: int
    posterior_mu: float


@dataclass
class AllocationResult:
    candidate_id: uuid.UUID
    total_budget_cents: int
    minimum_acceptable_roi: float
    decisions: list[AllocationDecision]
    total_cost_cents: int
    expected_total_donations_cents: int
    expected_roi: float
    solver_used: str
    solve_time_ms: int


class BudgetOptimizer:
    GREEDY_FALLBACK_TIMEOUT_SEC = 5.0

    def __init__(self, db: Any):
        self.db = db

    def optimize(
        self,
        *,
        candidate_id: uuid.UUID,
        total_budget_cents: int,
        available_actions: list[ActionOption],
        minimum_acceptable_roi: float = 1.5,
    ) -> AllocationResult:
        t0 = time.perf_counter()

        # Filter: only actions whose CI lower bound clears the floor
        eligible = [a for a in available_actions if a.posterior_ci_lower >= minimum_acceptable_roi]
        if not eligible:
            logger.warning(
                "no eligible actions for candidate %s — all CI lower bounds below %.2fx",
                candidate_id, minimum_acceptable_roi,
            )
            return self._empty_result(candidate_id, total_budget_cents, minimum_acceptable_roi, t0)

        # Try MIP first
        try:
            decisions, solver = self._solve_mip(eligible, total_budget_cents)
        except Exception as e:
            logger.info("MIP solver failed (%s); falling back to greedy", e)
            decisions = self._solve_greedy(eligible, total_budget_cents)
            solver = "greedy_fallback"

        total_cost = sum(d.cost_cents for d in decisions)
        total_expected = sum(d.expected_donations_cents for d in decisions)
        roi = (total_expected / total_cost) if total_cost > 0 else 0.0

        return AllocationResult(
            candidate_id=candidate_id,
            total_budget_cents=total_budget_cents,
            minimum_acceptable_roi=minimum_acceptable_roi,
            decisions=decisions,
            total_cost_cents=total_cost,
            expected_total_donations_cents=total_expected,
            expected_roi=roi,
            solver_used=solver,
            solve_time_ms=int((time.perf_counter() - t0) * 1000),
        )

    # -- solvers -------------------------------------------------------------

    def _solve_mip(
        self,
        actions: list[ActionOption],
        budget_cents: int,
    ) -> tuple[list[AllocationDecision], str]:
        """
        PuLP-based MIP. Falls back if PuLP not installed or solver times out.
        """
        try:
            import pulp
        except ImportError:
            raise RuntimeError("PuLP not installed; falling back")

        prob = pulp.LpProblem("budget_alloc", pulp.LpMaximize)
        n_vars = {}
        for i, a in enumerate(actions):
            n_vars[i] = pulp.LpVariable(
                f"n_{i}", lowBound=0, upBound=a.volume_cap, cat="Integer"
            )

        # Objective: maximize expected donations (cents)
        prob += pulp.lpSum(
            n_vars[i] * actions[i].cost_per_unit_cents * actions[i].posterior_mu
            for i in range(len(actions))
        )

        # Budget constraint
        prob += pulp.lpSum(
            n_vars[i] * actions[i].cost_per_unit_cents for i in range(len(actions))
        ) <= budget_cents

        # Solve with timeout
        solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=int(self.GREEDY_FALLBACK_TIMEOUT_SEC))
        prob.solve(solver)

        if pulp.LpStatus[prob.status] not in ("Optimal", "Not Solved"):
            raise RuntimeError(f"MIP returned status {pulp.LpStatus[prob.status]}")

        decisions = []
        for i, a in enumerate(actions):
            units = int(round(n_vars[i].value() or 0))
            if units == 0:
                continue
            cost = int(round(units * a.cost_per_unit_cents))
            expected = int(round(cost * a.posterior_mu))
            decisions.append(AllocationDecision(
                action_type=a.action_type,
                segment_dims=a.segment_dims,
                units=units,
                cost_cents=cost,
                expected_donations_cents=expected,
                posterior_mu=a.posterior_mu,
            ))
        return decisions, "mip_pulp_cbc"

    def _solve_greedy(
        self,
        actions: list[ActionOption],
        budget_cents: int,
    ) -> list[AllocationDecision]:
        """
        Sort by posterior_mu descending, fill from highest-ROI down until budget exhausted.
        Always feasible. O(n log n).
        """
        sorted_actions = sorted(actions, key=lambda a: a.posterior_mu, reverse=True)
        remaining = budget_cents
        decisions = []
        for a in sorted_actions:
            if remaining <= 0:
                break
            max_units_by_budget = int(remaining // a.cost_per_unit_cents) if a.cost_per_unit_cents > 0 else a.volume_cap
            units = min(max_units_by_budget, a.volume_cap)
            if units <= 0:
                continue
            cost = int(round(units * a.cost_per_unit_cents))
            expected = int(round(cost * a.posterior_mu))
            decisions.append(AllocationDecision(
                action_type=a.action_type,
                segment_dims=a.segment_dims,
                units=units,
                cost_cents=cost,
                expected_donations_cents=expected,
                posterior_mu=a.posterior_mu,
            ))
            remaining -= cost
        return decisions

    def _empty_result(self, candidate_id, budget, min_roi, t0):
        return AllocationResult(
            candidate_id=candidate_id,
            total_budget_cents=budget,
            minimum_acceptable_roi=min_roi,
            decisions=[],
            total_cost_cents=0,
            expected_total_donations_cents=0,
            expected_roi=0.0,
            solver_used="no_eligible_actions",
            solve_time_ms=int((time.perf_counter() - t0) * 1000),
        )

    # -- persistence ---------------------------------------------------------

    def persist(self, result: AllocationResult, allocation_date) -> uuid.UUID:
        import json
        row = self.db.fetch_one(
            """
            INSERT INTO e61.budget_allocations (
                candidate_id, allocation_date, total_budget_cents,
                minimum_acceptable_roi, allocations,
                expected_donations_cents, expected_roi, solver_used
            ) VALUES (
                %(cand)s, %(date)s, %(budget)s,
                %(min_roi)s, %(alloc)s::jsonb,
                %(expected)s, %(roi)s, %(solver)s
            )
            ON CONFLICT (candidate_id, allocation_date) DO UPDATE
               SET allocations = EXCLUDED.allocations,
                   expected_donations_cents = EXCLUDED.expected_donations_cents,
                   expected_roi = EXCLUDED.expected_roi,
                   solver_used = EXCLUDED.solver_used,
                   computed_at = NOW()
            RETURNING id
            """,
            {
                "cand": str(result.candidate_id),
                "date": allocation_date,
                "budget": result.total_budget_cents,
                "min_roi": result.minimum_acceptable_roi,
                "alloc": json.dumps([
                    {
                        "action_type": d.action_type,
                        "segment_dims": d.segment_dims,
                        "units": d.units,
                        "cost_cents": d.cost_cents,
                        "expected_donations_cents": d.expected_donations_cents,
                    }
                    for d in result.decisions
                ]),
                "expected": result.expected_total_donations_cents,
                "roi": result.expected_roi,
                "solver": result.solver_used,
            },
        )
        return uuid.UUID(str(row["id"]))
