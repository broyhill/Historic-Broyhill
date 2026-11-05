"""E30 deliverability engine — DNS validation, IP warmup, reputation.

SPF/DKIM/DMARC validation uses dnspython for real DNS lookups (not a
stub).  IP warmup enforces a daily send cap that ramps over 30 days.
Reputation tracking monitors bounce rate, complaint rate, and inbox
placement to stay within Google/Yahoo 2024 requirements:
  - DMARC alignment required for 5K+/day senders
  - Spam complaint rate < 0.3%
  - One-click List-Unsubscribe required
  - Valid SPF + DKIM on every message
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("e30.deliverability")


# ---------------------------------------------------------------------------
# IP warmup schedule (industry standard for new IPs)
# ---------------------------------------------------------------------------

WARMUP_SCHEDULE: List[tuple[int, int]] = [
    (1,   50),
    (2,   100),
    (3,   200),
    (4,   400),
    (5,   700),
    (6,   1_000),
    (7,   1_000),
    (8,   2_000),
    (9,   3_000),
    (10,  5_000),
    (11,  7_000),
    (12,  10_000),
    (14,  10_000),
    (15,  15_000),
    (18,  20_000),
    (21,  25_000),
    (25,  35_000),
    (30,  50_000),
]


@dataclass
class WarmupState:
    """Tracks IP warmup progress."""
    start_date: date
    sends_today: int = 0
    last_reset_date: Optional[date] = None

    @property
    def days_in_use(self) -> int:
        return max(1, (date.today() - self.start_date).days + 1)

    @property
    def daily_cap(self) -> int:
        cap = 50
        for day_threshold, allowance in WARMUP_SCHEDULE:
            if self.days_in_use >= day_threshold:
                cap = allowance
        return cap

    @property
    def remaining_today(self) -> int:
        if self.last_reset_date != date.today():
            self.sends_today = 0
            self.last_reset_date = date.today()
        return max(0, self.daily_cap - self.sends_today)

    @property
    def warmup_complete(self) -> bool:
        return self.days_in_use >= 30

    def record_send(self, count: int = 1) -> bool:
        """Record sends.  Returns False if cap would be exceeded."""
        if self.last_reset_date != date.today():
            self.sends_today = 0
            self.last_reset_date = date.today()
        if self.sends_today + count > self.daily_cap:
            return False
        self.sends_today += count
        return True

    def status(self) -> Dict[str, Any]:
        return {
            "start_date": self.start_date.isoformat(),
            "days_in_use": self.days_in_use,
            "daily_cap": self.daily_cap,
            "sends_today": self.sends_today,
            "remaining_today": self.remaining_today,
            "warmup_complete": self.warmup_complete,
        }


# ---------------------------------------------------------------------------
# DNS validation (SPF/DKIM/DMARC)
# ---------------------------------------------------------------------------

@dataclass
class DNSCheckResult:
    domain: str
    spf_ok: bool = False
    spf_record: str = ""
    dkim_ok: bool = False
    dkim_record: str = ""
    dkim_selector: str = "default"
    dmarc_ok: bool = False
    dmarc_record: str = ""
    dmarc_policy: str = ""
    bimi_ok: bool = False
    bimi_record: str = ""
    all_pass: bool = False
    errors: List[str] = field(default_factory=list)
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def validate_dns(sending_domain: str, dkim_selector: str = "default") -> DNSCheckResult:
    """Real DNS validation using dnspython.  Falls back to stub if
    dnspython is not installed."""
    result = DNSCheckResult(domain=sending_domain, dkim_selector=dkim_selector)

    try:
        import dns.resolver
    except ImportError:
        logger.warning("dnspython not installed; DNS validation is a stub")
        result.errors.append("dnspython_not_installed")
        return result

    resolver = dns.resolver.Resolver()
    resolver.timeout = 5.0
    resolver.lifetime = 10.0

    # SPF: TXT record on bare domain containing "v=spf1"
    try:
        answers = resolver.resolve(sending_domain, "TXT")
        for rdata in answers:
            txt = rdata.to_text().strip('"')
            if txt.startswith("v=spf1"):
                result.spf_ok = True
                result.spf_record = txt
                break
        if not result.spf_ok:
            result.errors.append("no_spf_record")
    except Exception as exc:
        result.errors.append(f"spf_lookup_failed:{exc}")

    # DKIM: TXT at {selector}._domainkey.{domain}
    dkim_host = f"{dkim_selector}._domainkey.{sending_domain}"
    try:
        answers = resolver.resolve(dkim_host, "TXT")
        for rdata in answers:
            txt = rdata.to_text().strip('"')
            if "v=DKIM1" in txt or "k=rsa" in txt:
                result.dkim_ok = True
                result.dkim_record = txt[:200]
                break
        if not result.dkim_ok:
            result.errors.append("no_dkim_record")
    except Exception as exc:
        result.errors.append(f"dkim_lookup_failed:{exc}")

    # DMARC: TXT at _dmarc.{domain}
    dmarc_host = f"_dmarc.{sending_domain}"
    try:
        answers = resolver.resolve(dmarc_host, "TXT")
        for rdata in answers:
            txt = rdata.to_text().strip('"')
            if txt.startswith("v=DMARC1"):
                result.dmarc_ok = True
                result.dmarc_record = txt
                for part in txt.split(";"):
                    part = part.strip()
                    if part.startswith("p="):
                        result.dmarc_policy = part[2:]
                break
        if not result.dmarc_ok:
            result.errors.append("no_dmarc_record")
    except Exception as exc:
        result.errors.append(f"dmarc_lookup_failed:{exc}")

    # BIMI (optional): TXT at default._bimi.{domain}
    bimi_host = f"default._bimi.{sending_domain}"
    try:
        answers = resolver.resolve(bimi_host, "TXT")
        for rdata in answers:
            txt = rdata.to_text().strip('"')
            if "v=BIMI1" in txt:
                result.bimi_ok = True
                result.bimi_record = txt
                break
    except Exception:
        pass  # BIMI is optional

    result.all_pass = result.spf_ok and result.dkim_ok and result.dmarc_ok
    return result


# ---------------------------------------------------------------------------
# Reputation tracker
# ---------------------------------------------------------------------------

@dataclass
class ReputationSnapshot:
    """Point-in-time reputation metrics."""
    total_sent: int = 0
    total_delivered: int = 0
    total_bounced: int = 0
    total_hard_bounced: int = 0
    total_complaints: int = 0
    total_unsubscribes: int = 0
    total_opened: int = 0
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    @property
    def delivery_rate(self) -> float:
        if self.total_sent == 0:
            return 0.0
        return self.total_delivered / self.total_sent

    @property
    def bounce_rate(self) -> float:
        if self.total_sent == 0:
            return 0.0
        return self.total_bounced / self.total_sent

    @property
    def complaint_rate(self) -> float:
        if self.total_delivered == 0:
            return 0.0
        return self.total_complaints / self.total_delivered

    @property
    def open_rate(self) -> float:
        if self.total_delivered == 0:
            return 0.0
        return self.total_opened / self.total_delivered

    @property
    def health(self) -> str:
        """GREEN / YELLOW / RED based on Google/Yahoo 2024 thresholds."""
        if self.complaint_rate >= 0.003:
            return "RED"  # > 0.3% complaint rate
        if self.bounce_rate >= 0.05:
            return "RED"  # > 5% bounce rate
        if self.complaint_rate >= 0.001 or self.bounce_rate >= 0.02:
            return "YELLOW"
        return "GREEN"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_sent": self.total_sent,
            "total_delivered": self.total_delivered,
            "delivery_rate": round(self.delivery_rate, 4),
            "bounce_rate": round(self.bounce_rate, 4),
            "complaint_rate": round(self.complaint_rate, 6),
            "open_rate": round(self.open_rate, 4),
            "health": self.health,
        }


class ReputationTracker:
    """Monitors sending reputation over rolling windows."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def snapshot(self, tenant_id: Optional[str] = None,
                 days: int = 7) -> ReputationSnapshot:
        """Pull reputation metrics for the last N days."""
        if not self._pool:
            return ReputationSnapshot()
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT
                               COUNT(*)                                          AS total_sent,
                               COUNT(*) FILTER (WHERE delivered = TRUE)          AS total_delivered,
                               COUNT(*) FILTER (WHERE bounce_type IS NOT NULL)   AS total_bounced,
                               COUNT(*) FILTER (WHERE bounce_type = 'hard')      AS total_hard,
                               COUNT(*) FILTER (WHERE is_complaint = TRUE)       AS total_complaints,
                               COUNT(*) FILTER (WHERE is_unsubscribe = TRUE)     AS total_unsubs,
                               COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS total_opened
                           FROM e30.send_log
                           WHERE sent_at >= NOW() - (%s || ' days')::INTERVAL
                             AND (%s IS NULL OR tenant_id = %s)""",
                        (str(days), tenant_id, tenant_id),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if row:
                return ReputationSnapshot(
                    total_sent=row[0] or 0,
                    total_delivered=row[1] or 0,
                    total_bounced=row[2] or 0,
                    total_hard_bounced=row[3] or 0,
                    total_complaints=row[4] or 0,
                    total_unsubscribes=row[5] or 0,
                    total_opened=row[6] or 0,
                )
        except Exception as exc:
            logger.error("Reputation snapshot failed: %s", exc)
        return ReputationSnapshot()

    def should_pause(self, tenant_id: Optional[str] = None) -> bool:
        """Return True if reputation is RED and sends should be paused."""
        snap = self.snapshot(tenant_id, days=1)
        return snap.health == "RED" and snap.total_sent >= 100
