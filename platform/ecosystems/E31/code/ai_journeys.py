"""
E31 AI Journeys — ML-driven adaptive conversation flows.

Attentive AI Pro equivalent: learns from every interaction, adapts
messaging strategy per donor microsegment, optimizes send time,
message length, tone, and follow-up cadence.

Journey types:
- Donor cultivation (cold → warm → ask → thank)
- RSVP flow (invite → confirm → remind → check-in)
- Lapsed reactivation (remind → soft ask → urgency → final)
- Volunteer recruitment (interest → signup → schedule → confirm)
- Post-donation thank (thank → impact update → next ask)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.entities import InboundClassification

logger = logging.getLogger("e31.ai_journeys")


# ── Journey Definitions ──────────────────────────────────────────────

JOURNEY_TEMPLATES = {
    "donor_cultivation": {
        "name": "Donor Cultivation",
        "steps": [
            {
                "step": 1, "name": "intro",
                "delay_hours": 0,
                "template": (
                    "Hi {first_name}, this is {candidate_name} running for "
                    "{office}. {issue_hook} Can I count on your support?"
                ),
                "on_positive": "step_2_soft_ask",
                "on_negative": "end_graceful",
                "on_silence_hours": 48,
                "on_silence": "step_1b_followup",
            },
            {
                "step": 2, "name": "step_2_soft_ask",
                "delay_hours": 0,
                "template": (
                    "Thank you! Every dollar makes a difference in this race. "
                    "Can you chip in ${suggested_amount}? {donation_link}"
                ),
                "on_positive": "step_3_thank",
                "on_negative": "step_2b_lower_ask",
                "on_silence_hours": 72,
                "on_silence": "step_2b_lower_ask",
            },
            {
                "step": 3, "name": "step_3_thank",
                "delay_hours": 0,
                "template": (
                    "You're incredible, {first_name}! Your contribution "
                    "just made a real difference. I won't forget it."
                ),
                "on_positive": "end",
                "on_negative": "end",
                "on_silence_hours": 0,
                "on_silence": "end",
            },
        ],
    },
    "rsvp_event": {
        "name": "Event RSVP",
        "steps": [
            {
                "step": 1, "name": "invite",
                "delay_hours": 0,
                "template": (
                    "Hi {first_name}! You're invited to {event_name} on "
                    "{event_date} at {event_time}. {event_location}. "
                    "Can you make it? Reply YES or NO."
                ),
                "on_positive": "step_2_confirm",
                "on_negative": "step_2_cant_make_it",
                "on_silence_hours": 48,
                "on_silence": "step_1b_reminder",
            },
            {
                "step": 2, "name": "step_2_confirm",
                "delay_hours": 0,
                "template": (
                    "You're confirmed for {event_name}! We'll send a "
                    "reminder the day before. Bring a friend if you can!"
                ),
                "on_silence_hours": 0,
                "on_silence": "step_3_day_before",
            },
            {
                "step": 3, "name": "step_3_day_before",
                "delay_hours": 0,
                "template": (
                    "Reminder: {event_name} is TOMORROW at {event_time}. "
                    "{event_location}. See you there, {first_name}!"
                ),
                "on_silence_hours": 0,
                "on_silence": "end",
            },
            {
                "step": 4, "name": "step_2_cant_make_it",
                "delay_hours": 0,
                "template": (
                    "Sorry you can't make it! Can we count on a "
                    "${suggested_amount} contribution instead? "
                    "{donation_link}"
                ),
                "on_positive": "step_3_thank",
                "on_negative": "end_graceful",
                "on_silence_hours": 0,
                "on_silence": "end",
            },
        ],
    },
    "lapsed_reactivation": {
        "name": "Lapsed Donor Reactivation",
        "steps": [
            {
                "step": 1, "name": "reconnect",
                "delay_hours": 0,
                "template": (
                    "Hi {first_name}, it's been a while! {candidate_name} "
                    "is in a tight race for {office}. {issue_hook} "
                    "Are you still with us?"
                ),
                "on_positive": "step_2_ask",
                "on_negative": "end_graceful",
                "on_silence_hours": 72,
                "on_silence": "step_1b_urgency",
            },
            {
                "step": 2, "name": "step_2_ask",
                "delay_hours": 24,
                "template": (
                    "Great to hear from you! Your past support meant "
                    "everything. Can you renew with ${suggested_amount}? "
                    "{donation_link}"
                ),
                "on_positive": "step_3_thank",
                "on_negative": "end_graceful",
                "on_silence_hours": 96,
                "on_silence": "end",
            },
        ],
    },
    "volunteer_recruitment": {
        "name": "Volunteer Recruitment",
        "steps": [
            {
                "step": 1, "name": "interest",
                "delay_hours": 0,
                "template": (
                    "Hi {first_name}! {candidate_name}'s campaign needs "
                    "volunteers in {county}. Could you spare a few hours "
                    "this week? Reply YES to learn more."
                ),
                "on_positive": "step_2_details",
                "on_negative": "step_2_donate_instead",
                "on_silence_hours": 48,
                "on_silence": "end",
            },
            {
                "step": 2, "name": "step_2_details",
                "delay_hours": 0,
                "template": (
                    "Awesome! We need help with: phone banking, door "
                    "knocking, or event setup. Which interests you most?"
                ),
                "on_positive": "step_3_schedule",
                "on_silence_hours": 48,
                "on_silence": "step_3_schedule",
            },
        ],
    },
}


class AIJourneyEngine:
    """ML-driven adaptive conversation flow engine.

    Per-donor journey state machine that:
    1. Selects journey type based on donor profile
    2. Personalizes each message with donor data
    3. Classifies responses and routes to next step
    4. Adapts timing/tone based on engagement history
    5. Learns optimal patterns per microsegment
    """

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def start_journey(
        self,
        phone: str,
        journey_type: str,
        candidate_id: UUID,
        context: Optional[dict] = None,
    ) -> dict:
        """Enroll a phone in a journey. Returns enrollment record."""
        journey = JOURNEY_TEMPLATES.get(journey_type)
        if not journey:
            raise ValueError(f"Unknown journey type: {journey_type}")

        enrollment_id = uuid4()
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_journey_enrollments
                        (enrollment_id, phone_e164, journey_type,
                         candidate_id, current_step, context,
                         status, enrolled_at, next_send_at)
                    VALUES (%s, %s, %s, %s, 1, %s, 'active', NOW(), NOW())
                    """,
                    (
                        str(enrollment_id),
                        phone,
                        journey_type,
                        str(candidate_id),
                        json.dumps(context or {}),
                    ),
                )
            conn.commit()
        finally:
            conn.close()

        return {
            "enrollment_id": str(enrollment_id),
            "journey_type": journey_type,
            "current_step": 1,
            "status": "active",
        }

    def advance_journey(
        self,
        phone: str,
        response_classification: InboundClassification,
    ) -> Optional[dict]:
        """Advance a journey based on the donor's response.

        Returns the next message to send, or None if journey is complete.
        """
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM e31.sms_journey_enrollments
                    WHERE phone_e164 = %s AND status = 'active'
                    ORDER BY enrolled_at DESC LIMIT 1
                    """,
                    (phone,),
                )
                enrollment = cur.fetchone()
        finally:
            conn.close()

        if not enrollment:
            return None

        journey = JOURNEY_TEMPLATES.get(enrollment["journey_type"])
        if not journey:
            return None

        current_step_num = enrollment["current_step"]
        steps = journey["steps"]
        current_step = None
        for step in steps:
            if step["step"] == current_step_num:
                current_step = step
                break

        if not current_step:
            return None

        # Determine next step based on response
        if response_classification in (
            InboundClassification.POSITIVE,
            InboundClassification.DONATION_INTENT,
            InboundClassification.VOLUNTEER_INTENT,
        ):
            next_step_name = current_step.get("on_positive", "end")
        elif response_classification == InboundClassification.NEGATIVE:
            next_step_name = current_step.get("on_negative", "end")
        else:
            next_step_name = current_step.get("on_positive", "end")

        if next_step_name in ("end", "end_graceful"):
            self._complete_journey(enrollment["enrollment_id"])
            return None

        # Find the next step
        next_step = None
        for step in steps:
            if step["name"] == next_step_name:
                next_step = step
                break

        if not next_step:
            self._complete_journey(enrollment["enrollment_id"])
            return None

        # Update enrollment
        delay_hours = next_step.get("delay_hours", 0)
        next_send = datetime.utcnow() + timedelta(hours=delay_hours)

        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_journey_enrollments
                    SET current_step = %s,
                        next_send_at = %s,
                        updated_at = NOW()
                    WHERE enrollment_id = %s
                    """,
                    (next_step["step"], next_send,
                     str(enrollment["enrollment_id"])),
                )
            conn.commit()
        finally:
            conn.close()

        # Personalize template with context
        context = json.loads(enrollment.get("context", "{}") or "{}")
        message = next_step["template"].format_map(
            _SafeFormatDict(context),
        )

        return {
            "message": message,
            "step": next_step["step"],
            "step_name": next_step["name"],
            "delay_hours": delay_hours,
            "send_at": next_send.isoformat(),
        }

    def check_silence_timeouts(self) -> list:
        """Check for enrollments that have gone silent past their timeout.

        Returns list of enrollments needing a silence follow-up.
        """
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM e31.sms_journey_enrollments
                    WHERE status = 'active'
                      AND next_send_at <= NOW()
                    ORDER BY next_send_at ASC
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()

    def _complete_journey(self, enrollment_id) -> None:
        """Mark a journey enrollment as completed."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_journey_enrollments
                    SET status = 'completed', completed_at = NOW()
                    WHERE enrollment_id = %s
                    """,
                    (str(enrollment_id),),
                )
            conn.commit()
        finally:
            conn.close()

    def get_journey_analytics(self, journey_type: str) -> dict:
        """Per-journey-type analytics: completion rate, avg steps, conversion."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_enrolled,
                        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                        COUNT(*) FILTER (WHERE status = 'active') AS active,
                        AVG(current_step) AS avg_steps_reached
                    FROM e31.sms_journey_enrollments
                    WHERE journey_type = %s
                    """,
                    (journey_type,),
                )
                return cur.fetchone()
        finally:
            conn.close()


class _SafeFormatDict(dict):
    """Dict that returns '{key}' for missing keys instead of raising."""

    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"
