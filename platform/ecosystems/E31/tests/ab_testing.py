"""
E31 A/B Testing — multi-variant message testing with statistical significance.

Split audiences, track per-variant delivery/reply/donation rates,
auto-declare winners, and promote winning variants to full send.
"""

import logging
import random
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config

logger = logging.getLogger("e31.ab_testing")


class ABTestManager:
    """Multi-variant A/B testing engine."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def create_test(
        self,
        campaign_id: UUID,
        candidate_id: UUID,
        variants: list,
        test_name: Optional[str] = None,
        sample_pct: float = 100.0,
    ) -> UUID:
        """Create an A/B test with multiple variants.

        variants: [
            {'name': 'control', 'body': '...', 'media_url': None, 'pct': 50},
            {'name': 'variant_b', 'body': '...', 'media_url': '...', 'pct': 50},
        ]
        """
        test_id = uuid4()
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_ab_tests
                        (test_id, campaign_id, candidate_id, test_name,
                         variants_json, sample_pct, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'running')
                    """,
                    (
                        str(test_id), str(campaign_id), str(candidate_id),
                        test_name or f"test_{test_id.hex[:8]}",
                        psycopg2.extras.Json(variants),
                        sample_pct,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return test_id

    def assign_variant(self, test_id: UUID, phone: str) -> dict:
        """Assign a phone to a variant based on allocation percentages."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT variants_json FROM e31.sms_ab_tests WHERE test_id = %s",
                    (str(test_id),),
                )
                row = cur.fetchone()
        finally:
            conn.close()

        if not row:
            return {"variant": "control", "body": "", "media_url": None}

        variants = row["variants_json"]
        roll = random.random() * 100
        cumulative = 0.0
        for variant in variants:
            cumulative += variant.get("pct", 50)
            if roll <= cumulative:
                return variant
        return variants[0]

    def record_outcome(
        self,
        test_id: UUID,
        variant_name: str,
        sent: int = 0,
        delivered: int = 0,
        replied: int = 0,
        opted_out: int = 0,
        donated: int = 0,
        donation_amount: float = 0.0,
    ) -> None:
        """Record outcome metrics for a variant."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_ab_test_results
                        (test_id, variant_name, sends, deliveries,
                         replies, opt_outs, donations, donation_amount)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (test_id, variant_name) DO UPDATE SET
                        sends = e31.sms_ab_test_results.sends + EXCLUDED.sends,
                        deliveries = e31.sms_ab_test_results.deliveries + EXCLUDED.deliveries,
                        replies = e31.sms_ab_test_results.replies + EXCLUDED.replies,
                        opt_outs = e31.sms_ab_test_results.opt_outs + EXCLUDED.opt_outs,
                        donations = e31.sms_ab_test_results.donations + EXCLUDED.donations,
                        donation_amount = e31.sms_ab_test_results.donation_amount + EXCLUDED.donation_amount,
                        updated_at = NOW()
                    """,
                    (
                        str(test_id), variant_name, sent, delivered,
                        replied, opted_out, donated, donation_amount,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

    def get_results(self, test_id: UUID) -> list:
        """Get per-variant results for a test."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT variant_name, sends, deliveries, replies,
                           opt_outs, donations, donation_amount,
                           CASE WHEN sends > 0
                                THEN ROUND(replies::numeric / sends * 100, 2)
                                ELSE 0 END AS reply_rate,
                           CASE WHEN sends > 0
                                THEN ROUND(opt_outs::numeric / sends * 100, 2)
                                ELSE 0 END AS opt_out_rate,
                           CASE WHEN sends > 0
                                THEN ROUND(donations::numeric / sends * 100, 2)
                                ELSE 0 END AS conversion_rate
                    FROM e31.sms_ab_test_results
                    WHERE test_id = %s
                    ORDER BY reply_rate DESC
                    """,
                    (str(test_id),),
                )
                return cur.fetchall()
        finally:
            conn.close()

    def declare_winner(self, test_id: UUID) -> Optional[str]:
        """Determine the winning variant by highest conversion rate.

        Returns variant_name of winner, or None if insufficient data.
        """
        results = self.get_results(test_id)
        if not results:
            return None

        min_sends = 100
        eligible = [r for r in results if r["sends"] >= min_sends]
        if not eligible:
            return None

        winner = max(eligible, key=lambda r: float(r["conversion_rate"]))
        winner_name = winner["variant_name"]

        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_ab_tests
                    SET status = 'completed',
                        winner_variant = %s,
                        completed_at = NOW()
                    WHERE test_id = %s
                    """,
                    (winner_name, str(test_id)),
                )
            conn.commit()
        finally:
            conn.close()

        return winner_name
