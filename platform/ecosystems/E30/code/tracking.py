"""E30 webhook processor — inbound event ingestion from ESPs.

Handles SendGrid Event Webhook and SES SNS notifications:
  - delivered / deferred
  - open (with device, browser, OS, geo detection)
  - click (with link URL, position)
  - bounce (hard/soft classification -> suppression)
  - spam_report -> immediate suppression
  - unsubscribe -> immediate suppression

Every event is persisted to e30.email_events and triggers downstream
updates (engagement scores, suppression, E22 experiment tracking).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ecosystems.e30_email.contracts import (
    BounceType,
    SendStatus,
    SuppressionReason,
    WebhookEvent,
    WebhookType,
)

logger = logging.getLogger("e30.tracking")

# user-agents may not be installed
try:
    from user_agents import parse as _parse_ua
    HAS_UA_PARSER = True
except ImportError:
    HAS_UA_PARSER = False
    _parse_ua = None


# ---------------------------------------------------------------------------
# Device / browser detection
# ---------------------------------------------------------------------------

def parse_device(user_agent: Optional[str]) -> Dict[str, Optional[str]]:
    """Extract device_type, browser, os from User-Agent string."""
    if not user_agent or not HAS_UA_PARSER:
        return {"device_type": None, "browser": None, "os": None}
    try:
        ua = _parse_ua(user_agent)
        if ua.is_mobile:
            device = "mobile"
        elif ua.is_tablet:
            device = "tablet"
        elif ua.is_pc:
            device = "desktop"
        elif ua.is_bot:
            device = "bot"
        else:
            device = "unknown"
        return {
            "device_type": device,
            "browser": f"{ua.browser.family} {ua.browser.version_string}".strip(),
            "os": f"{ua.os.family} {ua.os.version_string}".strip(),
        }
    except Exception:
        return {"device_type": None, "browser": None, "os": None}


# ---------------------------------------------------------------------------
# Bounce classifier
# ---------------------------------------------------------------------------

class BounceClassifier:
    """Classify SMTP codes into hard/soft/block/complaint."""

    MAX_SOFT_RETRIES = 3

    @staticmethod
    def classify_smtp(code: Optional[int]) -> BounceType:
        if code is None:
            return BounceType.NONE
        if code >= 550:
            return BounceType.HARD
        if code >= 500:
            return BounceType.BLOCK
        if code >= 400:
            return BounceType.SOFT
        return BounceType.NONE

    @staticmethod
    def classify_sendgrid(event_type: str, reason: str = "") -> BounceType:
        if event_type == "spamreport":
            return BounceType.COMPLAINT
        reason_lower = reason.lower()
        hard_signals = ("invalid", "does not exist", "unknown user",
                        "no such user", "mailbox not found", "rejected")
        if any(s in reason_lower for s in hard_signals):
            return BounceType.HARD
        if "block" in reason_lower:
            return BounceType.BLOCK
        return BounceType.SOFT

    @classmethod
    def should_suppress(cls, bounce_type: BounceType,
                        soft_retry_count: int = 0) -> bool:
        if bounce_type in (BounceType.HARD, BounceType.COMPLAINT):
            return True
        if bounce_type == BounceType.SOFT and soft_retry_count >= cls.MAX_SOFT_RETRIES:
            return True
        return False


# ---------------------------------------------------------------------------
# SendGrid webhook parser
# ---------------------------------------------------------------------------

def parse_sendgrid_events(payload: List[Dict[str, Any]]) -> List[WebhookEvent]:
    """Parse a SendGrid Event Webhook batch into WebhookEvents."""
    events: List[WebhookEvent] = []
    type_map = {
        "delivered": WebhookType.DELIVERED,
        "open": WebhookType.OPEN,
        "click": WebhookType.CLICK,
        "bounce": WebhookType.BOUNCE,
        "dropped": WebhookType.DROPPED,
        "spamreport": WebhookType.SPAM_REPORT,
        "unsubscribe": WebhookType.UNSUBSCRIBE,
        "group_unsubscribe": WebhookType.GROUP_UNSUBSCRIBE,
        "deferred": WebhookType.DEFERRED,
    }
    for item in payload:
        event_type_str = item.get("event", "").lower()
        wtype = type_map.get(event_type_str)
        if not wtype:
            continue

        ts = None
        if "timestamp" in item:
            try:
                ts = datetime.fromtimestamp(int(item["timestamp"]), tz=timezone.utc)
            except (ValueError, TypeError):
                pass

        ua_str = item.get("useragent")
        device_info = parse_device(ua_str)

        bounce_type = BounceType.NONE
        if wtype in (WebhookType.BOUNCE, WebhookType.DROPPED, WebhookType.SPAM_REPORT):
            bounce_type = BounceClassifier.classify_sendgrid(
                event_type_str, item.get("reason", ""),
            )

        events.append(WebhookEvent(
            event_type=wtype,
            send_id=item.get("send_id", item.get("sg_message_id", "")),
            recipient_email=item.get("email", ""),
            provider_message_id=item.get("sg_message_id", ""),
            timestamp=ts,
            ip_address=item.get("ip"),
            user_agent=ua_str,
            device_type=device_info["device_type"],
            browser=device_info["browser"],
            os_name=device_info["os"],
            link_url=item.get("url"),
            bounce_type=bounce_type,
            bounce_reason=item.get("reason"),
            smtp_code=_safe_int(item.get("status")),
            raw_payload=item,
        ))
    return events


# ---------------------------------------------------------------------------
# SES SNS notification parser
# ---------------------------------------------------------------------------

def parse_ses_notification(payload: Dict[str, Any]) -> List[WebhookEvent]:
    """Parse an SES SNS notification into WebhookEvents."""
    events: List[WebhookEvent] = []
    notif_type = payload.get("notificationType", payload.get("eventType", "")).lower()

    type_map = {
        "delivery": WebhookType.DELIVERED,
        "bounce": WebhookType.BOUNCE,
        "complaint": WebhookType.SPAM_REPORT,
        "open": WebhookType.OPEN,
        "click": WebhookType.CLICK,
    }
    wtype = type_map.get(notif_type)
    if not wtype:
        return events

    mail = payload.get("mail", {})
    msg_id = mail.get("messageId", "")
    recipients = mail.get("destination", [])

    if notif_type == "bounce":
        bounce_obj = payload.get("bounce", {})
        bt = BounceType.HARD if bounce_obj.get("bounceType") == "Permanent" else BounceType.SOFT
        for rcpt in bounce_obj.get("bouncedRecipients", []):
            events.append(WebhookEvent(
                event_type=wtype,
                recipient_email=rcpt.get("emailAddress", ""),
                provider_message_id=msg_id,
                bounce_type=bt,
                bounce_reason=rcpt.get("diagnosticCode"),
                smtp_code=_safe_int(rcpt.get("status")),
                raw_payload=payload,
            ))
    elif notif_type == "complaint":
        complaint_obj = payload.get("complaint", {})
        for rcpt in complaint_obj.get("complainedRecipients", []):
            events.append(WebhookEvent(
                event_type=wtype,
                recipient_email=rcpt.get("emailAddress", ""),
                provider_message_id=msg_id,
                bounce_type=BounceType.COMPLAINT,
                raw_payload=payload,
            ))
    else:
        for email in recipients:
            events.append(WebhookEvent(
                event_type=wtype,
                recipient_email=email,
                provider_message_id=msg_id,
                raw_payload=payload,
            ))
    return events


# ---------------------------------------------------------------------------
# Event processor
# ---------------------------------------------------------------------------

class WebhookProcessor:
    """Process webhook events: persist, update engagement, manage suppression."""

    def __init__(self, db_pool: Any = None, suppression_gate: Any = None):
        self._pool = db_pool
        self._suppression = suppression_gate

    def process(self, events: List[WebhookEvent]) -> Dict[str, int]:
        """Process a batch of webhook events.  Returns count by type."""
        counts: Dict[str, int] = {}
        for event in events:
            key = event.event_type.value
            counts[key] = counts.get(key, 0) + 1

            self._persist_event(event)

            if event.event_type == WebhookType.OPEN:
                self._handle_open(event)
            elif event.event_type == WebhookType.CLICK:
                self._handle_click(event)
            elif event.event_type in (WebhookType.BOUNCE, WebhookType.DROPPED):
                self._handle_bounce(event)
            elif event.event_type in (WebhookType.SPAM_REPORT,
                                       WebhookType.UNSUBSCRIBE,
                                       WebhookType.GROUP_UNSUBSCRIBE):
                self._handle_suppression(event)

        logger.info("Processed %d webhook events: %s", len(events), counts)
        return counts

    def _persist_event(self, event: WebhookEvent) -> None:
        if not self._pool:
            return
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO e30.email_events
                           (event_type, send_id, recipient_email,
                            provider_message_id, event_timestamp,
                            ip_address, user_agent, device_type,
                            browser, os_name, geo_city, geo_state,
                            geo_country, link_url, bounce_type,
                            bounce_reason, smtp_code, raw_payload)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (
                            event.event_type.value,
                            event.send_id,
                            event.recipient_email,
                            event.provider_message_id,
                            event.timestamp,
                            event.ip_address,
                            event.user_agent,
                            event.device_type,
                            event.browser,
                            event.os_name,
                            event.geo_city,
                            event.geo_state,
                            event.geo_country,
                            event.link_url,
                            event.bounce_type.value if event.bounce_type != BounceType.NONE else None,
                            event.bounce_reason,
                            event.smtp_code,
                            json.dumps(event.raw_payload),
                        ),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
        except Exception as exc:
            logger.error("Event persist failed: %s", exc)

    def _handle_open(self, event: WebhookEvent) -> None:
        if not self._pool:
            return
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE e30.send_log SET
                               first_opened_at = COALESCE(first_opened_at, %s),
                               last_opened_at = %s,
                               open_count = COALESCE(open_count, 0) + 1,
                               device_type = COALESCE(device_type, %s),
                               browser = COALESCE(browser, %s),
                               os_name = COALESCE(os_name, %s)
                           WHERE send_id = %s OR provider_message_id = %s""",
                        (
                            event.timestamp, event.timestamp,
                            event.device_type, event.browser, event.os_name,
                            event.send_id, event.provider_message_id,
                        ),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
        except Exception as exc:
            logger.error("Open update failed: %s", exc)

    def _handle_click(self, event: WebhookEvent) -> None:
        if not self._pool:
            return
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE e30.send_log SET
                               first_clicked_at = COALESCE(first_clicked_at, %s),
                               last_clicked_at = %s,
                               click_count = COALESCE(click_count, 0) + 1
                           WHERE send_id = %s OR provider_message_id = %s""",
                        (event.timestamp, event.timestamp,
                         event.send_id, event.provider_message_id),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
        except Exception as exc:
            logger.error("Click update failed: %s", exc)

    def _handle_bounce(self, event: WebhookEvent) -> None:
        if BounceClassifier.should_suppress(event.bounce_type):
            reason = (SuppressionReason.HARD_BOUNCE
                      if event.bounce_type == BounceType.HARD
                      else SuppressionReason.HARD_BOUNCE)
            if self._suppression:
                self._suppression.add(
                    event.recipient_email, reason,
                    source_send_id=event.send_id,
                )

    def _handle_suppression(self, event: WebhookEvent) -> None:
        if not self._suppression:
            return
        if event.event_type == WebhookType.SPAM_REPORT:
            reason = SuppressionReason.COMPLAINT
        else:
            reason = SuppressionReason.UNSUBSCRIBE
        self._suppression.add(
            event.recipient_email, reason,
            source_send_id=event.send_id,
        )


def _safe_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(str(val).split(".")[0])
    except (ValueError, TypeError):
        return None
