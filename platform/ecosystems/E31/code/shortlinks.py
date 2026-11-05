"""
E31 Shortlinks — trackable short URLs with click attribution.

Every donation link, event RSVP, or external URL gets wrapped in a
bgop.link shortlink. Clicks are attributed back to campaign, variant,
phone, and donor profile. Tracks device, geo, time-to-click.
"""

import hashlib
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.shortlinks")


class ShortlinkManager:
    """Trackable URL shortener with per-donor attribution."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def create(
        self,
        destination_url: str,
        candidate_id: UUID,
        campaign_id: Optional[UUID] = None,
        variant_name: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> str:
        """Create a shortlink. Returns the short URL."""
        code = self._generate_code(destination_url, phone or "")
        short_url = f"{E31Config.SHORTLINK_DOMAIN}/{code}"

        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_shortlinks
                        (short_code, destination_url, candidate_id,
                         campaign_id, variant_name, phone_e164)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (short_code) DO NOTHING
                    """,
                    (
                        code, destination_url, str(candidate_id),
                        str(campaign_id) if campaign_id else None,
                        variant_name, phone,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return short_url

    def resolve(self, short_code: str) -> Optional[str]:
        """Resolve a short code to its destination URL."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT destination_url FROM e31.sms_shortlinks WHERE short_code = %s",
                    (short_code,),
                )
                row = cur.fetchone()
                return row["destination_url"] if row else None
        finally:
            conn.close()

    def record_click(
        self,
        short_code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_type: Optional[str] = None,
    ) -> None:
        """Record a click event with device/geo attribution."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_shortlink_clicks
                        (short_code, ip_address, user_agent, device_type)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (short_code, ip_address, user_agent, device_type),
                )
                cur.execute(
                    """
                    UPDATE e31.sms_shortlinks
                    SET click_count = click_count + 1,
                        last_clicked_at = NOW()
                    WHERE short_code = %s
                    """,
                    (short_code,),
                )
            conn.commit()
        finally:
            conn.close()

    def get_click_stats(self, short_code: str) -> dict:
        """Get click statistics for a shortlink."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT click_count, last_clicked_at,
                           destination_url, campaign_id, variant_name
                    FROM e31.sms_shortlinks
                    WHERE short_code = %s
                    """,
                    (short_code,),
                )
                link = cur.fetchone()
                if not link:
                    return {}

                cur.execute(
                    """
                    SELECT device_type, COUNT(*) AS count
                    FROM e31.sms_shortlink_clicks
                    WHERE short_code = %s
                    GROUP BY device_type
                    """,
                    (short_code,),
                )
                devices = cur.fetchall()

                return {
                    "total_clicks": link["click_count"],
                    "last_clicked": str(link["last_clicked_at"]) if link["last_clicked_at"] else None,
                    "destination": link["destination_url"],
                    "devices": {d["device_type"]: d["count"] for d in devices},
                }
        finally:
            conn.close()

    def get_campaign_links(self, campaign_id: UUID) -> list:
        """Get all shortlinks for a campaign with click counts."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT short_code, destination_url, variant_name,
                           click_count, last_clicked_at
                    FROM e31.sms_shortlinks
                    WHERE campaign_id = %s
                    ORDER BY click_count DESC
                    """,
                    (str(campaign_id),),
                )
                return cur.fetchall()
        finally:
            conn.close()

    @staticmethod
    def _generate_code(url: str, salt: str) -> str:
        """Generate a unique 8-char short code."""
        raw = f"{url}:{salt}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:8]
