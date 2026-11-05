"""E30 centralised configuration — env-driven, zero hardcoded credentials.

Every secret comes from os.environ.  Every default is safe for development
(MockProvider, localhost DB, low warmup caps).  Production values are set
via Hetzner systemd env or .env file.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class E30Config:
    """Immutable configuration snapshot for the E30 email platform."""

    # -- Database ----------------------------------------------------------
    database_url: str = ""

    # -- Sending domain / org identity ------------------------------------
    sending_domain: str = "send.ncfirst.org"
    sender_org_name: str = "NC First LLC"
    physical_address: str = "3540 Clemmons Road, Clemmons, NC 27012"
    paid_for_by: Optional[str] = None
    not_authorized_disclaimer: bool = False

    # -- Provider credentials ---------------------------------------------
    sendgrid_api_key: str = ""
    ses_region: str = "us-east-1"
    ses_access_key_id: str = ""
    ses_secret_access_key: str = ""
    default_provider: str = "sendgrid"  # sendgrid | ses | mock   (W01 product ruling: ED_RULING_2026-08-01_W01_EMAIL_PRODUCT_SENDGRID)
    sendgrid_sandbox: bool = True        # DARK SEND: SendGrid validates + returns 200 but delivers nothing. Flip to false only on Ed's authorized live send.

    # -- Rate limiting / batching -----------------------------------------
    max_concurrent_sends: int = 50       # asyncio.Semaphore size
    batch_size: int = 100                # emails per batch
    batch_flush_interval_sec: float = 5.0
    provider_rpm_limit: int = 600        # requests per minute to ESP
    retry_max_attempts: int = 3
    retry_base_delay_sec: float = 1.0
    retry_max_delay_sec: float = 30.0

    # -- Deliverability ---------------------------------------------------
    ip_warmup_start_date: Optional[str] = None  # ISO date, e.g. 2026-07-05
    warmup_override_cap: Optional[int] = None   # force a daily cap (testing)

    # -- Consent ----------------------------------------------------------
    require_double_opt_in: bool = False

    # -- Tracking ---------------------------------------------------------
    tracking_pixel_domain: str = "t.ncfirst.org"
    link_tracking_domain: str = "l.ncfirst.org"
    unsubscribe_url_template: str = "https://bgop.email/unsubscribe/{token}"

    # -- E22 integration --------------------------------------------------
    e22_enabled: bool = True

    # -- Multi-tenant -----------------------------------------------------
    default_tenant_id: Optional[str] = None
    rls_enabled: bool = True

    @classmethod
    def from_env(cls) -> "E30Config":
        """Build config from environment variables with safe defaults."""
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            sending_domain=os.environ.get("E30_SENDING_DOMAIN", cls.sending_domain),
            sender_org_name=os.environ.get("E30_SENDER_ORG", cls.sender_org_name),
            physical_address=os.environ.get("E30_PHYSICAL_ADDRESS", cls.physical_address),
            paid_for_by=os.environ.get("E30_PAID_FOR_BY"),
            not_authorized_disclaimer=os.environ.get("E30_NOT_AUTHORIZED", "").lower() == "true",
            sendgrid_api_key=os.environ.get("SENDGRID_API_KEY", ""),
            sendgrid_sandbox=os.environ.get("E30_SENDGRID_SANDBOX", "true").lower() == "true",
            ses_region=os.environ.get("AWS_DEFAULT_REGION", cls.ses_region),
            ses_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", ""),
            ses_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
            default_provider=os.environ.get("E30_DEFAULT_PROVIDER", cls.default_provider),
            max_concurrent_sends=int(os.environ.get("E30_MAX_CONCURRENT", str(cls.max_concurrent_sends))),
            batch_size=int(os.environ.get("E30_BATCH_SIZE", str(cls.batch_size))),
            provider_rpm_limit=int(os.environ.get("E30_RPM_LIMIT", str(cls.provider_rpm_limit))),
            require_double_opt_in=os.environ.get("E30_DOUBLE_OPT_IN", "").lower() == "true",
            ip_warmup_start_date=os.environ.get("E30_WARMUP_START"),
            e22_enabled=os.environ.get("E30_E22_ENABLED", "true").lower() == "true",
            default_tenant_id=os.environ.get("E30_DEFAULT_TENANT"),
            rls_enabled=os.environ.get("E30_RLS_ENABLED", "true").lower() == "true",
        )
