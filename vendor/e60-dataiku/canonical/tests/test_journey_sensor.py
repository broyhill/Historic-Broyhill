"""E60 Donor Journey Sensor — behavioral tests (no DB, no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "code"))

from funnel_intelligence import FunnelMatrix, FunnelTuner, Microsegment, Touch, new_funnel_id
from journey_sensor import (
    IFTTT_SEED_RULES, JourneyEvent, QuestionMap, SensorCircuit,
    TattooAccumulator, new_event_id,
)


def build_circuit():
    seg = Microsegment("SEG-2A", "gun-issue lapsed", 4200, 85.0, 3)
    funnel = FunnelMatrix(new_funnel_id(), seg, [
        Touch("T01", "mail", "2a_softener", 0, 0.65),
        Touch("T02", "email", "2a_story", 4, 0.01),
    ])
    tuner = FunnelTuner(funnel)
    qmap = QuestionMap({"2a_petition": ("primary_issue_driver", "2nd_amendment")})
    triggers, tattoos = [], []
    circuit = SensorCircuit(tuner, qmap, triggers.append, tattoos.append)
    return funnel, tuner, circuit, triggers, tattoos


def ev(circuit_funnel, event, cluster=101, touch="T02", payload=None):
    return JourneyEvent(new_event_id(), circuit_funnel.funnel_id, touch,
                        None, cluster, event, payload or {})


def test_open_updates_posterior_and_answers_questions():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    p_before = funnel.touches[1].p_advance
    r = circuit.sense(ev(funnel, "email_open"))
    assert r["status"] == "processed"
    assert r["questions_answered"] >= 2          # responsiveness + contact window
    assert funnel.touches[1].p_advance > p_before


def test_repeated_issue_clicks_produce_tattoo_and_retarget_trigger():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    for _ in range(3):
        circuit.sense(ev(funnel, "link_click", payload={"link": "2a_petition"}))
    assert tattoos, "3 clicks at 0.6 confidence must cross the 0.75 threshold"
    t = tattoos[0]
    assert t.attribute == "primary_issue_driver" and t.value == "2nd_amendment"
    assert t.recipe_id == "E60-JOURNEY-SENSOR-v1" and len(t.source_events) >= 2
    assert any(f.rule_key == "e60.journey.issue_confirmed_retarget" for f in triggers)


def test_form_start_fires_hot_donor_accelerate():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    circuit.sense(ev(funnel, "form_start"))
    assert any(f.rule_key == "e60.journey.hot_donor_accelerate" for f in triggers)


def test_gave_and_unsubscribe_chains():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    circuit.sense(ev(funnel, "gave", payload={"amount": 250.0}))
    circuit.sense(ev(funnel, "unsubscribed", cluster=102))
    keys = [f.rule_key for f in triggers]
    assert "e60.journey.gave_thank_and_close_funnel" in keys
    assert "e60.journey.channel_hostile_reroute" in keys


def test_all_fired_rule_keys_exist_in_seed_registry():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    for e in ("form_start", "form_abandon", "gave", "unsubscribed"):
        circuit.sense(ev(funnel, e))
    for _ in range(3):
        circuit.sense(ev(funnel, "link_click", payload={"link": "2a_petition"}))
    assert triggers and all(f.rule_key in IFTTT_SEED_RULES for f in triggers)


def test_resolve_due_after_evidence_batch():
    funnel, tuner, circuit, triggers, tattoos = build_circuit()
    due = [circuit.sense(ev(funnel, "email_open", cluster=200 + i))["resolve_due"]
           for i in range(circuit.RESOLVE_EVIDENCE_STEP)]
    assert due[-1] is True and not any(due[:-1])


def test_accumulator_single_weak_signal_is_not_a_tattoo():
    acc = TattooAccumulator()
    from journey_sensor import QuestionAnswer
    qa = QuestionAnswer("primary_issue_driver", "2nd_amendment", 0.6, "E1", 7)
    assert acc.add(qa) is None                    # one click is a hint, not a tattoo


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
