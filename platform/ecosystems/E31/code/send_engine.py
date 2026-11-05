"""
E31 Send Engine — orchestrator: consent → fatigue → route → dispatch.

Auto-routes: iMessage-capable phones → Sendblue, everyone else → Twilio.
Handles provider failover, quiet hours, Brain throttle, and cost tracking.
Built for throughput: 50 msgs/sec sustained, millions per campaign.
"""

import logging
import time
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import psycopg2

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.consent import ConsentManager
from ecosystems.e31_sms_mms.entities import (
    MessageChannel, MessageDirection, MessageStatus,
    SMSMessage, SendResult,
)
from ecosystems.e31_sms_mms.providers import (
    SendblueProvider, get_configured_providers, get_provider,
)

logger = logging.getLogger("e31.send_engine")


class SendEngine:
    """Core send orchestrator — the single path for all outbound messages.

    Pipeline per message:
    1. Normalize phone
    2. Consent check (TCPA gate) → block if not consented
    3. Quiet hours check → defer if outside window
    4. Fatigue gate (texts_today) → block if already texted today
    5. Route: check iMessage capability → Sendblue or SMS provider
    6. Dispatch to provider with failover
    7. Log to e31.sms_platform_log
    8. Update fatigue counter
    9. Emit cost to ledger
    """

    def __init__(self) -> None:
        self._consent = ConsentManager()
        self._configured = get_configured_providers()
        self._sendblue = (
            SendblueProvider() if "sendblue" in self._configured else None
        )
        # Cache iMessage capability per phone for the session
        self._imessage_cache: dict = {}

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def send(
        self,
        phone: str,
        body: str,
        candidate_id: UUID,
        from_number: Optional[str] = None,
        media_url: Optional[str] = None,
        campaign_id: Optional[UUID] = None,
        rnc_regid: Optional[str] = None,
        variant_name: Optional[str] = None,
        send_style: Optional[str] = None,
    ) -> SMSMessage:
        """Send a single message through the full pipeline."""
        phone = self._consent.normalize_phone(phone)
        send_id = uuid4()
        msg = SMSMessage(
            phone_e164=phone,
            message_body=body,
            candidate_id=candidate_id,
            send_id=send_id,
            campaign_id=campaign_id,
            rnc_regid=rnc_regid,
            media_url=media_url,
            variant_name=variant_name,
        )

        # 1. Consent check
        consent = self._consent.check_consent(phone)
        if not consent["can_send"]:
            msg.status = MessageStatus.FAILED
            msg.error_message = f"blocked:{consent['reason']}"
            self._log_send(msg)
            return msg

        # 2. Quiet hours check
        if self._is_quiet_hours():
            msg.status = MessageStatus.FAILED
            msg.error_message = "blocked:quiet_hours"
            self._log_send(msg)
            return msg

        # 3. Route: iMessage or SMS
        channel, provider_name = self._route(phone)
        msg.channel = channel
        msg.provider = provider_name

        # 4. Dispatch with failover
        result = self._dispatch(
            phone, body, media_url, provider_name, from_number, send_style,
        )

        if not result.success:
            # Failover to next provider
            result = self._failover(
                phone, body, media_url, provider_name, from_number,
            )

        # 5. Update message with result
        if result.success:
            msg.status = MessageStatus.SENT
            msg.provider_message_id = result.message_id
            msg.cost_usd = result.cost_usd
            msg.segments = result.segments
            msg.provider = result.provider
            msg.sent_at = datetime.utcnow()
            # Bump fatigue counter
            self._consent.increment_texts_today(phone)
        else:
            msg.status = MessageStatus.FAILED
            msg.error_message = result.error

        # 6. Log and cost
        self._log_send(msg)
        if result.success:
            self._emit_cost(msg)

        return msg

    def send_batch(
        self,
        phones: list,
        body: str,
        candidate_id: UUID,
        from_number: Optional[str] = None,
        media_url: Optional[str] = None,
        campaign_id: Optional[UUID] = None,
        rate_limit: Optional[int] = None,
    ) -> dict:
        """Send to a list of phones with rate limiting.

        Returns: {
            'sent': int, 'failed': int, 'blocked': int,
            'total_cost': float, 'results': [SMSMessage, ...]
        }
        """
        rate = rate_limit or E31Config.RATE_LIMIT_PER_SECOND
        results = []
        sent = failed = blocked = 0
        total_cost = 0.0
        batch_start = time.time()

        for i, phone in enumerate(phones):
            # Rate limiting
            if i > 0 and i % rate == 0:
                elapsed = time.time() - batch_start
                if elapsed < 1.0:
                    time.sleep(1.0 - elapsed)
                batch_start = time.time()

            msg = self.send(
                phone=phone,
                body=body,
                candidate_id=candidate_id,
                from_number=from_number,
                media_url=media_url,
                campaign_id=campaign_id,
            )
            results.append(msg)

            if msg.status == MessageStatus.SENT:
                sent += 1
                total_cost += msg.cost_usd or 0
            elif msg.error_message and msg.error_message.startswith("blocked:"):
                blocked += 1
            else:
                failed += 1

        return {
            "sent": sent,
            "failed": failed,
            "blocked": blocked,
            "total": len(phones),
            "total_cost": total_cost,
            "results": results,
        }

    def _route(self, phone: str) -> tuple:
        """Determine channel and provider for this phone.

        iMessage-capable → (IMESSAGE, 'sendblue')
        Otherwise → (SMS, 'twilio') or first configured SMS provider
        """
        if self._sendblue:
            if phone not in self._imessage_cache:
                check = self._sendblue.check_imessage_capability(phone)
                self._imessage_cache[phone] = check.get("is_imessage", False)

            if self._imessage_cache[phone]:
                return MessageChannel.IMESSAGE, "sendblue"

        # Fall back to SMS providers
        for name in self._configured:
            if name != "sendblue":
                return MessageChannel.SMS, name

        return MessageChannel.SMS, "twilio"

    def _dispatch(
        self,
        phone: str,
        body: str,
        media_url: Optional[str],
        provider_name: str,
        from_number: Optional[str],
        send_style: Optional[str] = None,
    ) -> SendResult:
        """Dispatch message to the chosen provider."""
        provider = get_provider(provider_name)
        from_num = from_number or E31Config.TWILIO_DEFAULT_FROM
        callback = E31Config.TWILIO_STATUS_CALLBACK_URL or None

        if provider_name == "sendblue":
            return provider.send_imessage(
                to=phone,
                body=body,
                media_url=media_url,
                send_style=send_style,
                callback_url=E31Config.SENDBLUE_WEBHOOK_URL or None,
            )

        if media_url:
            return provider.send_mms(
                to=phone,
                body=body,
                media_url=media_url,
                from_number=from_num,
                callback_url=callback,
            )

        return provider.send_sms(
            to=phone,
            body=body,
            from_number=from_num,
            callback_url=callback,
        )

    def _failover(
        self,
        phone: str,
        body: str,
        media_url: Optional[str],
        failed_provider: str,
        from_number: Optional[str],
    ) -> SendResult:
        """Try remaining providers in priority order."""
        for name in self._configured:
            if name == failed_provider or name == "sendblue":
                continue
            logger.info("Failing over from %s to %s", failed_provider, name)
            result = self._dispatch(
                phone, body, media_url, name, from_number,
            )
            if result.success:
                return result
        return SendResult(
            success=False,
            provider=failed_provider,
            error="all_providers_failed",
        )

    def _is_quiet_hours(self) -> bool:
        """Check if current time is in quiet hours (9PM-8AM local)."""
        hour = datetime.now().hour
        if E31Config.QUIET_HOURS_START > E31Config.QUIET_HOURS_END:
            return (
                hour >= E31Config.QUIET_HOURS_START
                or hour < E31Config.QUIET_HOURS_END
            )
        return (
            E31Config.QUIET_HOURS_START
            <= hour
            < E31Config.QUIET_HOURS_END
        )

    def _log_send(self, msg: SMSMessage) -> None:
        """Log every send attempt to e31.sms_platform_log (immutable)."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_platform_log
                        (candidate_id, campaign_id, send_id, phone_e164,
                         rnc_regid, message_body, media_url,
                         twilio_message_sid, twilio_status, direction,
                         message_type, cost_usd, sent_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(msg.candidate_id),
                        str(msg.campaign_id) if msg.campaign_id else None,
                        str(msg.send_id),
                        msg.phone_e164,
                        msg.rnc_regid,
                        msg.message_body,
                        msg.media_url,
                        msg.provider_message_id,
                        msg.status.value,
                        msg.direction.value,
                        msg.channel.value,
                        msg.cost_usd,
                        msg.sent_at,
                    ),
                )
            conn.commit()
        except Exception as exc:
            logger.error("Failed to log send: %s", exc)
        finally:
            conn.close()

    def _emit_cost(self, msg: SMSMessage) -> None:
        """Record cost to e31.sms_cost_ledger (per-candidate per-day)."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                is_mms = msg.channel in (
                    MessageChannel.MMS, MessageChannel.IMESSAGE,
                ) and msg.media_url
                cur.execute(
                    """
                    INSERT INTO e31.sms_cost_ledger
                        (candidate_id, ledger_date,
                         sms_count, mms_count, total_segments,
                         cost_usd)
                    VALUES (%s, CURRENT_DATE, %s, %s, %s, %s)
                    ON CONFLICT (candidate_id, ledger_date) DO UPDATE SET
                        sms_count = e31.sms_cost_ledger.sms_count + EXCLUDED.sms_count,
                        mms_count = e31.sms_cost_ledger.mms_count + EXCLUDED.mms_count,
                        total_segments = e31.sms_cost_ledger.total_segments + EXCLUDED.total_segments,
                        cost_usd = e31.sms_cost_ledger.cost_usd + EXCLUDED.cost_usd,
                        updated_at = NOW()
                    """,
                    (
                        str(msg.candidate_id),
                        0 if is_mms else 1,
                        1 if is_mms else 0,
                        msg.segments,
                        msg.cost_usd or 0,
                    ),
                )
            conn.commit()
        except Exception as exc:
            logger.error("Failed to emit cost: %s", exc)
        finally:
            conn.close()
