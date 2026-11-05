"""E30 email provider adapters — SendGrid, SES, Mock.

Each provider implements the same interface: send_one() returns a
ProviderResult.  Rate limiting, retry with exponential backoff, and
circuit-breaking are handled here so the pipeline layer doesn't need
to know which ESP is underneath.
"""

from __future__ import annotations

import logging
import time
import uuid
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Dict, Optional

logger = logging.getLogger("e30.providers")


# ---------------------------------------------------------------------------
# Provider result
# ---------------------------------------------------------------------------

@dataclass
class ProviderResult:
    """Standardised result from any ESP."""
    success: bool
    message_id: str = ""
    status_code: int = 0
    error: Optional[str] = None
    cost_cents: int = 12  # per-email cost, provider-specific
    retryable: bool = False
    raw: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Sliding-window rate limiter
# ---------------------------------------------------------------------------

class _SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter (requests per minute)."""

    def __init__(self, rpm: int):
        self._rpm = max(1, rpm)
        self._window: deque[float] = deque()
        self._lock = Lock()

    def acquire(self) -> float:
        """Block until a slot is available.  Returns seconds waited."""
        waited = 0.0
        while True:
            with self._lock:
                now = time.monotonic()
                while self._window and self._window[0] <= now - 60.0:
                    self._window.popleft()
                if len(self._window) < self._rpm:
                    self._window.append(now)
                    return waited
                sleep_for = self._window[0] + 60.0 - now
            time.sleep(sleep_for)
            waited += sleep_for


# ---------------------------------------------------------------------------
# Abstract provider
# ---------------------------------------------------------------------------

class EmailProvider(ABC):
    """Base class for all email service providers."""

    def __init__(self, rpm_limit: int = 600):
        self._limiter = _SlidingWindowRateLimiter(rpm_limit)

    @abstractmethod
    def _do_send(self, to_email: str, from_email: str, from_name: str,
                 subject: str, html_body: str, text_body: str,
                 reply_to: Optional[str] = None,
                 headers: Optional[Dict[str, str]] = None,
                 tags: Optional[Dict[str, str]] = None) -> ProviderResult:
        ...

    def send_one(self, to_email: str, from_email: str, from_name: str,
                 subject: str, html_body: str, text_body: str,
                 reply_to: Optional[str] = None,
                 headers: Optional[Dict[str, str]] = None,
                 tags: Optional[Dict[str, str]] = None,
                 max_retries: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 30.0) -> ProviderResult:
        """Send with rate limiting + exponential backoff retry."""
        attempt = 0
        last_result: Optional[ProviderResult] = None
        while attempt <= max_retries:
            self._limiter.acquire()
            result = self._do_send(
                to_email, from_email, from_name,
                subject, html_body, text_body,
                reply_to=reply_to, headers=headers, tags=tags,
            )
            if result.success:
                return result
            last_result = result
            if not result.retryable:
                return result
            attempt += 1
            if attempt <= max_retries:
                delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                logger.warning(
                    "E30 provider retry %d/%d for %s (delay=%.1fs): %s",
                    attempt, max_retries, to_email, delay, result.error,
                )
                time.sleep(delay)
        return last_result or ProviderResult(success=False, error="max_retries_exceeded")


# ---------------------------------------------------------------------------
# SendGrid
# ---------------------------------------------------------------------------

class SendGridProvider(EmailProvider):
    """SendGrid v3 Mail Send API."""

    def __init__(self, api_key: str, rpm_limit: int = 600, sandbox: bool = True):
        super().__init__(rpm_limit)
        self._api_key = api_key
        self._sandbox = sandbox          # SendGrid mail_settings.sandbox_mode: full API round-trip, zero delivery
        self._sg = None
        try:
            import sendgrid
            self._sg = sendgrid.SendGridAPIClient(api_key=api_key)
        except ImportError:
            logger.warning("sendgrid package not installed; provider will fail at send time")

    def _do_send(self, to_email: str, from_email: str, from_name: str,
                 subject: str, html_body: str, text_body: str,
                 reply_to: Optional[str] = None,
                 headers: Optional[Dict[str, str]] = None,
                 tags: Optional[Dict[str, str]] = None) -> ProviderResult:
        if not self._sg:
            return ProviderResult(success=False, error="sendgrid not installed", retryable=False)
        try:
            from sendgrid.helpers.mail import (
                Mail, Email, To, Content, Header, Category,
            )
            message = Mail(
                from_email=Email(from_email, from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_body),
                plain_text_content=Content("text/plain", text_body or " "),
            )
            if reply_to:
                message.reply_to = Email(reply_to)
            if headers:
                for k, v in headers.items():
                    message.header = Header(k, v)
            # List-Unsubscribe header (Google/Yahoo 2024 requirement)
            message.header = Header(
                "List-Unsubscribe",
                f"<mailto:unsubscribe@{from_email.split('@')[-1]}?subject=unsubscribe>",
            )
            message.header = Header("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
            if tags:
                for tag_val in list(tags.values())[:10]:
                    message.category = Category(tag_val)
            if self._sandbox:
                from sendgrid.helpers.mail import MailSettings, SandBoxMode
                ms = MailSettings(); ms.sandbox_mode = SandBoxMode(True); message.mail_settings = ms

            response = self._sg.send(message)
            success = response.status_code in (200, 201, 202)
            msg_id = ""
            if hasattr(response, "headers"):
                msg_id = response.headers.get("X-Message-Id", "")
            return ProviderResult(
                success=success,
                message_id=msg_id or ("sandbox" if self._sandbox else ""),
                status_code=response.status_code,
                cost_cents=0 if self._sandbox else 12,
                retryable=response.status_code in (429, 500, 502, 503),
            )
        except Exception as exc:
            return ProviderResult(
                success=False,
                error=str(exc),
                retryable=True,
            )


# ---------------------------------------------------------------------------
# Amazon SES (v2)
# ---------------------------------------------------------------------------

class SESProvider(EmailProvider):
    """Amazon SES v2 via boto3."""

    def __init__(self, region: str = "us-east-1",
                 access_key_id: str = "", secret_access_key: str = "",
                 rpm_limit: int = 600):
        super().__init__(rpm_limit)
        self._client = None
        try:
            import boto3
            kwargs: Dict[str, Any] = {"region_name": region}
            if access_key_id and secret_access_key:
                kwargs["aws_access_key_id"] = access_key_id
                kwargs["aws_secret_access_key"] = secret_access_key
            self._client = boto3.client("sesv2", **kwargs)
        except ImportError:
            logger.warning("boto3 not installed; SES provider will fail at send time")

    def _do_send(self, to_email: str, from_email: str, from_name: str,
                 subject: str, html_body: str, text_body: str,
                 reply_to: Optional[str] = None,
                 headers: Optional[Dict[str, str]] = None,
                 tags: Optional[Dict[str, str]] = None) -> ProviderResult:
        if not self._client:
            return ProviderResult(success=False, error="boto3 not installed", retryable=False)
        try:
            from_addr = f"{from_name} <{from_email}>" if from_name else from_email
            body: Dict[str, Any] = {
                "Html": {"Data": html_body, "Charset": "UTF-8"},
            }
            if text_body:
                body["Text"] = {"Data": text_body, "Charset": "UTF-8"}
            kwargs: Dict[str, Any] = {
                "FromEmailAddress": from_addr,
                "Destination": {"ToAddresses": [to_email]},
                "Content": {
                    "Simple": {
                        "Subject": {"Data": subject, "Charset": "UTF-8"},
                        "Body": body,
                        "Headers": [
                            {"Name": "List-Unsubscribe",
                             "Value": f"<mailto:unsubscribe@{from_email.split('@')[-1]}?subject=unsubscribe>"},
                            {"Name": "List-Unsubscribe-Post",
                             "Value": "List-Unsubscribe=One-Click"},
                        ],
                    }
                },
            }
            if reply_to:
                kwargs["ReplyToAddresses"] = [reply_to]
            if tags:
                kwargs["EmailTags"] = [{"Name": k, "Value": v} for k, v in tags.items()]

            resp = self._client.send_email(**kwargs)
            msg_id = resp.get("MessageId", "")
            return ProviderResult(
                success=True,
                message_id=msg_id,
                status_code=200,
                cost_cents=10,  # SES is cheaper
                raw=resp,
            )
        except Exception as exc:
            err_str = str(exc)
            retryable = any(s in err_str for s in ("Throttling", "ServiceUnavailable", "TooManyRequests"))
            return ProviderResult(success=False, error=err_str, retryable=retryable)


# ---------------------------------------------------------------------------
# Mock (development / testing)
# ---------------------------------------------------------------------------

class MockProvider(EmailProvider):
    """Deterministic mock for tests. Always succeeds."""

    def __init__(self, rpm_limit: int = 999_999):
        super().__init__(rpm_limit)
        self.sent: list[Dict[str, Any]] = []

    def _do_send(self, to_email: str, from_email: str, from_name: str,
                 subject: str, html_body: str, text_body: str,
                 reply_to: Optional[str] = None,
                 headers: Optional[Dict[str, str]] = None,
                 tags: Optional[Dict[str, str]] = None) -> ProviderResult:
        msg_id = f"mock_{uuid.uuid4().hex[:12]}"
        self.sent.append({
            "to": to_email, "from": from_email, "subject": subject,
            "message_id": msg_id,
        })
        return ProviderResult(success=True, message_id=msg_id, status_code=202, cost_cents=0)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_provider(name: str, **kwargs: Any) -> EmailProvider:
    """Factory: create a provider by name."""
    providers = {
        "sendgrid": lambda: SendGridProvider(
            api_key=kwargs.get("api_key", ""),
            rpm_limit=kwargs.get("rpm_limit", 600),
        ),
        "ses": lambda: SESProvider(
            region=kwargs.get("region", "us-east-1"),
            access_key_id=kwargs.get("access_key_id", ""),
            secret_access_key=kwargs.get("secret_access_key", ""),
            rpm_limit=kwargs.get("rpm_limit", 600),
        ),
        "mock": lambda: MockProvider(rpm_limit=kwargs.get("rpm_limit", 999_999)),
    }
    factory = providers.get(name.lower())
    if not factory:
        raise ValueError(f"Unknown provider '{name}'. Choose from: {list(providers.keys())}")
    return factory()
