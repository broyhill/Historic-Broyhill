"""E30 drip / cultivation sequences — 7 political sequence types.

From the Dec 2024 enterprise spec, political campaigns need seven
distinct automated email sequences:

  1. WELCOME         — new donor onboarding (3-5 touches over 14 days)
  2. DONOR_CULTIVATION — nurture existing donors (monthly value content)
  3. VOLUNTEER_RECRUITMENT — convert donors to volunteers (5 touches)
  4. LAPSED_REACTIVATION — re-engage 90+ day inactive donors
  5. EVENT_INVITATION — event cascade (save-date -> invite -> remind -> follow-up)
  6. GOTV             — Get Out The Vote (5 touches in final 10 days)
  7. POST_EVENT       — thank-you + next-ask after events

Each sequence is a list of steps with:
  - delay (days/hours from previous step)
  - template reference
  - condition (opened_previous, not_opened, clicked, etc.)
  - grade filter (which donor tiers receive this step)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from ecosystems.e30_email.contracts import SequenceType

logger = logging.getLogger("e30.sequences")


# ---------------------------------------------------------------------------
# Step condition
# ---------------------------------------------------------------------------

class StepCondition(str, Enum):
    ALWAYS = "always"
    OPENED_PREVIOUS = "opened_previous"
    NOT_OPENED = "not_opened"
    CLICKED_PREVIOUS = "clicked_previous"
    NOT_CLICKED = "not_clicked"
    DONATED = "donated"
    NOT_DONATED = "not_donated"


# ---------------------------------------------------------------------------
# Sequence step
# ---------------------------------------------------------------------------

@dataclass
class SequenceStep:
    """One step in a drip sequence."""
    step_number: int
    template_id: str
    subject_override: Optional[str] = None
    delay_days: int = 0
    delay_hours: int = 0
    condition: StepCondition = StepCondition.ALWAYS
    grade_filter: Optional[List[str]] = None
    is_fundraising: bool = False
    notes: str = ""


# ---------------------------------------------------------------------------
# Sequence definition
# ---------------------------------------------------------------------------

@dataclass
class SequenceDefinition:
    """Complete drip sequence."""
    sequence_id: Optional[str] = None
    name: str = ""
    sequence_type: SequenceType = SequenceType.WELCOME
    candidate_id: Optional[str] = None
    tenant_id: Optional[str] = None
    trigger_event: str = ""
    steps: List[SequenceStep] = field(default_factory=list)
    is_active: bool = True
    created_at: Optional[datetime] = None

    @property
    def total_duration_days(self) -> int:
        return sum(s.delay_days for s in self.steps)


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

@dataclass
class Enrollment:
    """A donor enrolled in a sequence."""
    enrollment_id: Optional[str] = None
    sequence_id: str = ""
    donor_id: str = ""
    email: str = ""
    tenant_id: Optional[str] = None
    current_step: int = 1
    status: str = "active"  # active | paused | completed | cancelled
    enrolled_at: Optional[datetime] = None
    next_send_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Sequence engine
# ---------------------------------------------------------------------------

class SequenceEngine:
    """Manages drip sequence enrollment, advancement, and sending."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def create_sequence(self, definition: SequenceDefinition) -> Optional[str]:
        """Persist a new sequence definition."""
        if not self._pool:
            logger.warning("No DB pool; sequence not persisted")
            return None
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO e30.sequences
                           (name, sequence_type, candidate_id, tenant_id,
                            trigger_event, is_active)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           RETURNING sequence_id""",
                        (definition.name, definition.sequence_type.value,
                         definition.candidate_id, definition.tenant_id,
                         definition.trigger_event, definition.is_active),
                    )
                    seq_id = str(cur.fetchone()[0])
                    for step in definition.steps:
                        cur.execute(
                            """INSERT INTO e30.sequence_steps
                               (sequence_id, step_number, template_id,
                                subject_override, delay_days, delay_hours,
                                condition, grade_filter, is_fundraising)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (seq_id, step.step_number, step.template_id,
                             step.subject_override, step.delay_days, step.delay_hours,
                             step.condition.value, step.grade_filter, step.is_fundraising),
                        )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return seq_id
        except Exception as exc:
            logger.error("Create sequence failed: %s", exc)
            return None

    def enroll(self, sequence_id: str, donor_id: str, email: str,
               tenant_id: Optional[str] = None) -> Optional[str]:
        """Enroll a donor in a sequence (idempotent — skips if active)."""
        if not self._pool:
            return None
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    # Check already active
                    cur.execute(
                        """SELECT enrollment_id FROM e30.enrollments
                           WHERE sequence_id = %s AND donor_id = %s AND status = 'active'""",
                        (sequence_id, donor_id),
                    )
                    if cur.fetchone():
                        return None  # already enrolled

                    # Get first step delay
                    cur.execute(
                        """SELECT delay_days, delay_hours FROM e30.sequence_steps
                           WHERE sequence_id = %s AND step_number = 1""",
                        (sequence_id,),
                    )
                    step = cur.fetchone()
                    delay_d = step[0] if step else 0
                    delay_h = step[1] if step else 0
                    next_send = datetime.now(timezone.utc) + timedelta(
                        days=delay_d, hours=delay_h,
                    )
                    cur.execute(
                        """INSERT INTO e30.enrollments
                           (sequence_id, donor_id, email, tenant_id,
                            current_step, next_send_at)
                           VALUES (%s, %s, %s, %s, 1, %s)
                           RETURNING enrollment_id""",
                        (sequence_id, donor_id, email, tenant_id, next_send),
                    )
                    eid = str(cur.fetchone()[0])
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return eid
        except Exception as exc:
            logger.error("Enrollment failed: %s", exc)
            return None

    def get_pending_sends(self) -> List[Dict[str, Any]]:
        """Get all enrollments ready for their next step."""
        if not self._pool:
            return []
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT e.enrollment_id, e.sequence_id, e.donor_id,
                                  e.email, e.tenant_id, e.current_step,
                                  s.template_id, s.subject_override,
                                  s.condition, s.is_fundraising, s.grade_filter,
                                  seq.candidate_id
                           FROM e30.enrollments e
                           JOIN e30.sequence_steps s
                             ON e.sequence_id = s.sequence_id
                            AND e.current_step = s.step_number
                           JOIN e30.sequences seq
                             ON e.sequence_id = seq.sequence_id
                           WHERE e.status = 'active'
                             AND e.next_send_at <= NOW()
                             AND seq.is_active = TRUE
                           ORDER BY e.next_send_at ASC
                           LIMIT 1000""",
                    )
                    cols = [d[0] for d in cur.description]
                    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return rows
        except Exception as exc:
            logger.error("Get pending sends failed: %s", exc)
            return []

    def advance(self, enrollment_id: str) -> bool:
        """Advance enrollment to the next step or complete it."""
        if not self._pool:
            return False
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT sequence_id, current_step FROM e30.enrollments
                           WHERE enrollment_id = %s""",
                        (enrollment_id,),
                    )
                    row = cur.fetchone()
                    if not row:
                        return False
                    seq_id, current = row
                    next_step = current + 1

                    cur.execute(
                        """SELECT delay_days, delay_hours FROM e30.sequence_steps
                           WHERE sequence_id = %s AND step_number = %s""",
                        (seq_id, next_step),
                    )
                    next_data = cur.fetchone()
                    if next_data:
                        next_send = datetime.now(timezone.utc) + timedelta(
                            days=next_data[0], hours=next_data[1],
                        )
                        cur.execute(
                            """UPDATE e30.enrollments SET
                                   current_step = %s, next_send_at = %s
                               WHERE enrollment_id = %s""",
                            (next_step, next_send, enrollment_id),
                        )
                    else:
                        cur.execute(
                            """UPDATE e30.enrollments SET
                                   status = 'completed', completed_at = NOW()
                               WHERE enrollment_id = %s""",
                            (enrollment_id,),
                        )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return True
        except Exception as exc:
            logger.error("Advance enrollment failed: %s", exc)
            return False


# ---------------------------------------------------------------------------
# Built-in political sequence templates
# ---------------------------------------------------------------------------

POLITICAL_SEQUENCE_TEMPLATES: Dict[SequenceType, List[Dict[str, Any]]] = {
    SequenceType.WELCOME: [
        {"step": 1, "delay_days": 0, "subject": "Welcome — and thank you",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 2, "subject": "Here's what we're fighting for",
         "condition": "always", "fundraising": False},
        {"step": 3, "delay_days": 5, "subject": "Your impact so far",
         "condition": "opened_previous", "fundraising": False},
        {"step": 4, "delay_days": 10, "subject": "Will you stand with us?",
         "condition": "always", "fundraising": True},
    ],
    SequenceType.LAPSED_REACTIVATION: [
        {"step": 1, "delay_days": 0, "subject": "We miss you",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 3, "subject": "A lot has changed — here's an update",
         "condition": "not_opened", "fundraising": False},
        {"step": 3, "delay_days": 7, "subject": "One question for you",
         "condition": "always", "fundraising": False},
        {"step": 4, "delay_days": 14, "subject": "Last chance to rejoin the fight",
         "condition": "not_donated", "fundraising": True},
    ],
    SequenceType.GOTV: [
        {"step": 1, "delay_days": 0, "subject": "10 days out — your vote matters",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 3, "subject": "Your polling place + what's on the ballot",
         "condition": "always", "fundraising": False},
        {"step": 3, "delay_days": 5, "subject": "Have you voted yet?",
         "condition": "always", "fundraising": False},
        {"step": 4, "delay_days": 8, "subject": "Tomorrow is Election Day",
         "condition": "not_donated", "fundraising": False},
        {"step": 5, "delay_days": 9, "subject": "VOTE TODAY — polls close at 7:30 PM",
         "condition": "always", "fundraising": False},
    ],
    SequenceType.EVENT_INVITATION: [
        {"step": 1, "delay_days": 0, "subject": "Save the date",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 7, "subject": "You're invited",
         "condition": "always", "fundraising": False},
        {"step": 3, "delay_days": 12, "subject": "RSVP reminder — seats are filling up",
         "condition": "not_clicked", "fundraising": False},
        {"step": 4, "delay_days": 13, "subject": "Tomorrow — see you there",
         "condition": "clicked_previous", "fundraising": False},
    ],
    SequenceType.DONOR_CULTIVATION: [
        {"step": 1, "delay_days": 0, "subject": "Thank you for your support",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 14, "subject": "Your dollars at work",
         "condition": "always", "fundraising": False},
        {"step": 3, "delay_days": 30, "subject": "Quarterly impact report",
         "condition": "always", "fundraising": False},
        {"step": 4, "delay_days": 45, "subject": "Can we count on you again?",
         "condition": "always", "fundraising": True},
    ],
    SequenceType.VOLUNTEER_RECRUITMENT: [
        {"step": 1, "delay_days": 0, "subject": "We need your help",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 3, "subject": "What volunteering looks like",
         "condition": "opened_previous", "fundraising": False},
        {"step": 3, "delay_days": 7, "subject": "3 ways to make a difference this week",
         "condition": "always", "fundraising": False},
        {"step": 4, "delay_days": 10, "subject": "One hour. Real impact.",
         "condition": "not_clicked", "fundraising": False},
        {"step": 5, "delay_days": 14, "subject": "Sign up — your community is counting on you",
         "condition": "always", "fundraising": False},
    ],
    SequenceType.POST_EVENT: [
        {"step": 1, "delay_days": 1, "subject": "Thank you for last night",
         "condition": "always", "fundraising": False},
        {"step": 2, "delay_days": 3, "subject": "Photos + highlights from the event",
         "condition": "always", "fundraising": False},
        {"step": 3, "delay_days": 7, "subject": "Keep the momentum going",
         "condition": "always", "fundraising": True},
    ],
}
