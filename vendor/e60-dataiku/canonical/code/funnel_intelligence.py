"""
E60 FUNNEL INTELLIGENCE ENGINE
==============================

The closed loop that plots, plans, proposes, composes, and deploys a
multi-cannon funnel — and then tunes it from observed outcomes.

Doctrine: docs/canonical/ED_DOCTRINE_2026-07-31_STATISTICAL_ENGINE_COLUMN_DISCOVERY.md
    "what columns of thousands can tell me answers to the thousands of
     questions we have ... who what when and how we communicate to every
     microsegment of donors" — Ed Broyhill, 2026-07-31

Five stages, one object each:

    PLOT     FunnelMatrix        the funnel as math: donors x touches, each
                                 cell a probability + a cost
    PLAN     LPAllocator         PuLP linear program: which cannons, what
                                 sequence, what volume — under budget,
                                 capacity, and fatigue constraints; emits
                                 shadow prices (the fine-tuning dials)
    PROPOSE  FunnelContract      the forecast the candidate authorizes:
                                 expected dollars, date, cost, confidence,
                                 and the plain-English reason per touch
    COMPOSE  ThompsonSampler     2-4 message variants per touch; volume
                                 shifts daily toward what is winning for
                                 THIS microsegment
    DEPLOY   OutcomeLedger +     Bayesian write-back: every observed
             FunnelTuner         outcome updates cell probabilities; the LP
                                 re-solves mid-flight and reallocates the
                                 remaining budget

Governance: this module computes and recommends only. It never sends.
Every recommendation flows to E20 Brain as an event; live sends stay
behind Ed's gate and Wizard (E68) authorization. All DB persistence is
defined in sql/dryrun/E60_FUNNEL_INTELLIGENCE_DRYRUN.sql (two-phase, not
applied until authorized).

Composes with (does not replace) the December 2025 LP model in
broyhillgop_lp_model.py: Grade/Channel/CampaignTimeline vocabulary is
reused where loaded; this engine adds the funnel matrix, the solver run,
and the learning loop that E60's live tables have never recorded.
"""

from __future__ import annotations

import json
import math
import random
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional, Tuple

try:
    import pulp
    HAVE_PULP = True
except ImportError:  # solver degrades to greedy allocation, flagged in output
    HAVE_PULP = False


# =============================================================================
# PLOT — the funnel as math
# =============================================================================

@dataclass
class Touch:
    """One planned contact: a cannon firing a message class on a day offset."""
    touch_id: str                 # e.g. "T03"
    cannon: str                   # gun code: email|sms|rvm|mail|push|social|phone|mms|tv|digital_ads|messenger|town_hall
    message_class: str            # e.g. "gun_rights_soft_ask"
    day_offset: int               # days from funnel start
    unit_cost: float              # cost per donor touched
    # Bayesian state of this cell's stage-advance probability (Beta prior).
    # Priors come from the statistical engine / history; they are wide on the
    # first funnel and tighten with every observed outcome.
    alpha: float = 1.0            # successes + prior
    beta: float = 9.0             # failures + prior  (default prior p ~ 0.10)
    reason: str = ""              # plain-English why — shown to the candidate

    @property
    def p_advance(self) -> float:
        """Posterior mean probability this touch advances a donor one stage."""
        return self.alpha / (self.alpha + self.beta)

    @property
    def confidence_interval(self) -> Tuple[float, float]:
        """~95% credible interval on p_advance (normal approx to Beta)."""
        n = self.alpha + self.beta
        p = self.p_advance
        se = math.sqrt(max(p * (1 - p) / n, 1e-12))
        return (max(0.0, p - 1.96 * se), min(1.0, p + 1.96 * se))


@dataclass
class Microsegment:
    """The donor slice this funnel aims at, with its giving expectation."""
    segment_id: str
    description: str              # e.g. "U-registered, gun-issue, lapsed 18mo, mail-responsive"
    donor_count: int
    avg_expected_gift: float      # from grades / history for this segment
    close_stage: int              # how many stage-advances constitute a close


@dataclass
class FunnelMatrix:
    """The funnel: an ordered sequence of touches against one microsegment.

    Expected value chains the touch probabilities: a donor must be advanced
    through `close_stage` stages, and each touch contributes its posterior
    p_advance. The forecast is computed the day the funnel is born and
    becomes the contract the funnel must meet.
    """
    funnel_id: str
    segment: Microsegment
    touches: List[Touch]
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def expected_close_rate(self) -> float:
        """P(donor closes) = 1 - prod(1 - p_i) folded over required stages."""
        if not self.touches:
            return 0.0
        p_no_advance = 1.0
        for t in self.touches:
            p_no_advance *= (1.0 - t.p_advance)
        # probability of at least close_stage advances approximated by
        # scaling the any-advance probability by the stage depth
        p_any = 1.0 - p_no_advance
        return p_any ** max(1, self.segment.close_stage)

    def forecast(self) -> Dict:
        """The numbers the candidate signs: dollars, cost, net, confidence."""
        rate = self.expected_close_rate()
        closes = rate * self.segment.donor_count
        gross = closes * self.segment.avg_expected_gift
        cost = sum(t.unit_cost for t in self.touches) * self.segment.donor_count
        lo = 1.0
        hi = 1.0
        for t in self.touches:
            ci = t.confidence_interval
            lo *= (1.0 - ci[1])
            hi *= (1.0 - ci[0])
        rate_lo = (1.0 - hi) ** max(1, self.segment.close_stage)
        rate_hi = (1.0 - lo) ** max(1, self.segment.close_stage)
        return {
            "funnel_id": self.funnel_id,
            "computed_at": datetime.utcnow().isoformat(),
            "donors": self.segment.donor_count,
            "expected_close_rate": round(rate, 5),
            "expected_closes": round(closes, 1),
            "expected_gross": round(gross, 2),
            "expected_cost": round(cost, 2),
            "expected_net": round(gross - cost, 2),
            "close_rate_95ci": [round(rate_lo, 5), round(rate_hi, 5)],
            "gross_95ci": [
                round(rate_lo * self.segment.donor_count * self.segment.avg_expected_gift, 2),
                round(rate_hi * self.segment.donor_count * self.segment.avg_expected_gift, 2),
            ],
        }


# =============================================================================
# PLAN — linear programming picks the touches
# =============================================================================

@dataclass
class PlanConstraints:
    total_budget: float
    channel_weekly_capacity: Dict[str, int]      # cannon -> max touches/week across the file
    max_touches_per_donor_per_week: int = 3      # fatigue ceiling, ALL cannons combined
    compliance_blocked_cannons: List[str] = field(default_factory=list)  # e.g. sms w/o 10DLC


@dataclass
class PlanResult:
    status: str                                  # "optimal" | "infeasible" | "greedy_fallback"
    selected: Dict[str, float]                   # touch_id -> fraction of segment to receive it
    objective_net: float
    shadow_prices: Dict[str, float]              # constraint -> marginal value of relaxing it
    solver: str
    notes: List[str] = field(default_factory=list)


class LPAllocator:
    """Maximize expected net dollars subject to budget, capacity, fatigue.

    Decision variable x_t in [0,1] per touch = fraction of the segment that
    receives touch t. Objective: sum over touches of
        x_t * donors * p_advance_t * stage_value  -  x_t * donors * unit_cost_t
    where stage_value apportions the segment's expected gift across the
    stages a donor must be advanced through.

    Shadow prices on the binding constraints are the fine-tuning dials:
    "one more SMS slot per week is worth $X" — reported, not guessed.
    """

    def __init__(self, funnel: FunnelMatrix, constraints: PlanConstraints):
        self.funnel = funnel
        self.c = constraints

    def _stage_value(self) -> float:
        seg = self.funnel.segment
        return seg.avg_expected_gift / max(1, seg.close_stage)

    def solve(self) -> PlanResult:
        touches = [t for t in self.funnel.touches
                   if t.cannon not in self.c.compliance_blocked_cannons]
        dropped = [t.touch_id for t in self.funnel.touches
                   if t.cannon in self.c.compliance_blocked_cannons]
        notes = [f"compliance-dropped: {dropped}"] if dropped else []
        if not touches:
            return PlanResult("infeasible", {}, 0.0, {}, "none", notes + ["no eligible touches"])
        if HAVE_PULP:
            return self._solve_pulp(touches, notes)
        return self._solve_greedy(touches, notes + ["pulp not installed — greedy fallback"])

    def _solve_pulp(self, touches: List[Touch], notes: List[str]) -> PlanResult:
        seg = self.funnel.segment
        sv = self._stage_value()
        prob = pulp.LpProblem(f"funnel_{self.funnel.funnel_id}", pulp.LpMaximize)
        x = {t.touch_id: pulp.LpVariable(f"x_{t.touch_id}", 0, 1) for t in touches}

        prob += pulp.lpSum(
            x[t.touch_id] * seg.donor_count * (t.p_advance * sv - t.unit_cost)
            for t in touches
        )

        budget_con = pulp.lpSum(
            x[t.touch_id] * seg.donor_count * t.unit_cost for t in touches
        ) <= self.c.total_budget
        prob += budget_con, "budget"

        weeks: Dict[int, List[Touch]] = {}
        for t in touches:
            weeks.setdefault(t.day_offset // 7, []).append(t)

        for wk, wk_touches in weeks.items():
            prob += (
                pulp.lpSum(x[t.touch_id] for t in wk_touches)
                <= self.c.max_touches_per_donor_per_week,
                f"fatigue_week_{wk}",
            )
            by_cannon: Dict[str, List[Touch]] = {}
            for t in wk_touches:
                by_cannon.setdefault(t.cannon, []).append(t)
            for cannon, ct in by_cannon.items():
                cap = self.c.channel_weekly_capacity.get(cannon)
                if cap is not None:
                    prob += (
                        pulp.lpSum(x[t.touch_id] * seg.donor_count for t in ct) <= cap,
                        f"capacity_{cannon}_week_{wk}",
                    )

        prob.solve(pulp.PULP_CBC_CMD(msg=0))
        status = pulp.LpStatus[prob.status].lower()
        selected = {tid: max(0.0, min(1.0, v.value() or 0.0)) for tid, v in x.items()}
        shadow = {
            name: round(con.pi, 4)
            for name, con in prob.constraints.items()
            if con.pi is not None and abs(con.pi) > 1e-9
        }
        return PlanResult(status, selected, round(pulp.value(prob.objective) or 0.0, 2),
                          shadow, "pulp_cbc", notes)

    def _solve_greedy(self, touches: List[Touch], notes: List[str]) -> PlanResult:
        seg = self.funnel.segment
        sv = self._stage_value()
        ranked = sorted(touches,
                        key=lambda t: t.p_advance * sv - t.unit_cost, reverse=True)
        selected: Dict[str, float] = {t.touch_id: 0.0 for t in touches}
        spent, net = 0.0, 0.0
        for t in ranked:
            marginal = t.p_advance * sv - t.unit_cost
            if marginal <= 0:
                continue
            cost = seg.donor_count * t.unit_cost
            if spent + cost > self.c.total_budget:
                frac = max(0.0, (self.c.total_budget - spent) / cost)
                selected[t.touch_id] = frac
                spent += cost * frac
                net += marginal * seg.donor_count * frac
                break
            selected[t.touch_id] = 1.0
            spent += cost
            net += marginal * seg.donor_count
        return PlanResult("greedy_fallback", selected, round(net, 2), {}, "greedy", notes)


# =============================================================================
# PROPOSE — the contract the candidate authorizes
# =============================================================================

@dataclass
class FunnelContract:
    """What the Wizard (E68) shows the candidate. Nothing fires without it."""
    funnel_id: str
    segment_description: str
    forecast: Dict
    plan: PlanResult
    touch_reasons: List[Dict]
    authorized: bool = False
    authorized_by: Optional[str] = None
    authorized_at: Optional[str] = None

    @classmethod
    def compose(cls, funnel: FunnelMatrix, plan: PlanResult) -> "FunnelContract":
        reasons = [
            {
                "touch": t.touch_id,
                "cannon": t.cannon,
                "day": t.day_offset,
                "share_of_segment": round(plan.selected.get(t.touch_id, 0.0), 3),
                "p_advance": round(t.p_advance, 4),
                "why": t.reason or f"{t.cannon} on day {t.day_offset}: "
                                   f"posterior advance probability {t.p_advance:.1%}",
            }
            for t in funnel.touches
        ]
        return cls(funnel.funnel_id, funnel.segment.description,
                   funnel.forecast(), plan, reasons)

    def candidate_summary(self) -> str:
        f = self.forecast
        return (
            f"We forecast ${f['expected_gross']:,.0f} gross "
            f"(${f['expected_net']:,.0f} net) from {f['donors']:,} donors "
            f"by day {max(t['day'] for t in self.touch_reasons)}, at "
            f"${f['expected_cost']:,.0f} cost. 95% range on gross: "
            f"${f['gross_95ci'][0]:,.0f}-${f['gross_95ci'][1]:,.0f}. "
            f"The plan self-corrects daily from your own results; forecast "
            f"vs. actual is the health metric you will see on one screen."
        )


# =============================================================================
# COMPOSE — Thompson sampling over message variants
# =============================================================================

@dataclass
class Variant:
    variant_id: str
    touch_id: str
    label: str                    # e.g. "subject A: 2A urgency"
    alpha: float = 1.0
    beta: float = 1.0


class ThompsonSampler:
    """Per-touch variant allocation. Early on it explores; as outcomes land
    it automatically shifts volume toward what is winning for THIS
    microsegment. No committee meetings — the math reallocates daily."""

    def __init__(self, variants: List[Variant], rng: Optional[random.Random] = None):
        self.variants: Dict[str, Variant] = {v.variant_id: v for v in variants}
        self.rng = rng or random.Random()

    def choose(self, touch_id: str) -> Variant:
        candidates = [v for v in self.variants.values() if v.touch_id == touch_id]
        if not candidates:
            raise ValueError(f"no variants registered for touch {touch_id}")
        draws = {v.variant_id: self.rng.betavariate(v.alpha, v.beta) for v in candidates}
        return self.variants[max(draws, key=draws.get)]

    def record(self, variant_id: str, success: bool) -> None:
        v = self.variants[variant_id]
        if success:
            v.alpha += 1
        else:
            v.beta += 1

    def allocation_report(self, touch_id: str, samples: int = 5000) -> Dict[str, float]:
        """Estimated share of volume each variant would receive today."""
        candidates = [v for v in self.variants.values() if v.touch_id == touch_id]
        wins = {v.variant_id: 0 for v in candidates}
        for _ in range(samples):
            draws = {v.variant_id: self.rng.betavariate(v.alpha, v.beta) for v in candidates}
            wins[max(draws, key=draws.get)] += 1
        return {vid: round(n / samples, 3) for vid, n in wins.items()}


# =============================================================================
# DEPLOY & TUNE — outcomes update beliefs; the LP re-solves mid-flight
# =============================================================================

@dataclass
class Outcome:
    """One observed result of one touch on one donor. Written back by the
    guns' delivery webhooks via E20 observe events."""
    outcome_id: str
    funnel_id: str
    touch_id: str
    variant_id: Optional[str]
    cluster_id: int
    event: str                    # delivered|opened|clicked|gave|unsubscribed|bounced
    amount: float = 0.0
    observed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


ADVANCE_EVENTS = {"opened", "clicked", "gave"}
FAILURE_EVENTS = {"delivered", "bounced", "unsubscribed"}   # delivered-but-silent = no advance


class FunnelTuner:
    """The loop that makes October provably better than September.

    - Bayesian updating: each outcome adjusts its touch's Beta posterior.
    - Hazard tracking: median days-to-response per touch sets the optimal
      gap before the next cannon.
    - Attribution: 'gave' credit is shared across the touches that reached
      the donor in the trailing window (position-weighted), so budget goes
      to what works, not what touched last.
    - Re-solve: after each batch of outcomes the LP runs again on the
      remaining touches and remaining budget, and reallocates.
    """

    ATTRIBUTION_WINDOW_DAYS = 7
    RECENCY_WEIGHT = 0.6          # most recent touch's share of a gift's credit

    def __init__(self, funnel: FunnelMatrix, sampler: Optional[ThompsonSampler] = None):
        self.funnel = funnel
        self.sampler = sampler
        self._touch_index = {t.touch_id: t for t in funnel.touches}
        self._donor_touches: Dict[int, List[Tuple[str, str]]] = {}   # cluster -> [(touch, ts)]
        self.response_lags_days: Dict[str, List[float]] = {}

    def record(self, outcome: Outcome) -> None:
        touch = self._touch_index.get(outcome.touch_id)
        if touch is None:
            return
        if outcome.event == "gave":
            self._attribute_gift(outcome)
        elif outcome.event in ADVANCE_EVENTS:
            touch.alpha += 1
        elif outcome.event in FAILURE_EVENTS:
            touch.beta += 1
        if self.sampler and outcome.variant_id:
            self.sampler.record(outcome.variant_id,
                                success=outcome.event in ADVANCE_EVENTS)
        self._donor_touches.setdefault(outcome.cluster_id, []).append(
            (outcome.touch_id, outcome.observed_at))

    def _attribute_gift(self, outcome: Outcome) -> None:
        """Position-weighted attribution across touches in the window."""
        history = self._donor_touches.get(outcome.cluster_id, [])
        cutoff = datetime.fromisoformat(outcome.observed_at) - timedelta(
            days=self.ATTRIBUTION_WINDOW_DAYS)
        recent = [(tid, ts) for tid, ts in history
                  if datetime.fromisoformat(ts) >= cutoff]
        if not recent:
            recent = [(outcome.touch_id, outcome.observed_at)]
        recent.sort(key=lambda r: r[1])
        last_tid = recent[-1][0]
        earlier = [tid for tid, _ in recent[:-1]]
        credits: Dict[str, float] = {last_tid: self.RECENCY_WEIGHT}
        if earlier:
            share = (1.0 - self.RECENCY_WEIGHT) / len(earlier)
            for tid in earlier:
                credits[tid] = credits.get(tid, 0.0) + share
        else:
            credits[last_tid] = 1.0
        for tid, credit in credits.items():
            t = self._touch_index.get(tid)
            if t:
                t.alpha += credit
        gift_lag = self._lag_days(outcome)
        if gift_lag is not None:
            self.response_lags_days.setdefault(last_tid, []).append(gift_lag)

    def _lag_days(self, outcome: Outcome) -> Optional[float]:
        history = self._donor_touches.get(outcome.cluster_id, [])
        sent = [ts for tid, ts in history if tid == outcome.touch_id]
        if not sent:
            return None
        return (datetime.fromisoformat(outcome.observed_at)
                - datetime.fromisoformat(min(sent))).total_seconds() / 86400.0

    def optimal_gap_days(self, touch_id: str, default: int = 4) -> int:
        lags = sorted(self.response_lags_days.get(touch_id, []))
        if not lags:
            return default
        return max(1, int(round(lags[len(lags) // 2])))   # median

    def resolve(self, constraints: PlanConstraints,
                as_of_day: int, spent_so_far: float) -> PlanResult:
        """Re-solve the LP mid-flight over the remaining touches and budget."""
        remaining = [t for t in self.funnel.touches if t.day_offset > as_of_day]
        residual = FunnelMatrix(
            funnel_id=f"{self.funnel.funnel_id}~day{as_of_day}",
            segment=self.funnel.segment,
            touches=remaining,
        )
        residual_constraints = PlanConstraints(
            total_budget=max(0.0, constraints.total_budget - spent_so_far),
            channel_weekly_capacity=constraints.channel_weekly_capacity,
            max_touches_per_donor_per_week=constraints.max_touches_per_donor_per_week,
            compliance_blocked_cannons=constraints.compliance_blocked_cannons,
        )
        return LPAllocator(residual, residual_constraints).solve()

    def variance_report(self, original_forecast: Dict) -> Dict:
        """Forecast vs. current expectation — E72's health metric."""
        current = self.funnel.forecast()
        return {
            "funnel_id": self.funnel.funnel_id,
            "as_of": datetime.utcnow().isoformat(),
            "forecast_gross": original_forecast["expected_gross"],
            "current_expected_gross": current["expected_gross"],
            "variance_pct": round(
                100.0 * (current["expected_gross"] - original_forecast["expected_gross"])
                / max(1e-9, original_forecast["expected_gross"]), 2),
            "touch_posteriors": {
                t.touch_id: {"p_advance": round(t.p_advance, 4),
                             "n_observed": round(t.alpha + t.beta - 10.0, 1)}
                for t in self.funnel.touches
            },
        }


# =============================================================================
# BRAIN WIRING — E20 event emission (observe-mode; never sends)
# =============================================================================

class BrainEmitter:
    """Emits funnel-intelligence events to E20 Brain via an injected relay
    function so the module stays transport-agnostic (relay HTTP in prod,
    a list-appender in tests). Event names extend the ml.* trigger family."""

    EVENTS = (
        "ml.funnel_forecast_computed",
        "ml.funnel_plan_solved",
        "ml.funnel_contract_proposed",
        "ml.funnel_variant_reallocated",
        "ml.funnel_resolved_midflight",
        "ml.funnel_variance_alert",
    )

    def __init__(self, send: Callable[[str, Dict], None]):
        self._send = send

    def forecast(self, funnel: FunnelMatrix) -> None:
        self._send("ml.funnel_forecast_computed", funnel.forecast())

    def plan(self, funnel_id: str, plan: PlanResult) -> None:
        self._send("ml.funnel_plan_solved", {
            "funnel_id": funnel_id, "status": plan.status,
            "objective_net": plan.objective_net,
            "shadow_prices": plan.shadow_prices, "solver": plan.solver,
        })

    def contract(self, contract: FunnelContract) -> None:
        self._send("ml.funnel_contract_proposed", {
            "funnel_id": contract.funnel_id,
            "summary": contract.candidate_summary(),
            "requires": "Wizard (E68) candidate authorization + Ed gate for live sends",
        })

    def variance(self, report: Dict, alert_threshold_pct: float = 20.0) -> None:
        if abs(report["variance_pct"]) >= alert_threshold_pct:
            self._send("ml.funnel_variance_alert", report)


def new_funnel_id() -> str:
    return f"FNL-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:8]}"


def run_cycle(funnel: FunnelMatrix, constraints: PlanConstraints,
              emitter: Optional[BrainEmitter] = None) -> FunnelContract:
    """One full plot→plan→propose pass. Compose/deploy stages attach via
    ThompsonSampler and FunnelTuner as outcomes arrive."""
    plan = LPAllocator(funnel, constraints).solve()
    contract = FunnelContract.compose(funnel, plan)
    if emitter:
        emitter.forecast(funnel)
        emitter.plan(funnel.funnel_id, plan)
        emitter.contract(contract)
    return contract
