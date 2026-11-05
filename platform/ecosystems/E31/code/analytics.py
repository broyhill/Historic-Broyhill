"""
E31 Analytics — real-time campaign dashboards, behavior tracking, cohort performance.

Tracks: delivery rates, reply rates, opt-out rates, click-through rates,
donation conversion, response time, read receipts, device breakdown,
time-of-day performance, per-microsegment performance.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.analytics")


class AnalyticsEngine:
    """Real-time analytics and behavior tracking for the E31 platform."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def campaign_dashboard(self, campaign_id: UUID) -> dict:
        """Full dashboard metrics for a campaign."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Send metrics
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_sends,
                        COUNT(*) FILTER (WHERE twilio_status = 'delivered') AS delivered,
                        COUNT(*) FILTER (WHERE twilio_status = 'sent') AS sent,
                        COUNT(*) FILTER (WHERE twilio_status = 'failed') AS failed,
                        COUNT(*) FILTER (WHERE twilio_status = 'undelivered') AS undelivered,
                        COUNT(*) FILTER (WHERE is_read = TRUE) AS read_count,
                        SUM(cost_usd) AS total_cost,
                        AVG(cost_usd) AS avg_cost_per_message,
                        COUNT(DISTINCT phone_e164) AS unique_recipients,
                        MIN(sent_at) AS first_send,
                        MAX(sent_at) AS last_send
                    FROM e31.sms_platform_log
                    WHERE campaign_id = %s AND direction = 'outbound'
                    """,
                    (str(campaign_id),),
                )
                send_metrics = cur.fetchone()

                # Reply metrics
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_replies,
                        COUNT(*) FILTER (WHERE classified_as = 'positive') AS positive,
                        COUNT(*) FILTER (WHERE classified_as = 'negative') AS negative,
                        COUNT(*) FILTER (WHERE classified_as = 'donation_intent') AS donation_intent,
                        COUNT(*) FILTER (WHERE classified_as = 'volunteer_intent') AS volunteer_intent,
                        COUNT(*) FILTER (WHERE is_stop_keyword = TRUE) AS opt_outs
                    FROM e31.sms_inbound i
                    WHERE EXISTS (
                        SELECT 1 FROM e31.sms_platform_log l
                        WHERE l.campaign_id = %s
                          AND l.phone_e164 = i.from_phone
                    )
                    """,
                    (str(campaign_id),),
                )
                reply_metrics = cur.fetchone()

                total = send_metrics["total_sends"] or 1
                delivered = send_metrics["delivered"] or 0
                replies = reply_metrics["total_replies"] or 0
                reads = send_metrics["read_count"] or 0

                return {
                    "sends": send_metrics,
                    "replies": reply_metrics,
                    "rates": {
                        "delivery_rate": round(delivered / total * 100, 2),
                        "reply_rate": round(replies / total * 100, 2),
                        "read_rate": round(reads / total * 100, 2),
                        "opt_out_rate": round(
                            (reply_metrics["opt_outs"] or 0) / total * 100, 2,
                        ),
                    },
                }
        finally:
            conn.close()

    def behavior_profile(self, phone: str) -> dict:
        """Donor behavior profile based on SMS interactions.

        Tracks: engagement score, response pattern, read behavior,
        time-to-response, click-through, donation conversion.
        """
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Outbound count and read rate
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS messages_received,
                        COUNT(*) FILTER (WHERE is_read = TRUE) AS messages_read,
                        COUNT(*) FILTER (WHERE twilio_status = 'delivered') AS delivered
                    FROM e31.sms_platform_log
                    WHERE phone_e164 = %s AND direction = 'outbound'
                    """,
                    (phone,),
                )
                outbound = cur.fetchone()

                # Inbound reply count and sentiment
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_replies,
                        COUNT(*) FILTER (WHERE classified_as = 'positive') AS positive_replies,
                        COUNT(*) FILTER (WHERE classified_as = 'negative') AS negative_replies,
                        COUNT(*) FILTER (WHERE classified_as = 'donation_intent') AS donation_signals,
                        COUNT(*) FILTER (WHERE classified_as = 'volunteer_intent') AS volunteer_signals
                    FROM e31.sms_inbound
                    WHERE from_phone = %s
                    """,
                    (phone,),
                )
                inbound = cur.fetchone()

                # Click events
                cur.execute(
                    """
                    SELECT COUNT(*) AS total_clicks
                    FROM e31.sms_shortlink_clicks c
                    JOIN e31.sms_shortlinks s ON s.short_code = c.short_code
                    WHERE s.phone_e164 = %s
                    """,
                    (phone,),
                )
                clicks = cur.fetchone()

                # Behavior events (read receipts, etc.)
                cur.execute(
                    """
                    SELECT event_type, COUNT(*) AS count
                    FROM e31.sms_behavior_events
                    WHERE phone_e164 = %s
                    GROUP BY event_type
                    """,
                    (phone,),
                )
                events = {row["event_type"]: row["count"] for row in cur.fetchall()}

                msgs_received = outbound["messages_received"] or 1
                total_replies = inbound["total_replies"] or 0
                msgs_read = outbound["messages_read"] or 0

                engagement_score = min(100, int(
                    (total_replies / msgs_received * 40)
                    + (msgs_read / msgs_received * 30)
                    + (min(clicks["total_clicks"] or 0, 10) * 3)
                ))

                return {
                    "phone": phone,
                    "messages_received": outbound["messages_received"],
                    "messages_read": msgs_read,
                    "read_rate": round(msgs_read / msgs_received * 100, 2),
                    "total_replies": total_replies,
                    "reply_rate": round(total_replies / msgs_received * 100, 2),
                    "positive_replies": inbound["positive_replies"],
                    "donation_signals": inbound["donation_signals"],
                    "volunteer_signals": inbound["volunteer_signals"],
                    "total_clicks": clicks["total_clicks"],
                    "engagement_score": engagement_score,
                    "behavior_events": events,
                }
        finally:
            conn.close()

    def time_of_day_performance(
        self, candidate_id: UUID, days: int = 30,
    ) -> list:
        """Performance by hour of day — when donors are most responsive."""
        conn = self._get_db()
        since = datetime.utcnow() - timedelta(days=days)
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        EXTRACT(HOUR FROM sent_at) AS hour,
                        COUNT(*) AS sends,
                        COUNT(*) FILTER (WHERE twilio_status = 'delivered') AS delivered,
                        COUNT(*) FILTER (WHERE is_read = TRUE) AS read_count
                    FROM e31.sms_platform_log
                    WHERE candidate_id = %s
                      AND sent_at >= %s
                      AND direction = 'outbound'
                    GROUP BY EXTRACT(HOUR FROM sent_at)
                    ORDER BY hour
                    """,
                    (str(candidate_id), since),
                )
                return cur.fetchall()
        finally:
            conn.close()

    def channel_comparison(self, candidate_id: UUID) -> list:
        """Compare SMS vs iMessage vs MMS performance."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        message_type AS channel,
                        COUNT(*) AS sends,
                        COUNT(*) FILTER (WHERE twilio_status = 'delivered') AS delivered,
                        COUNT(*) FILTER (WHERE is_read = TRUE) AS read_count,
                        SUM(cost_usd) AS total_cost,
                        ROUND(AVG(cost_usd)::numeric, 4) AS avg_cost
                    FROM e31.sms_platform_log
                    WHERE candidate_id = %s AND direction = 'outbound'
                    GROUP BY message_type
                    ORDER BY sends DESC
                    """,
                    (str(candidate_id),),
                )
                return cur.fetchall()
        finally:
            conn.close()

    def cost_summary(
        self,
        candidate_id: UUID,
        days: int = 30,
    ) -> dict:
        """Cost summary for a candidate over N days."""
        conn = self._get_db()
        since = datetime.utcnow() - timedelta(days=days)
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        SUM(cost_usd) AS total_cost,
                        SUM(sms_count) AS total_sms,
                        SUM(mms_count) AS total_mms,
                        SUM(total_segments) AS total_segments,
                        COUNT(*) AS days_active
                    FROM e31.sms_cost_ledger
                    WHERE candidate_id = %s
                      AND ledger_date >= %s
                    """,
                    (str(candidate_id), since.date()),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def donor_engagement_cohorts(self, candidate_id: UUID) -> dict:
        """Segment donors into engagement cohorts based on SMS behavior.

        Cohorts: active (replied in 7d), warm (replied in 30d),
        cold (received but no reply in 30d), dormant (no sends in 60d).
        """
        conn = self._get_db()
        now = datetime.utcnow()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    WITH last_activity AS (
                        SELECT
                            phone_e164,
                            MAX(sent_at) AS last_sent,
                            MAX(CASE WHEN direction = 'inbound'
                                     THEN sent_at END) AS last_reply
                        FROM e31.sms_platform_log
                        WHERE candidate_id = %s
                        GROUP BY phone_e164
                    )
                    SELECT
                        COUNT(*) FILTER (
                            WHERE last_reply >= %s
                        ) AS active,
                        COUNT(*) FILTER (
                            WHERE last_reply >= %s
                              AND last_reply < %s
                        ) AS warm,
                        COUNT(*) FILTER (
                            WHERE last_reply IS NULL
                              AND last_sent >= %s
                        ) AS cold,
                        COUNT(*) FILTER (
                            WHERE last_sent < %s
                        ) AS dormant,
                        COUNT(*) AS total
                    FROM last_activity
                    """,
                    (
                        str(candidate_id),
                        now - timedelta(days=7),
                        now - timedelta(days=30),
                        now - timedelta(days=7),
                        now - timedelta(days=30),
                        now - timedelta(days=60),
                    ),
                )
                return cur.fetchone()
        finally:
            conn.close()
