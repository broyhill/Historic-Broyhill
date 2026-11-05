"""
E31 Phone Registry — contact verification, line-type detection, carrier lookup.

Platform-wide phone intelligence: validates numbers, detects landlines,
checks iMessage capability, scrubs TCPA litigators, cross-references
donor spine. Feeds into consent gate and send routing decisions.
"""

import logging
from datetime import datetime
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.consent import ConsentManager
from ecosystems.e31_sms_mms.providers import (
    SendblueProvider, TwilioProvider, get_configured_providers,
)

logger = logging.getLogger("e31.phone_registry")


class PhoneRegistry:
    """Platform-wide phone number intelligence and verification."""

    def __init__(self) -> None:
        self._consent = ConsentManager()

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def verify_phone(self, phone: str) -> dict:
        """Full verification: line-type, carrier, validity, iMessage check.

        Returns: {
            'phone_e164': str,
            'is_valid': bool,
            'line_type': str,   # mobile, landline, voip, unknown
            'carrier': str,
            'is_mobile': bool,
            'is_imessage': bool,
            'caller_name': str,
        }
        """
        phone = self._consent.normalize_phone(phone)
        result = {
            "phone_e164": phone,
            "is_valid": False,
            "line_type": "unknown",
            "carrier": "",
            "is_mobile": False,
            "is_imessage": False,
            "caller_name": "",
        }

        # Twilio Lookup for line-type and carrier
        if E31Config.is_twilio_configured():
            twilio = TwilioProvider()
            lookup = twilio.check_phone_capability(phone)
            result["is_valid"] = lookup.get("is_valid", False)
            result["line_type"] = lookup.get("line_type", "unknown")
            result["carrier"] = lookup.get("carrier", "")
            result["is_mobile"] = lookup.get("is_mobile", False)
            result["caller_name"] = lookup.get("caller_name", "")

        # Sendblue iMessage check (only for mobile numbers)
        if (
            E31Config.is_sendblue_configured()
            and result["line_type"] != "landline"
        ):
            sendblue = SendblueProvider()
            imessage = sendblue.check_imessage_capability(phone)
            result["is_imessage"] = imessage.get("is_imessage", False)

        # Persist to registry
        self._update_registry(result)
        return result

    def _update_registry(self, info: dict) -> None:
        """Upsert phone verification results into sms_phone_registry."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO core.sms_phone_registry
                        (phone_e164, is_valid, line_type, carrier)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (phone_e164) DO UPDATE SET
                        is_valid = EXCLUDED.is_valid,
                        line_type = EXCLUDED.line_type,
                        carrier = EXCLUDED.carrier,
                        updated_at = NOW()
                    """,
                    (
                        info["phone_e164"],
                        info["is_valid"],
                        info["line_type"],
                        info["carrier"],
                    ),
                )
            conn.commit()
        finally:
            conn.close()

    def bulk_verify(self, phones: list) -> list:
        """Verify a batch of phone numbers. Returns list of results."""
        results = []
        for phone in phones:
            results.append(self.verify_phone(phone))
        return results

    def get_registry_entry(self, phone: str) -> Optional[dict]:
        """Look up a phone in the registry."""
        phone = self._consent.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM core.sms_phone_registry WHERE phone_e164 = %s",
                    (phone,),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def match_to_donor(self, phone: str) -> Optional[dict]:
        """Cross-reference phone → donor spine (rnc_regid, cluster_id)."""
        phone = self._consent.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT dp.cluster_id, dp.rnc_regid,
                           dp.norm_first, dp.norm_last,
                           dp.donor_grade_state, dp.lifetime_total
                    FROM core.donor_profile dp
                    WHERE dp.cell_phone = %s
                       OR dp.home_phone = %s
                    LIMIT 1
                    """,
                    (phone, phone),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def get_eligible_phones(
        self, candidate_id: str, segment: Optional[str] = None,
    ) -> list:
        """Get phones eligible for outreach right now (fatigue-filtered).

        Uses the v_eligible_phones view from the E31 schema.
        """
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT phone_e164, rnc_regid, opt_in_status,
                           line_type, carrier
                    FROM e31.v_eligible_phones
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()

    def scrub_landlines(self, phones: list) -> dict:
        """Separate mobile from landline numbers.

        Returns: {'mobile': [...], 'landline': [...], 'unknown': [...]}
        """
        result = {"mobile": [], "landline": [], "unknown": []}
        for phone in phones:
            info = self.verify_phone(phone)
            if info["line_type"] == "landline":
                result["landline"].append(phone)
            elif info["is_mobile"]:
                result["mobile"].append(phone)
            else:
                result["unknown"].append(phone)
        return result

    def detect_imessage_batch(self, phones: list) -> dict:
        """Check iMessage capability for a batch of phones.

        Returns: {'imessage': [...], 'sms_only': [...]}
        """
        result = {"imessage": [], "sms_only": []}
        if not E31Config.is_sendblue_configured():
            result["sms_only"] = phones
            return result

        sendblue = SendblueProvider()
        for phone in phones:
            phone = self._consent.normalize_phone(phone)
            check = sendblue.check_imessage_capability(phone)
            if check.get("is_imessage"):
                result["imessage"].append(phone)
            else:
                result["sms_only"].append(phone)
        return result
