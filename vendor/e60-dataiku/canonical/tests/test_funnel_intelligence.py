"""E60 Funnel Intelligence Engine — behavioral tests (no DB, no network)."""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "code"))

from funnel_intelligence import (
    ADVANCE_EVENTS, BrainEmitter, FunnelContract, FunnelMatrix, FunnelTuner,
    LPAllocator, Microsegment, Outcome, PlanConstraints, ThompsonSampler,
    Touch, Variant, new_funnel_id, run_cycle,
)


def build_funnel():
    seg = Microsegment(
        segment_id="SEG-2A-LAPSED",
        description="U-registered, gun-issue, lapsed 18mo, mail-responsive",
        donor_count=4200,
        avg_expected_gift=85.0,
        close_stage=3,
    )
    touches = [
        Touch("T01", "mail", "2a_softener", 0, 0.65, reason="mail softens; segment is mail-responsive"),
        Touch("T02", "email", "2a_story", 4, 0.01),
        Touch("T03", "rvm", "2a_urgency", 9, 0.05, alpha=2.5, beta=9.0,
              reason="history: RVM at touch 3 lifts close rate for this segment"),
        Touch("T04", "sms", "2a_close_ask", 14, 0.03),
        Touch("T05", "email", "2a_last_call", 20, 0.01),
    ]
    return FunnelMatrix(new_funnel_id(), seg, touches)


def constraints():
    return PlanConstraints(
        total_budget=5000.0,
        channel_weekly_capacity={"sms": 20000, "rvm": 15000, "mail": 10000},
        max_touches_per_donor_per_week=2,
    )


def test_forecast_is_a_contract():
    f = build_funnel()
    fc = f.forecast()
    assert fc["donors"] == 4200
    assert 0.0 < fc["expected_close_rate"] < 1.0
    assert fc["expected_gross"] > 0
    assert fc["gross_95ci"][0] <= fc["expected_gross"] <= fc["gross_95ci"][1]


def test_lp_respects_budget_and_reports_shadow_prices():
    f = build_funnel()
    c = constraints()
    plan = LPAllocator(f, c).solve()
    assert plan.status in ("optimal", "greedy_fallback")
    spend = sum(
        frac * f.segment.donor_count * t.unit_cost
        for t in f.touches for tid, frac in plan.selected.items() if tid == t.touch_id
    )
    assert spend <= c.total_budget + 1e-6
    if plan.solver == "pulp_cbc":
        assert isinstance(plan.shadow_prices, dict)


def test_compliance_blocked_cannon_is_dropped():
    f = build_funnel()
    c = constraints()
    c.compliance_blocked_cannons = ["sms"]
    plan = LPAllocator(f, c).solve()
    assert plan.selected.get("T04", 0.0) == 0.0


def test_contract_summary_is_candidate_readable():
    f = build_funnel()
    contract = run_cycle(f, constraints())
    s = contract.candidate_summary()
    assert "forecast" in s and "$" in s and "self-corrects" in s
    assert not contract.authorized


def test_thompson_shifts_volume_to_winner():
    rng = random.Random(42)
    sampler = ThompsonSampler(
        [Variant("V1", "T04", "urgency"), Variant("V2", "T04", "gratitude")], rng)
    for _ in range(200):
        sampler.record("V1", success=rng.random() < 0.30)
        sampler.record("V2", success=rng.random() < 0.05)
    alloc = sampler.allocation_report("T04")
    assert alloc["V1"] > 0.9


def test_outcomes_update_posteriors_and_variance():
    f = build_funnel()
    original = f.forecast()
    tuner = FunnelTuner(f)
    p_before = f.touches[0].p_advance
    for i in range(50):
        tuner.record(Outcome(f"O{i}", f.funnel_id, "T01", None, 1000 + i, "opened"))
    assert f.touches[0].p_advance > p_before
    report = tuner.variance_report(original)
    assert report["current_expected_gross"] != original["expected_gross"]


def test_gift_attribution_is_position_weighted():
    f = build_funnel()
    tuner = FunnelTuner(f)
    a1, a3 = f.touches[0].alpha, f.touches[2].alpha
    tuner.record(Outcome("O1", f.funnel_id, "T01", None, 7, "delivered",
                         observed_at="2026-08-01T00:00:00"))
    tuner.record(Outcome("O2", f.funnel_id, "T03", None, 7, "delivered",
                         observed_at="2026-08-04T00:00:00"))
    tuner.record(Outcome("O3", f.funnel_id, "T03", None, 7, "gave", amount=100.0,
                         observed_at="2026-08-05T00:00:00"))
    assert f.touches[2].alpha - a3 >= 0.6 - 1e-9     # recent touch gets most credit
    assert f.touches[0].alpha - a1 > 0               # earlier touch still credited


def test_midflight_resolve_uses_remaining_budget():
    f = build_funnel()
    tuner = FunnelTuner(f)
    plan = tuner.resolve(constraints(), as_of_day=9, spent_so_far=4000.0)
    assert plan.status in ("optimal", "infeasible", "greedy_fallback")
    assert all(tid in ("T04", "T05") or frac == 0.0
               for tid, frac in plan.selected.items())


def test_brain_emitter_never_sends_only_events():
    events = []
    emitter = BrainEmitter(lambda name, payload: events.append((name, payload)))
    run_cycle(build_funnel(), constraints(), emitter)
    names = [n for n, _ in events]
    assert names == ["ml.funnel_forecast_computed", "ml.funnel_plan_solved",
                     "ml.funnel_contract_proposed"]
    assert "authorization" in events[2][1]["requires"].lower() or \
           "Wizard" in events[2][1]["requires"]


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL {name}: {e}")
    sys.exit(1 if failures else 0)
