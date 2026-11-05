"""
E31 Cost Ledger — per-candidate per-day cost accounting.

Tracks SMS/MMS/iMessage costs per candidate, enforces budget caps,
generates billing reports. Brain throttle integration stops sends
when a candidate exceeds their daily budget.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.cost_ledger")


class CostLedger:
    """Per-candidate per-day cost accounting and budget enforcement."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def get_daily_spend(self, candidate_id: UUID, date: Optional[str] = None) -> dict:
        """Get a candidate's spend for a specific date (default: today)."""
        target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT candidate_id, ledger_date,
                           sms_count, mms_count, total_segments,
                           cost_usd
                    FROM e31.sms_cost_ledger
                    WHERE candidate_id = %s AND ledger_date = %s
                    """,
                    (str(candidate_id), target_date),
                )
                row = cur.fetchone()
                if row:
                    return dict(row)
                return {
                    "candidate_id": str(candidate_id),
                    "ledger_date": target_date,
                    "sms_count": 0, "mms_count": 0,
                    "total_segments": 0, "cost_usd": 0.0,
                }
        finally:
            conn.close()

    def check_budget(
        self,
        candidate_id: UUID,
        daily_budget: float = 500.0,
    ) -> dict:
        """Check if candidate is within budget.

        Returns: {
            'within_budget': bool,
            'spent_today': float,
            'remaining': float,
            'daily_budget': float,
        }
        """
        spend = self.get_daily_spend(candidate_id)
        spent = spend["cost_usd"]
        return {
            "within_budget": spent < daily_budget,
            "spent_today": spent,
            "remaining": max(0, daily_budget - spent),
            "daily_budget": daily_budget,
        }

    def monthly_report(self, candidate_id: UUID) -> dict:
        """Monthly cost breakdown for a candidate."""
        conn = self._get_db()
        first_of_month = datetime.utcnow().replace(day=1).strftime("%Y-%m-%d")
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        SUM(sms_count) AS total_sms,
                        SUM(mms_count) AS total_mms,
                        SUM(total_segments) AS total_segments,
                        SUM(cost_usd) AS total_cost,
                        COUNT(DISTINCT ledger_date) AS active_days,
                        MIN(ledger_date) AS first_send_date,
                        MAX(ledger_date) AS last_send_date
                    FROM e31.sms_cost_ledger
                    WHERE candidate_id = %s
                      AND ledger_date >= %s
                    """,
                    (str(candidate_id), first_of_month),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def platform_spend_summary(self, days: int = 30) -> dict:
        """Platform-wide spend summary across all candidates."""
        conn = self._get_db()
        since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(DISTINCT candidate_id) AS active_candidates,
                        SUM(sms_count) AS total_sms,
                        SUM(mms_count) AS total_mms,
                        SUM(cost_usd) AS total_cost,
                        AVG(cost_usd) AS avg_daily_cost
                    FROM e31.sms_cost_ledger
                    WHERE ledger_date >= %s
                    """,
                    (since,),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def top_spenders(self, days: int = 30, limit: int = 20) -> list:
        """Top spending candidates over N days."""
        conn = self._get_db()
        since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        candidate_id,
                        SUM(cost_usd) AS total_cost,
                        SUM(sms_count) AS total_sms,
                        SUM(mms_count) AS total_mms
                    FROM e31.sms_cost_ledger
                    WHERE ledger_date >= %s
                    GROUP BY candidate_id
                    ORDER BY total_cost DESC
                    LIMIT %s
                    """,
                    (since, limit),
                )
                return cur.fetchall()
        finally:
            conn.close()
