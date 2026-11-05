"""
E31 Providers — Twilio, Sinch, Bandwidth, Sendblue adapters.

Each provider implements send_sms(), send_mms(), get_status(), and
check_phone_capability(). Sendblue adds iMessage-specific: send_imessage(),
check_imessage_capability(), send_vcard(), send_reaction().

Provider selection: SendEngine auto-routes based on recipient capability.
iMessage-capable → Sendblue. Everyone else → Twilio (primary), Sinch/Bandwidth (failover).
"""

import hashlib
import hmac
import json
import logging
import math
import time
from datetime import datetime
from typing import Optional
from uuid import UUID

import requests

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.entities import (
    MessageChannel, MessageStatus, SendResult,
)

logger = logging.getLogger("e31.providers")


# ── Base Provider ─────────────────────────────────────────────────────

class BaseProvider:
    """Abstract base for all messaging providers."""

    name: str = "base"

    def send_sms(
        self,
        to: str,
        body: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        raise NotImplementedError

    def send_mms(
        self,
        to: str,
        body: str,
        media_url: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        raise NotImplementedError

    def get_status(self, message_id: str) -> dict:
        raise NotImplementedError

    def check_phone_capability(self, phone: str) -> dict:
        """Return line_type, carrier, is_valid, is_mobile."""
        raise NotImplementedError

    @staticmethod
    def _segment_count(body: str) -> int:
        """Calculate SMS segment count (GSM-7 vs UCS-2)."""
        gsm7 = all(
            c in (
                "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ"
                " !\"#¤%&'()*+,-./0123456789:;<=>?"
                "¡ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                "ÄÖÑÜabcdefghijklmnopqrstuvwxyz"
                "äöñüà^{}\\[~]|€"
            )
            for c in body
        )
        if gsm7:
            return 1 if len(body) <= 160 else math.ceil(len(body) / 153)
        return 1 if len(body) <= 70 else math.ceil(len(body) / 67)


# ── Twilio Provider ───────────────────────────────────────────────────

class TwilioProvider(BaseProvider):
    """Twilio SMS/MMS provider — primary carrier for non-iMessage."""

    name = "twilio"

    def __init__(self) -> None:
        self.test_mode = E31Config.TWILIO_TEST_MODE
        if self.test_mode:                                   # dark: Twilio test creds + magic From, nothing reaches a carrier
            self.account_sid = E31Config.TWILIO_TEST_ACCOUNT_SID
            self.auth_token = E31Config.TWILIO_TEST_AUTH_TOKEN
        else:
            self.account_sid = E31Config.TWILIO_ACCOUNT_SID
            self.auth_token = E31Config.TWILIO_AUTH_TOKEN
        self.base_url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"
        )

    def _from(self, from_number: str) -> Dict[str, str]:
        """Live sends go through the 10DLC Messaging Service when one is configured (carrier-registered sender pool)."""
        if self.test_mode:
            return {"From": E31Config.TWILIO_MAGIC_FROM}
        if E31Config.TWILIO_MESSAGING_SERVICE_SID:
            return {"MessagingServiceSid": E31Config.TWILIO_MESSAGING_SERVICE_SID}
        return {"From": from_number}

    def send_sms(
        self,
        to: str,
        body: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        segments = self._segment_count(body)
        payload = {"To": to, "Body": body, **self._from(from_number)}
        if callback_url:
            payload["StatusCallback"] = callback_url
        try:
            resp = requests.post(
                f"{self.base_url}/Messages.json",
                data=payload,
                auth=(self.account_sid, self.auth_token),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("sid"),
                status=data.get("status", "queued"),
                segments=segments,
                cost_usd=0.0 if self.test_mode else segments * E31Config.COST_PER_SMS_SEGMENT,
            )
        except requests.RequestException as exc:
            logger.error("Twilio send failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_mms(
        self,
        to: str,
        body: str,
        media_url: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        payload = {
            "To": to,
            "Body": body,
            "MediaUrl": media_url,
            **self._from(from_number),
        }
        if callback_url:
            payload["StatusCallback"] = callback_url
        try:
            resp = requests.post(
                f"{self.base_url}/Messages.json",
                data=payload,
                auth=(self.account_sid, self.auth_token),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("sid"),
                status=data.get("status", "queued"),
                segments=1,
                cost_usd=E31Config.COST_PER_MMS,
            )
        except requests.RequestException as exc:
            logger.error("Twilio MMS failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def get_status(self, message_id: str) -> dict:
        try:
            resp = requests.get(
                f"{self.base_url}/Messages/{message_id}.json",
                auth=(self.account_sid, self.auth_token),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": data.get("status"),
                "error_code": data.get("error_code"),
                "error_message": data.get("error_message"),
                "date_sent": data.get("date_sent"),
                "price": data.get("price"),
                "num_segments": data.get("num_segments"),
            }
        except requests.RequestException as exc:
            return {"status": "unknown", "error": str(exc)}

    def check_phone_capability(self, phone: str) -> dict:
        try:
            resp = requests.get(
                f"https://lookups.twilio.com/v2/PhoneNumbers/{phone}",
                params={"Fields": "line_type_intelligence,caller_name"},
                auth=(self.account_sid, self.auth_token),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            line_info = data.get("line_type_intelligence", {})
            return {
                "is_valid": data.get("valid", False),
                "line_type": line_info.get("type", "unknown"),
                "carrier": line_info.get("carrier_name", ""),
                "is_mobile": line_info.get("type") == "mobile",
                "caller_name": (
                    data.get("caller_name", {}).get("caller_name", "")
                ),
            }
        except requests.RequestException:
            return {
                "is_valid": None,
                "line_type": "unknown",
                "carrier": "",
                "is_mobile": None,
            }


# ── Sinch Provider ────────────────────────────────────────────────────

class SinchProvider(BaseProvider):
    """Sinch SMS provider — secondary failover."""

    name = "sinch"

    def __init__(self) -> None:
        self.service_plan_id = E31Config.SINCH_SERVICE_PLAN_ID
        self.api_token = E31Config.SINCH_APP_SECRET
        self.base_url = (
            f"https://us.sms.api.sinch.com/xms/v1/{self.service_plan_id}"
        )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def send_sms(
        self,
        to: str,
        body: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        segments = self._segment_count(body)
        payload = {
            "from": from_number,
            "to": [to],
            "body": body,
        }
        if callback_url:
            payload["callback_url"] = callback_url
        try:
            resp = requests.post(
                f"{self.base_url}/batches",
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("id"),
                status="queued",
                segments=segments,
                cost_usd=segments * E31Config.COST_PER_SMS_SEGMENT,
            )
        except requests.RequestException as exc:
            logger.error("Sinch send failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_mms(
        self,
        to: str,
        body: str,
        media_url: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        payload = {
            "from": from_number,
            "to": [to],
            "body": {"type": "mt_media", "url": media_url, "message": body},
        }
        try:
            resp = requests.post(
                f"{self.base_url}/batches",
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("id"),
                status="queued",
                segments=1,
                cost_usd=E31Config.COST_PER_MMS,
            )
        except requests.RequestException as exc:
            logger.error("Sinch MMS failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def get_status(self, message_id: str) -> dict:
        try:
            resp = requests.get(
                f"{self.base_url}/batches/{message_id}",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            return {"status": "unknown", "error": str(exc)}

    def check_phone_capability(self, phone: str) -> dict:
        return {
            "is_valid": None,
            "line_type": "unknown",
            "carrier": "",
            "is_mobile": None,
        }


# ── Bandwidth Provider ───────────────────────────────────────────────

class BandwidthProvider(BaseProvider):
    """Bandwidth SMS/MMS provider — tertiary failover."""

    name = "bandwidth"

    def __init__(self) -> None:
        self.account_id = E31Config.BANDWIDTH_ACCOUNT_ID
        self.api_token = E31Config.BANDWIDTH_API_TOKEN
        self.application_id = E31Config.BANDWIDTH_APPLICATION_ID
        self.base_url = (
            f"https://messaging.bandwidth.com/api/v2/users/"
            f"{self.account_id}/messages"
        )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Basic {self.api_token}",
            "Content-Type": "application/json",
        }

    def send_sms(
        self,
        to: str,
        body: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        segments = self._segment_count(body)
        payload = {
            "to": [to],
            "from": from_number,
            "text": body,
            "applicationId": self.application_id,
        }
        try:
            resp = requests.post(
                self.base_url,
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("id"),
                status="queued",
                segments=segments,
                cost_usd=segments * E31Config.COST_PER_SMS_SEGMENT,
            )
        except requests.RequestException as exc:
            logger.error("Bandwidth send failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_mms(
        self,
        to: str,
        body: str,
        media_url: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        payload = {
            "to": [to],
            "from": from_number,
            "text": body,
            "media": [media_url],
            "applicationId": self.application_id,
        }
        try:
            resp = requests.post(
                self.base_url,
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("id"),
                status="queued",
                segments=1,
                cost_usd=E31Config.COST_PER_MMS,
            )
        except requests.RequestException as exc:
            logger.error("Bandwidth MMS failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def get_status(self, message_id: str) -> dict:
        try:
            resp = requests.get(
                f"{self.base_url}/{message_id}",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            return {"status": "unknown", "error": str(exc)}

    def check_phone_capability(self, phone: str) -> dict:
        return {
            "is_valid": None,
            "line_type": "unknown",
            "carrier": "",
            "is_mobile": None,
        }


# ── Sendblue Provider (iMessage) ─────────────────────────────────────

class SendblueProvider(BaseProvider):
    """Sendblue iMessage provider — blue bubbles, read receipts, reactions.

    Auto-detects iMessage capability. Falls back to SMS/RCS if recipient
    doesn't have iMessage. Unique features: vCard delivery, typing
    indicators, tapback reactions, FaceTime Audio.
    """

    name = "sendblue"
    API_BASE = "https://api.sendblue.co/api"

    def __init__(self) -> None:
        self.api_key = E31Config.SENDBLUE_API_KEY
        self.api_secret = E31Config.SENDBLUE_API_SECRET

    def _headers(self) -> dict:
        return {
            "sb-api-key-id": self.api_key,
            "sb-api-secret-key": self.api_secret,
            "Content-Type": "application/json",
        }

    def send_sms(
        self,
        to: str,
        body: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        """Send via Sendblue — auto-detects iMessage, falls back to SMS."""
        return self.send_imessage(to, body, callback_url=callback_url)

    def send_imessage(
        self,
        to: str,
        body: str,
        media_url: Optional[str] = None,
        send_style: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        """Send iMessage with optional media, effects, and status callback.

        send_style: 'slam', 'loud', 'gentle', 'invisible_ink', or None.
        """
        payload = {"number": to, "content": body}
        if media_url:
            payload["media_url"] = media_url
        if send_style:
            payload["send_style"] = send_style
        if callback_url:
            payload["status_callback"] = callback_url
        try:
            resp = requests.post(
                f"{self.API_BASE}/send-message",
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("message_id", data.get("id")),
                status=data.get("status", "queued"),
                segments=1,
                cost_usd=E31Config.COST_PER_IMESSAGE,
            )
        except requests.RequestException as exc:
            logger.error("Sendblue send failed: %s", exc)
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_mms(
        self,
        to: str,
        body: str,
        media_url: str,
        from_number: str,
        callback_url: Optional[str] = None,
    ) -> SendResult:
        """MMS via Sendblue — full-res media, no carrier compression."""
        return self.send_imessage(
            to, body, media_url=media_url, callback_url=callback_url,
        )

    def send_vcard(self, to: str, vcard_url: str) -> SendResult:
        """Send a contact card (vCard) — recipient can save with one tap."""
        payload = {"number": to, "media_url": vcard_url}
        try:
            resp = requests.post(
                f"{self.API_BASE}/send-message",
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return SendResult(
                success=True,
                provider=self.name,
                message_id=data.get("message_id"),
                status="sent",
            )
        except requests.RequestException as exc:
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_reaction(
        self, to: str, reaction: str, message_id: str,
    ) -> SendResult:
        """Send a tapback reaction (heart, thumbs_up, etc.) on a message."""
        payload = {
            "number": to,
            "reaction": reaction,
            "message_id": message_id,
        }
        try:
            resp = requests.post(
                f"{self.API_BASE}/send-reaction",
                json=payload,
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return SendResult(success=True, provider=self.name, status="sent")
        except requests.RequestException as exc:
            return SendResult(
                success=False, provider=self.name, error=str(exc),
            )

    def send_typing_indicator(self, to: str) -> bool:
        """Show typing indicator (three dots) in recipient's Messages app."""
        try:
            resp = requests.post(
                f"{self.API_BASE}/send-typing-indicator",
                json={"number": to},
                headers=self._headers(),
                timeout=10,
            )
            return resp.ok
        except requests.RequestException:
            return False

    def check_imessage_capability(self, phone: str) -> dict:
        """Check if a phone number has iMessage enabled."""
        try:
            resp = requests.get(
                f"{self.API_BASE}/evaluate-service",
                params={"number": phone},
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "is_imessage": data.get("is_imessage", False),
                "phone": phone,
            }
        except requests.RequestException:
            return {"is_imessage": False, "phone": phone}

    def check_phone_capability(self, phone: str) -> dict:
        result = self.check_imessage_capability(phone)
        return {
            "is_valid": True,
            "line_type": "mobile" if result["is_imessage"] else "unknown",
            "carrier": "",
            "is_mobile": True if result["is_imessage"] else None,
            "is_imessage": result["is_imessage"],
        }

    def get_status(self, message_id: str) -> dict:
        try:
            resp = requests.get(
                f"{self.API_BASE}/message-status",
                params={"message_id": message_id},
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": data.get("status"),
                "is_read": data.get("is_read", False),
                "read_at": data.get("read_at"),
                "delivered_at": data.get("delivered_at"),
                "error": data.get("error_message"),
            }
        except requests.RequestException as exc:
            return {"status": "unknown", "error": str(exc)}

    def get_messages(
        self, phone: Optional[str] = None, limit: int = 50,
    ) -> list:
        """Retrieve message history, optionally filtered by phone."""
        params = {"limit": limit}
        if phone:
            params["number"] = phone
        try:
            resp = requests.get(
                f"{self.API_BASE}/messages",
                params=params,
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get("messages", [])
        except requests.RequestException:
            return []


# ── Provider Registry ─────────────────────────────────────────────────

PROVIDER_MAP = {
    "twilio": TwilioProvider,
    "sinch": SinchProvider,
    "bandwidth": BandwidthProvider,
    "sendblue": SendblueProvider,
}


def get_provider(name: str) -> BaseProvider:
    """Instantiate a provider by name."""
    cls = PROVIDER_MAP.get(name)
    if not cls:
        raise ValueError(f"Unknown provider: {name}")
    return cls()


def get_configured_providers() -> list:
    """Return list of provider names that have credentials configured."""
    configured = []
    checks = {
        "sendblue": E31Config.is_sendblue_configured,
        "twilio": E31Config.is_twilio_configured,
        "sinch": E31Config.is_sinch_configured,
        "bandwidth": E31Config.is_bandwidth_configured,
    }
    for name in E31Config.PROVIDER_PRIORITY:
        if name in checks and checks[name]():
            configured.append(name)
    return configured
