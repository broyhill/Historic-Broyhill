"""
E31 Number Pool — Twilio/Sendblue number → candidate assignment.

Each candidate gets dedicated phone numbers for RLS isolation.
Manages 10DLC brand/campaign registration, number provisioning,
and rotation for deliverability.
"""

import logging
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.number_pool")


class NumberPoolManager:
    """Phone number pool management and candidate assignment."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def assign_number(
        self,
        phone_e164: str,
        candidate_id: UUID,
        number_type: str = "local",
        twilio_sid: Optional[str] = None,
    ) -> None:
        """Assign a phone number to a candidate."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_number_pool
                        (phone_e164, candidate_id, number_type,
                         twilio_sid, status)
                    VALUES (%s, %s, %s, %s, 'active')
                    ON CONFLICT (phone_e164) DO UPDATE SET
                        candidate_id = EXCLUDED.candidate_id,
                        number_type = EXCLUDED.number_type,
                        twilio_sid = EXCLUDED.twilio_sid,
                        status = 'active',
                        updated_at = NOW()
                    """,
                    (phone_e164, str(candidate_id), number_type, twilio_sid),
                )
            conn.commit()
        finally:
            conn.close()

    def get_number_for_candidate(self, candidate_id: UUID) -> Optional[str]:
        """Get the active phone number assigned to a candidate."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT phone_e164 FROM e31.sms_number_pool
                    WHERE candidate_id = %s AND status = 'active'
                    ORDER BY created_at ASC LIMIT 1
                    """,
                    (str(candidate_id),),
                )
                row = cur.fetchone()
                return row["phone_e164"] if row else None
        finally:
            conn.close()

    def get_candidate_numbers(self, candidate_id: UUID) -> list:
        """Get all numbers assigned to a candidate."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT phone_e164, number_type, twilio_sid,
                           ten_dlc_brand_id, ten_dlc_campaign_id,
                           status, created_at
                    FROM e31.sms_number_pool
                    WHERE candidate_id = %s
                    ORDER BY created_at ASC
                    """,
                    (str(candidate_id),),
                )
                return cur.fetchall()
        finally:
            conn.close()

    def release_number(self, phone_e164: str) -> None:
        """Release a number back to the unassigned pool."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_number_pool
                    SET status = 'released', candidate_id = NULL,
                        updated_at = NOW()
                    WHERE phone_e164 = %s
                    """,
                    (phone_e164,),
                )
            conn.commit()
        finally:
            conn.close()

    def register_10dlc(
        self,
        phone_e164: str,
        brand_id: str,
        campaign_id: str,
    ) -> None:
        """Record 10DLC brand/campaign registration for a number."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_number_pool
                    SET ten_dlc_brand_id = %s,
                        ten_dlc_campaign_id = %s,
                        updated_at = NOW()
                    WHERE phone_e164 = %s
                    """,
                    (brand_id, campaign_id, phone_e164),
                )
            conn.commit()
        finally:
            conn.close()

    def get_unassigned_numbers(self) -> list:
        """Get numbers not yet assigned to any candidate."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT phone_e164, number_type, twilio_sid
                    FROM e31.sms_number_pool
                    WHERE candidate_id IS NULL AND status = 'active'
                    ORDER BY created_at ASC
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()

    def pool_summary(self) -> dict:
        """Summary of the number pool: total, assigned, available, by type."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE candidate_id IS NOT NULL) AS assigned,
                        COUNT(*) FILTER (WHERE candidate_id IS NULL AND status = 'active') AS available,
                        COUNT(*) FILTER (WHERE number_type = 'local') AS local_numbers,
                        COUNT(*) FILTER (WHERE number_type = 'toll_free') AS toll_free,
                        COUNT(*) FILTER (WHERE number_type = '10dlc') AS ten_dlc,
                        COUNT(*) FILTER (WHERE ten_dlc_brand_id IS NOT NULL) AS registered_10dlc
                    FROM e31.sms_number_pool
                    """,
                )
                return cur.fetchone()
        finally:
            conn.close()
