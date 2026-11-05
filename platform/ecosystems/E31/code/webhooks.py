"""
E31 Webhooks — Twilio/Sinch/Sendblue status callbacks + inbound handlers.

FastAPI route handlers for:
- Twilio status callbacks (delivered, failed, undelivered)
- Twilio inbound SMS
- Sendblue status updates (sent, delivered, read)
- Sendblue inbound iMessage
- Sinch/Bandwidth delivery receipts
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Optional

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.consent import ConsentManager
from ecosystems.e31_sms_mms.conversations import ConversationManager
from ecosystems.e31_sms_mms.entities import InboundMessage, MessageStatus

logger = logging.getLogger("e31.webhooks")


class WebhookProcessor:
    """Process provider webhook payloads — status updates and inbound."""

    def __init__(self) -> None:
        self._consent = ConsentManager()
        self._conversations = ConversationManager()

    def process_twilio_status(self, payload: dict) -> dict:
        """Handle Twilio status callback (MessageStatus webhook).

        Expected payload keys: MessageSid, MessageStatus, ErrorCode, To, From
        """
        message_sid = payload.get("MessageSid", "")
        status = payload.get("MessageStatus", "")
        error_code = payload.get("ErrorCode")
        to_phone = payload.get("To", "")

        import psycopg2
        conn = psycopg2.connect(E31Config.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_platform_log
                    SET twilio_status = %s,
                        error_code = %s,
                        updated_at = NOW()
                    WHERE twilio_message_sid = %s
                    """,
                    (status, error_code, message_sid),
                )
            conn.commit()
        finally:
            conn.close()

        return {"processed": True, "sid": message_sid, "status": status}

    def process_twilio_inbound(self, payload: dict) -> dict:
        """Handle Twilio inbound SMS webhook.

        Expected payload: From, To, Body, MessageSid, NumMedia, MediaUrl0, etc.
        """
        inbound = InboundMessage(
            from_phone=payload.get("From", ""),
            to_phone=payload.get("To", ""),
            message_body=payload.get("Body", ""),
            twilio_message_sid=payload.get("MessageSid", ""),
            received_at=datetime.utcnow(),
        )

        num_media = int(payload.get("NumMedia", 0))
        if num_media > 0:
            inbound.media_url = payload.get("MediaUrl0", "")

        # Route through conversation manager
        result = self._conversations.process_inbound(inbound)
        return result

    def process_sendblue_status(self, payload: dict) -> dict:
        """Handle Sendblue status webhook.

        Sendblue sends: message_id, status (sent/delivered/read),
        is_read, read_at, error_message, number.
        """
        message_id = payload.get("message_id", "")
        status = payload.get("status", "")
        is_read = payload.get("is_read", False)
        read_at = payload.get("read_at")

        import psycopg2
        conn = psycopg2.connect(E31Config.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_platform_log
                    SET twilio_status = %s,
                        is_read = %s,
                        read_at = %s,
                        updated_at = NOW()
                    WHERE twilio_message_sid = %s
                    """,
                    (status, is_read, read_at, message_id),
                )
            conn.commit()
        finally:
            conn.close()

        # Track read receipt for behavior analytics
        if is_read:
            self._track_read_receipt(payload.get("number", ""), message_id)

        return {"processed": True, "message_id": message_id, "status": status}

    def process_sendblue_inbound(self, payload: dict) -> dict:
        """Handle Sendblue inbound iMessage webhook.

        Payload: number, content, media_url, message_id, date
        """
        inbound = InboundMessage(
            from_phone=payload.get("number", ""),
            to_phone=payload.get("to_number", ""),
            message_body=payload.get("content", ""),
            twilio_message_sid=payload.get("message_id", ""),
            media_url=payload.get("media_url"),
            received_at=datetime.utcnow(),
        )

        result = self._conversations.process_inbound(inbound)
        return result

    def _track_read_receipt(self, phone: str, message_id: str) -> None:
        """Track iMessage read receipt for donor behavior scoring."""
        import psycopg2
        conn = psycopg2.connect(E31Config.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_behavior_events
                        (phone_e164, event_type, event_data, occurred_at)
                    VALUES (%s, 'read_receipt', %s, NOW())
                    """,
                    (phone, f'{{"message_id": "{message_id}"}}'),
                )
            conn.commit()
        except Exception as exc:
            logger.error("Failed to track read receipt: %s", exc)
        finally:
            conn.close()

    def verify_twilio_signature(
        self, url: str, params: dict, signature: str,
    ) -> bool:
        """Verify Twilio webhook signature for security."""
        if not E31Config.TWILIO_AUTH_TOKEN:
            return False
        sorted_params = "".join(
            f"{k}{v}" for k, v in sorted(params.items())
        )
        data = f"{url}{sorted_params}"
        expected = hmac.new(
            E31Config.TWILIO_AUTH_TOKEN.encode(),
            data.encode(),
            hashlib.sha1,
        ).digest()
        import base64
        return hmac.compare_digest(
            signature, base64.b64encode(expected).decode(),
        )
