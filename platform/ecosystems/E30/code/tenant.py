"""E30 multi-tenant isolation — per-candidate sending domains + RLS.

Each candidate campaign is a tenant with:
  - Isolated sending domain (candidate1.ncfirst.org)
  - Independent suppression list
  - Independent consent ledger
  - Per-tenant rate limits (monthly email cap, daily cap)
  - Per-tenant from name/email
  - Feature flags (AI generation, advanced analytics, etc.)

Row Level Security (RLS) is enforced at the database level via
SET LOCAL app.current_tenant_id = '{tenant_id}' on every connection, and
SET LOCAL app.current_candidate_id = '{candidate_id}' for candidate-scoped
e30.* tables (CR-E30-000). A connection without candidate context sees no
candidate-scoped rows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("e30.tenant")


# ---------------------------------------------------------------------------
# Tenant definition
# ---------------------------------------------------------------------------

@dataclass
class Tenant:
    """A campaign tenant (candidate, PAC, committee)."""
    tenant_id: Optional[str] = None
    campaign_name: str = ""
    candidate_name: str = ""
    candidate_id: Optional[str] = None
    campaign_type: str = "candidate"  # candidate, pac, committee, party
    jurisdiction: str = ""  # NC-01, Wake County, NC Senate 14

    # Sending identity
    sending_domain: str = ""
    from_email: str = ""
    from_name: str = ""
    reply_to_email: str = ""
    physical_address: str = ""
    paid_for_by: Optional[str] = None

    # Limits
    monthly_email_limit: int = 50_000
    emails_sent_this_month: int = 0
    daily_email_limit: int = 5_000

    # Features
    features: Dict[str, bool] = field(default_factory=lambda: {
        "ai_generation": True,
        "advanced_analytics": True,
        "drip_sequences": True,
        "ab_testing": True,
        "send_time_optimization": True,
    })

    # Status
    status: str = "active"  # active, suspended, closed

    @property
    def remaining_monthly(self) -> int:
        return max(0, self.monthly_email_limit - self.emails_sent_this_month)

    @property
    def can_send(self) -> bool:
        return self.status == "active" and self.remaining_monthly > 0


# ---------------------------------------------------------------------------
# Tenant manager
# ---------------------------------------------------------------------------

class TenantManager:
    """CRUD + limit enforcement for tenants."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def get(self, tenant_id: str) -> Optional[Tenant]:
        """Load a tenant by ID."""
        if not self._pool:
            return None
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT tenant_id, campaign_name, candidate_name,
                                  candidate_id, campaign_type, jurisdiction,
                                  sending_domain, from_email, from_name,
                                  reply_to_email, physical_address, paid_for_by,
                                  monthly_email_limit, emails_sent_this_month,
                                  daily_email_limit, features, status
                           FROM e30.tenants WHERE tenant_id = %s""",
                        (tenant_id,),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if not row:
                return None
            return Tenant(
                tenant_id=str(row[0]),
                campaign_name=row[1] or "",
                candidate_name=row[2] or "",
                candidate_id=row[3],
                campaign_type=row[4] or "candidate",
                jurisdiction=row[5] or "",
                sending_domain=row[6] or "",
                from_email=row[7] or "",
                from_name=row[8] or "",
                reply_to_email=row[9] or "",
                physical_address=row[10] or "",
                paid_for_by=row[11],
                monthly_email_limit=row[12] or 50_000,
                emails_sent_this_month=row[13] or 0,
                daily_email_limit=row[14] or 5_000,
                features=row[15] or {},
                status=row[16] or "active",
            )
        except Exception as exc:
            logger.error("Tenant get failed: %s", exc)
            return None

    def check_limits(self, tenant_id: str) -> Dict[str, Any]:
        """Check if tenant can send more emails."""
        tenant = self.get(tenant_id)
        if not tenant:
            return {"can_send": False, "reason": "tenant_not_found"}
        if tenant.status != "active":
            return {"can_send": False, "reason": f"tenant_{tenant.status}"}
        if tenant.remaining_monthly <= 0:
            return {"can_send": False, "reason": "monthly_limit_reached",
                    "limit": tenant.monthly_email_limit}
        return {
            "can_send": True,
            "remaining_monthly": tenant.remaining_monthly,
            "monthly_limit": tenant.monthly_email_limit,
        }

    def increment_sent(self, tenant_id: str, count: int = 1) -> bool:
        """Increment the monthly send counter."""
        if not self._pool:
            return False
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE e30.tenants SET
                               emails_sent_this_month = emails_sent_this_month + %s,
                               updated_at = NOW()
                           WHERE tenant_id = %s""",
                        (count, tenant_id),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return True
        except Exception as exc:
            logger.error("Tenant increment failed: %s", exc)
            return False

    def reset_monthly_counters(self) -> int:
        """Reset all monthly counters (run on 1st of month)."""
        if not self._pool:
            return 0
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE e30.tenants SET
                               emails_sent_this_month = 0,
                               updated_at = NOW()
                           WHERE emails_sent_this_month > 0""",
                    )
                    count = cur.rowcount
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return count
        except Exception as exc:
            logger.error("Monthly reset failed: %s", exc)
            return 0

    def set_rls_context(
        self, conn: Any, tenant_id: str, candidate_id: Optional[str] = None
    ) -> None:
        """Set RLS context for the current transaction: tenant always, candidate
        always written — to the given id, or to '' when omitted so a prior
        SET LOCAL on a reused connection cannot survive into this call.
        '' never matches a candidate_id, so the candidate policies return zero
        rows. Errors propagate: a caller must not proceed on unknown context.
        SET LOCAL is a no-op outside a transaction block, so an autocommit
        connection is refused before any SQL is issued.
        """
        if conn.autocommit:
            raise ValueError("RLS context requires a non-autocommit transaction")
        candidate = "" if candidate_id is None else str(candidate_id)
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            cur.execute("SET LOCAL app.current_candidate_id = %s", (candidate,))
