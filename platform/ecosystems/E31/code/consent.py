"""
E31 Consent Manager — TCPA/10DLC compliance gate.

Every outbound message MUST pass through check_consent() before sending.
Opt-out is platform-wide: once a phone opts out, NO candidate can text it.
STOP keyword processing is automatic on every inbound webhook.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.entities import ConsentStatus

logger = logging.getLogger("e31.consent")


class ConsentManager:
    """TCPA/10DLC consent gate — the law before any send."""

    STOP_KEYWORDS = E31Config.STOP_KEYWORDS
    HELP_KEYWORDS = E31Config.HELP_KEYWORDS

    HELP_RESPONSE = (
        "Reply STOP to unsubscribe. Msg&data rates may apply. "
        "For help, contact support@broyhill.net"
    )
    STOP_CONFIRMATION = (
        "You have been unsubscribed and will not receive further messages. "
        "Reply START to re-subscribe."
    )
    START_KEYWORDS = ["start", "unstop", "subscribe", "yes"]

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    @staticmethod
    def normalize_phone(phone: str) -> str:
        """Normalize to E.164 format (+1XXXXXXXXXX)."""
        digits = re.sub(r"[^\d]", "", phone)
        if len(digits) == 10:
            digits = "1" + digits
        if len(digits) == 11 and digits[0] == "1":
            return f"+{digits}"
        return f"+{digits}"

    def check_consent(self, phone: str) -> dict:
        """Check if a phone has consent to receive messages.

        Returns: {
            'can_send': bool,
            'status': str,  # opted_in, opted_out, unknown, pending
            'reason': str,  # why blocked if can_send=False
            'texts_today': int,
        }

        BLOCKING RULES (any one blocks the send):
        1. opted_out → permanent block until re-opt-in
        2. texts_today >= TEXTS_PER_DAY_LIMIT → fatigue block
        3. is_valid = False → invalid number
        4. line_type = 'landline' → can't receive SMS
        """
        phone = self.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT opt_in_status, is_valid, line_type,
                           texts_today, texts_today_date
                    FROM core.sms_phone_registry
                    WHERE phone_e164 = %s
                    """,
                    (phone,),
                )
                row = cur.fetchone()
        finally:
            conn.close()

        if not row:
            return {
                "can_send": False,
                "status": "unknown",
                "reason": "not_in_registry",
                "texts_today": 0,
            }

        if row["opt_in_status"] == "opted_out":
            return {
                "can_send": False,
                "status": "opted_out",
                "reason": "opted_out",
                "texts_today": row["texts_today"],
            }

        if not row["is_valid"]:
            return {
                "can_send": False,
                "status": row["opt_in_status"],
                "reason": "invalid_number",
                "texts_today": row["texts_today"],
            }

        if row["line_type"] == "landline":
            return {
                "can_send": False,
                "status": row["opt_in_status"],
                "reason": "landline",
                "texts_today": row["texts_today"],
            }

        texts_today = row["texts_today"]
        today = datetime.utcnow().date()
        if str(row["texts_today_date"]) != str(today):
            texts_today = 0

        if texts_today >= E31Config.TEXTS_PER_DAY_LIMIT:
            return {
                "can_send": False,
                "status": row["opt_in_status"],
                "reason": "fatigue_limit",
                "texts_today": texts_today,
            }

        return {
            "can_send": True,
            "status": row["opt_in_status"],
            "reason": "eligible",
            "texts_today": texts_today,
        }

    def process_stop(
        self, phone: str, keyword: str,
    ) -> str:
        """Process a STOP keyword — opt out platform-wide. Returns confirmation."""
        phone = self.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO core.sms_phone_registry
                        (phone_e164, opt_in_status, opt_out_timestamp,
                         opt_out_keyword)
                    VALUES (%s, 'opted_out', NOW(), %s)
                    ON CONFLICT (phone_e164) DO UPDATE SET
                        opt_in_status = 'opted_out',
                        opt_out_timestamp = NOW(),
                        opt_out_keyword = %s,
                        updated_at = NOW()
                    """,
                    (phone, keyword, keyword),
                )
            conn.commit()
        finally:
            conn.close()
        logger.info("STOP processed for %s (keyword: %s)", phone, keyword)
        return self.STOP_CONFIRMATION

    def process_start(self, phone: str) -> str:
        """Process a START/re-subscribe keyword."""
        phone = self.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE core.sms_phone_registry
                    SET opt_in_status = 'opted_in',
                        opt_in_timestamp = NOW(),
                        opt_in_source = 'reply_start',
                        opt_out_timestamp = NULL,
                        opt_out_keyword = NULL,
                        updated_at = NOW()
                    WHERE phone_e164 = %s
                    """,
                    (phone,),
                )
            conn.commit()
        finally:
            conn.close()
        return "You have been re-subscribed. Reply STOP to opt out at any time."

    def record_opt_in(
        self,
        phone: str,
        source: str,
        rnc_regid: Optional[str] = None,
    ) -> None:
        """Record explicit opt-in (website form, reply YES, import, etc.)."""
        phone = self.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO core.sms_phone_registry
                        (phone_e164, opt_in_status, opt_in_source,
                         opt_in_timestamp, rnc_regid)
                    VALUES (%s, 'opted_in', %s, NOW(), %s)
                    ON CONFLICT (phone_e164) DO UPDATE SET
                        opt_in_status = 'opted_in',
                        opt_in_source = %s,
                        opt_in_timestamp = NOW(),
                        rnc_regid = COALESCE(%s, core.sms_phone_registry.rnc_regid),
                        updated_at = NOW()
                    """,
                    (phone, source, rnc_regid, source, rnc_regid),
                )
            conn.commit()
        finally:
            conn.close()

    def increment_texts_today(self, phone: str) -> None:
        """Bump texts_today after a successful send."""
        phone = self.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE core.sms_phone_registry
                    SET texts_today = CASE
                            WHEN texts_today_date = CURRENT_DATE
                            THEN texts_today + 1
                            ELSE 1
                        END,
                        texts_today_date = CURRENT_DATE,
                        last_texted_at = NOW(),
                        updated_at = NOW()
                    WHERE phone_e164 = %s
                    """,
                    (phone,),
                )
            conn.commit()
        finally:
            conn.close()

    def classify_inbound(self, body: str) -> str:
        """Classify an inbound message as stop/help/start/reply."""
        normalized = body.strip().lower()
        if normalized in self.STOP_KEYWORDS:
            return "stop"
        if normalized in self.HELP_KEYWORDS:
            return "help"
        if normalized in self.START_KEYWORDS:
            return "start"
        return "reply"

    def bulk_register(
        self,
        phones: list,
        source: str = "import",
        status: str = "opted_in",
    ) -> int:
        """Bulk-register phones into the registry. Returns count inserted."""
        conn = self._get_db()
        count = 0
        try:
            with conn.cursor() as cur:
                for phone in phones:
                    phone = self.normalize_phone(phone)
                    cur.execute(
                        """
                        INSERT INTO core.sms_phone_registry
                            (phone_e164, opt_in_status, opt_in_source,
                             opt_in_timestamp)
                        VALUES (%s, %s, %s, NOW())
                        ON CONFLICT (phone_e164) DO NOTHING
                        """,
                        (phone, status, source),
                    )
                    count += cur.rowcount
            conn.commit()
        finally:
            conn.close()
        return count
