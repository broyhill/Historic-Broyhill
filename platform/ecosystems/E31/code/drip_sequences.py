"""
E31 Drip Sequences — multi-step automated message sequences.

Time-delayed sequences triggered by enrollment (opt-in, donation,
event signup, etc.). Each step fires at a configurable delay.
Stops on opt-out or manual cancellation.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.drip_sequences")


class DripSequenceManager:
    """Multi-step automated drip sequence engine."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def create_sequence(
        self,
        candidate_id: UUID,
        name: str,
        steps: list,
        trigger_event: Optional[str] = None,
    ) -> UUID:
        """Create a drip sequence with ordered steps.

        steps: [
            {'body': '...', 'delay_days': 0, 'delay_hours': 0, 'media_url': None},
            {'body': '...', 'delay_days': 1, 'delay_hours': 12, 'media_url': '...'},
            ...
        ]
        """
        sequence_id = uuid4()
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_drip_sequences
                        (sequence_id, candidate_id, sequence_name,
                         trigger_event, steps_json, status)
                    VALUES (%s, %s, %s, %s, %s, 'active')
                    """,
                    (
                        str(sequence_id), str(candidate_id), name,
                        trigger_event,
                        psycopg2.extras.Json(steps),
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return sequence_id

    def enroll(
        self,
        sequence_id: UUID,
        phone: str,
        context: Optional[dict] = None,
    ) -> UUID:
        """Enroll a phone in a drip sequence. Returns enrollment_id."""
        enrollment_id = uuid4()
        first_send = datetime.utcnow()

        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_drip_enrollments
                        (enrollment_id, sequence_id, phone_e164,
                         current_step, context, status,
                         next_send_at)
                    VALUES (%s, %s, %s, 1, %s, 'active', %s)
                    """,
                    (
                        str(enrollment_id), str(sequence_id), phone,
                        json.dumps(context or {}), first_send,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return enrollment_id

    def get_pending_sends(self) -> list:
        """Get drip enrollments ready to fire their next step."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT e.enrollment_id, e.sequence_id, e.phone_e164,
                           e.current_step, e.context,
                           s.steps_json, s.candidate_id, s.sequence_name
                    FROM e31.sms_drip_enrollments e
                    JOIN e31.sms_drip_sequences s
                        ON s.sequence_id = e.sequence_id
                    WHERE e.status = 'active'
                      AND e.next_send_at <= NOW()
                    ORDER BY e.next_send_at ASC
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()

    def advance_step(self, enrollment_id: UUID) -> Optional[dict]:
        """Advance enrollment to the next step. Returns next step info or None."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT e.*, s.steps_json
                    FROM e31.sms_drip_enrollments e
                    JOIN e31.sms_drip_sequences s ON s.sequence_id = e.sequence_id
                    WHERE e.enrollment_id = %s
                    """,
                    (str(enrollment_id),),
                )
                row = cur.fetchone()
        finally:
            conn.close()

        if not row:
            return None

        steps = row["steps_json"]
        next_step_num = row["current_step"] + 1

        if next_step_num > len(steps):
            self._complete_enrollment(enrollment_id)
            return None

        next_step = steps[next_step_num - 1]
        delay = timedelta(
            days=next_step.get("delay_days", 0),
            hours=next_step.get("delay_hours", 0),
        )
        next_send = datetime.utcnow() + delay

        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_drip_enrollments
                    SET current_step = %s, next_send_at = %s, updated_at = NOW()
                    WHERE enrollment_id = %s
                    """,
                    (next_step_num, next_send, str(enrollment_id)),
                )
            conn.commit()
        finally:
            conn.close()

        return {
            "step": next_step_num,
            "body": next_step.get("body", ""),
            "media_url": next_step.get("media_url"),
            "send_at": next_send.isoformat(),
        }

    def cancel_enrollment(self, enrollment_id: UUID) -> None:
        """Cancel a drip enrollment (e.g., on opt-out)."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_drip_enrollments
                    SET status = 'cancelled', updated_at = NOW()
                    WHERE enrollment_id = %s
                    """,
                    (str(enrollment_id),),
                )
            conn.commit()
        finally:
            conn.close()

    def _complete_enrollment(self, enrollment_id: UUID) -> None:
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_drip_enrollments
                    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                    WHERE enrollment_id = %s
                    """,
                    (str(enrollment_id),),
                )
            conn.commit()
        finally:
            conn.close()

    def get_sequence_analytics(self, sequence_id: UUID) -> dict:
        """Analytics for a drip sequence: enrollment, completion, drop-off per step."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_enrolled,
                        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                        COUNT(*) FILTER (WHERE status = 'active') AS active,
                        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                        AVG(current_step) AS avg_step_reached,
                        MAX(current_step) AS max_step_reached
                    FROM e31.sms_drip_enrollments
                    WHERE sequence_id = %s
                    """,
                    (str(sequence_id),),
                )
                return cur.fetchone()
        finally:
            conn.close()
