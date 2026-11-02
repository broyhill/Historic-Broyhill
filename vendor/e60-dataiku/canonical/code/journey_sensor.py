"""
E60 DONOR JOURNEY SENSOR — the sensory half of the Funnel Intelligence Engine
=============================================================================

Ed's definition (2026-07-31, verbatim intent): the other half is "how what we
monitor, how we monitor, when we monitor in the pipeline sale journey where
we can detect donor behavior the moment he lands on an email, opens the
landing page, clicks on interesting links that answers a big question that
leads to another trigger that leads to another trigger for each component of
that funnel that helps to derive an accurate forecast and results in the
10 to 1 money return."

The circuit, per behavior event:

    SENSE      JourneyEvent        one normalized donor behavior signal from
                                   any gun or landing page (delivered, open,
                                   lp_land, link_click, form_start, gave...)
    ANSWER     QuestionAnswer      what the behavior just told us about the
                                   donor (issue driver confirmed, channel
                                   responsiveness, intent stage, timing)
    UPDATE     TattooUpdate        the recommended donor-attribute change,
                                   recipe-stamped, observe-mode (written to
                                   movement.donor_attribute only after gate)
    TRIGGER    TriggerFire         the next rule to fire — ALWAYS expressed
                                   as an ifttt.rules rule_key (canonical
                                   registry; no parallel trigger catalogs)
    RESOLVE    resolve signal      when accumulated evidence moves a touch
                                   posterior enough, tell FunnelTuner to
                                   re-solve the LP mid-flight

Discipline honored (UNIFIED_TRIGGER_FABRIC_2026-06-15):
  - one registry: rule chains reference `ifttt.rules` keys; this module
    proposes rule rows (seed data in the dryrun SQL), it does not create a
    parallel rules table;
  - one gatekeeper: everything emits through E20 Brain observe events;
  - this module never sends anything to any donor.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

from funnel_intelligence import Outcome, FunnelTuner


# =============================================================================
# SENSE — the normalized behavior event
# =============================================================================

# every signal the pipeline can currently observe, in journey order
JOURNEY_EVENTS = (
    "delivered",          # gun webhook: message reached the donor
    "email_open",         # pixel: he opened it
    "lp_land",            # landing page: he arrived
    "link_click",         # he clicked a specific link (payload names it)
    "content_dwell",      # stayed >N seconds on a section (payload names it)
    "form_start",         # began the donation / RSVP form
    "form_abandon",       # started and left
    "gave",               # donation completed (co-admin webhook receipt)
    "unsubscribed",
    "bounced",
)

# how strong a stage-advance signal each event is (0 = none, 1 = gave)
EVENT_WEIGHT = {
    "delivered": 0.0,
    "email_open": 0.15,
    "lp_land": 0.35,
    "link_click": 0.45,
    "content_dwell": 0.50,
    "form_start": 0.75,
    "form_abandon": 0.40,      # strong interest even though it stalled
    "gave": 1.0,
    "unsubscribed": -1.0,
    "bounced": -0.25,
}


@dataclass
class JourneyEvent:
    """One observed donor behavior, normalized from any source webhook."""
    event_id: str
    funnel_id: str
    touch_id: str
    variant_id: Optional[str]
    cluster_id: int
    event: str                      # one of JOURNEY_EVENTS
    payload: Dict = field(default_factory=dict)   # e.g. {"link": "2a_petition", "dwell_s": 41}
    observed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


# =============================================================================
# ANSWER — what the behavior tells us about the donor
# =============================================================================

@dataclass
class QuestionAnswer:
    """A behavior converted into knowledge: which question it answers,
    the answer, and how confident this single observation makes us."""
    question: str                   # e.g. "primary_issue_driver"
    answer: str                     # e.g. "2nd_amendment"
    confidence: float               # 0..1 for this one observation
    evidence_event_id: str
    cluster_id: int


class QuestionMap:
    """Maps behavior events to answered questions. Link taxonomy is data,
    not code: campaigns register what each link/section MEANS when the
    funnel is composed, so a click answers a question by construction."""

    def __init__(self, link_meanings: Optional[Dict[str, Tuple[str, str]]] = None):
        # link/section name -> (question, answer)
        # e.g. {"2a_petition": ("primary_issue_driver", "2nd_amendment")}
        self.link_meanings = link_meanings or {}

    def interpret(self, ev: JourneyEvent) -> List[QuestionAnswer]:
        answers: List[QuestionAnswer] = []
        if ev.event == "email_open":
            answers.append(QuestionAnswer(
                "channel_responsiveness", "email_responsive", 0.3,
                ev.event_id, ev.cluster_id))
            hour = datetime.fromisoformat(ev.observed_at).hour
            answers.append(QuestionAnswer(
                "best_contact_window", f"hour_{hour:02d}", 0.2,
                ev.event_id, ev.cluster_id))
        elif ev.event in ("link_click", "content_dwell"):
            name = ev.payload.get("link") or ev.payload.get("section") or ""
            if name in self.link_meanings:
                q, a = self.link_meanings[name]
                conf = 0.6 if ev.event == "link_click" else 0.7
                answers.append(QuestionAnswer(q, a, conf, ev.event_id, ev.cluster_id))
        elif ev.event == "form_start":
            answers.append(QuestionAnswer(
                "intent_stage", "hot", 0.8, ev.event_id, ev.cluster_id))
        elif ev.event == "form_abandon":
            answers.append(QuestionAnswer(
                "intent_stage", "warm_stalled", 0.6, ev.event_id, ev.cluster_id))
            if "amount_shown" in ev.payload:
                answers.append(QuestionAnswer(
                    "ask_amount_resistance", str(ev.payload["amount_shown"]), 0.5,
                    ev.event_id, ev.cluster_id))
        elif ev.event == "gave":
            answers.append(QuestionAnswer(
                "intent_stage", "closed", 1.0, ev.event_id, ev.cluster_id))
        elif ev.event == "unsubscribed":
            answers.append(QuestionAnswer(
                "channel_responsiveness", "email_hostile", 0.9,
                ev.event_id, ev.cluster_id))
        return answers


# =============================================================================
# UPDATE — recipe-stamped tattoo recommendations (observe-mode)
# =============================================================================

@dataclass
class TattooUpdate:
    """A recommended donor-attribute write. NOT executed here — queued for
    the gated writer against movement.donor_attribute with full provenance."""
    cluster_id: int
    attribute: str                  # e.g. "primary_issue_driver"
    value: str
    confidence: float               # accumulated posterior across observations
    recipe_id: str                  # provenance: which sensor logic produced it
    source_events: List[str]
    recommended_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class TattooAccumulator:
    """Accumulates repeated answers into a posterior per (donor, question).
    One click is a hint; three clicks on 2A content across two touches is a
    tattoo. Confidence combines observations: 1 - prod(1 - c_i)."""

    RECIPE_ID = "E60-JOURNEY-SENSOR-v1"
    TATTOO_THRESHOLD = 0.75

    def __init__(self):
        self._acc: Dict[Tuple[int, str, str], List[QuestionAnswer]] = {}

    def add(self, qa: QuestionAnswer) -> Optional[TattooUpdate]:
        key = (qa.cluster_id, qa.question, qa.answer)
        self._acc.setdefault(key, []).append(qa)
        obs = self._acc[key]
        conf = 1.0 - math.prod(1.0 - o.confidence for o in obs)
        if conf >= self.TATTOO_THRESHOLD:
            return TattooUpdate(
                cluster_id=qa.cluster_id, attribute=qa.question, value=qa.answer,
                confidence=round(conf, 4), recipe_id=self.RECIPE_ID,
                source_events=[o.evidence_event_id for o in obs])
        return None


# =============================================================================
# TRIGGER — next rule in the chain (ifttt.rules keys only)
# =============================================================================

@dataclass
class TriggerFire:
    """A recommendation to fire a rule. rule_key MUST exist in ifttt.rules
    (seeded by the dryrun SQL) — this module never invents a parallel
    catalog. E20 Brain remains the single gatekeeper on actual firing."""
    rule_key: str
    cluster_id: int
    funnel_id: str
    reason: str
    payload: Dict = field(default_factory=dict)


# the E60 journey rule chain proposed for ifttt.rules (seed data, gated DML)
IFTTT_SEED_RULES = {
    "e60.journey.hot_donor_accelerate":
        "form_start observed -> propose skipping remaining nurture touches; "
        "route to close-ask cannon within 24h",
    "e60.journey.abandon_recover":
        "form_abandon observed -> propose recovery touch (lower ask if "
        "ask_amount_resistance) after optimal gap",
    "e60.journey.issue_confirmed_retarget":
        "issue tattoo crossed threshold -> propose swapping remaining "
        "message classes to the confirmed issue",
    "e60.journey.channel_hostile_reroute":
        "unsubscribed/hostile -> propose removing channel for donor, "
        "re-solve LP without it",
    "e60.journey.gave_thank_and_close_funnel":
        "gave observed -> propose thank-you touch; donor exits funnel; "
        "outcome ledger finalized",
    "e60.journey.silent_decay_downgrade":
        "no advance events N days after touch -> posterior decays; "
        "re-solve if forecast variance breaches threshold",
}


# =============================================================================
# THE CIRCUIT — sense -> answer -> update -> trigger -> resolve
# =============================================================================

class SensorCircuit:
    """Consumes JourneyEvents; drives the FunnelTuner (decision half),
    accumulates tattoos, and recommends the next trigger in the chain.

    Injection points keep it transport-agnostic and observe-mode:
      emit_trigger(TriggerFire)   -> E20 Brain event queue
      emit_tattoo(TattooUpdate)   -> gated donor_attribute writer queue
    """

    RESOLVE_EVIDENCE_STEP = 25      # re-solve after this many new outcomes

    def __init__(self, tuner: FunnelTuner, question_map: QuestionMap,
                 emit_trigger: Callable[[TriggerFire], None],
                 emit_tattoo: Callable[[TattooUpdate], None]):
        self.tuner = tuner
        self.qmap = question_map
        self.emit_trigger = emit_trigger
        self.emit_tattoo = emit_tattoo
        self.accumulator = TattooAccumulator()
        self._events_since_resolve = 0

    def sense(self, ev: JourneyEvent) -> Dict:
        """Process one behavior event through the full circuit."""
        if ev.event not in JOURNEY_EVENTS:
            return {"event_id": ev.event_id, "status": "ignored_unknown_event"}

        # 1) feed the decision half: update touch posteriors
        outcome_event = self._to_outcome_event(ev)
        if outcome_event:
            self.tuner.record(Outcome(
                outcome_id=ev.event_id, funnel_id=ev.funnel_id,
                touch_id=ev.touch_id, variant_id=ev.variant_id,
                cluster_id=ev.cluster_id, event=outcome_event,
                amount=float(ev.payload.get("amount", 0.0)),
                observed_at=ev.observed_at))
            self._events_since_resolve += 1

        # 2) answer questions and accumulate tattoos
        answers = self.qmap.interpret(ev)
        tattoos: List[TattooUpdate] = []
        for qa in answers:
            t = self.accumulator.add(qa)
            if t:
                tattoos.append(t)
                self.emit_tattoo(t)
                self.emit_trigger(TriggerFire(
                    "e60.journey.issue_confirmed_retarget", ev.cluster_id,
                    ev.funnel_id,
                    f"tattoo {t.attribute}={t.value} confirmed at {t.confidence:.0%}",
                    {"attribute": t.attribute, "value": t.value}))

        # 3) event-specific next triggers in the chain
        for fire in self._chain(ev):
            self.emit_trigger(fire)

        # 4) decide whether the LP should re-solve
        resolve_due = self._events_since_resolve >= self.RESOLVE_EVIDENCE_STEP
        if resolve_due:
            self._events_since_resolve = 0

        return {
            "event_id": ev.event_id,
            "status": "processed",
            "questions_answered": len(answers),
            "tattoos_recommended": len(tattoos),
            "resolve_due": resolve_due,
        }

    @staticmethod
    def _to_outcome_event(ev: JourneyEvent) -> Optional[str]:
        """Map journey signals onto the tuner's outcome vocabulary."""
        w = EVENT_WEIGHT.get(ev.event, 0.0)
        if ev.event == "gave":
            return "gave"
        if ev.event == "unsubscribed":
            return "unsubscribed"
        if ev.event == "bounced":
            return "bounced"
        if w >= 0.45:
            return "clicked"        # strong advance signal
        if w > 0.0:
            return "opened"         # weak advance signal
        if ev.event == "delivered":
            return "delivered"
        return None

    def _chain(self, ev: JourneyEvent) -> List[TriggerFire]:
        fires: List[TriggerFire] = []
        if ev.event == "form_start":
            fires.append(TriggerFire(
                "e60.journey.hot_donor_accelerate", ev.cluster_id, ev.funnel_id,
                "donor started the form — hot; propose close-ask within 24h"))
        elif ev.event == "form_abandon":
            fires.append(TriggerFire(
                "e60.journey.abandon_recover", ev.cluster_id, ev.funnel_id,
                "form abandoned — propose recovery touch after optimal gap",
                {"amount_shown": ev.payload.get("amount_shown")}))
        elif ev.event == "gave":
            fires.append(TriggerFire(
                "e60.journey.gave_thank_and_close_funnel", ev.cluster_id,
                ev.funnel_id, "donation received — thank and exit funnel",
                {"amount": ev.payload.get("amount", 0.0)}))
        elif ev.event == "unsubscribed":
            fires.append(TriggerFire(
                "e60.journey.channel_hostile_reroute", ev.cluster_id,
                ev.funnel_id, "unsubscribe — remove channel, re-solve"))
        return fires


def new_event_id() -> str:
    return f"JEV-{uuid.uuid4().hex[:12]}"
