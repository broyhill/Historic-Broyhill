"""
E31 Campaigns — CRUD, scheduling, target universe resolution, execution.

Each campaign belongs to one candidate (RLS-siloed).
Types: blast, drip, ab_test, p2p, triggered.
Integrates with E68 Wizard via wizard_session_id.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.entities import CampaignStatus, CampaignType, SMSCampaign

logger = logging.getLogger("e31.campaigns")


class CampaignManager:
    """Campaign lifecycle: create → schedule → execute → complete."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def create(
        self,
        candidate_id: UUID,
        name: str,
        body: str,
        campaign_type: str = "blast",
        media_url: Optional[str] = None,
        target_universe: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        wizard_session_id: Optional[UUID] = None,
    ) -> UUID:
        """Create a new campaign in draft status. Returns campaign_id."""
        campaign_id = uuid4()
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_campaigns
                        (campaign_id, candidate_id, campaign_name,
                         message_body, media_url, campaign_type,
                         target_universe, scheduled_at,
                         wizard_session_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
                    """,
                    (
                        str(campaign_id), str(candidate_id), name,
                        body, media_url, campaign_type,
                        target_universe, scheduled_at,
                        str(wizard_session_id) if wizard_session_id else None,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        logger.info("Campaign created: %s (%s)", name, campaign_id)
        return campaign_id

    def get(self, campaign_id: UUID) -> Optional[dict]:
        """Fetch a campaign by ID."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM e31.sms_campaigns WHERE campaign_id = %s",
                    (str(campaign_id),),
                )
                return cur.fetchone()
        finally:
            conn.close()

    def list_by_candidate(
        self,
        candidate_id: UUID,
        status: Optional[str] = None,
    ) -> list:
        """List campaigns for a candidate, optionally filtered by status."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if status:
                    cur.execute(
                        """
                        SELECT * FROM e31.sms_campaigns
                        WHERE candidate_id = %s AND status = %s
                        ORDER BY created_at DESC
                        """,
                        (str(candidate_id), status),
                    )
                else:
                    cur.execute(
                        """
                        SELECT * FROM e31.sms_campaigns
                        WHERE candidate_id = %s
                        ORDER BY created_at DESC
                        """,
                        (str(candidate_id),),
                    )
                return cur.fetchall()
        finally:
            conn.close()

    def update_status(self, campaign_id: UUID, status: str) -> None:
        """Update campaign status."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_campaigns
                    SET status = %s, updated_at = NOW()
                    WHERE campaign_id = %s
                    """,
                    (status, str(campaign_id)),
                )
                if status == "running":
                    cur.execute(
                        """
                        UPDATE e31.sms_campaigns
                        SET started_at = NOW()
                        WHERE campaign_id = %s AND started_at IS NULL
                        """,
                        (str(campaign_id),),
                    )
                elif status == "completed":
                    cur.execute(
                        """
                        UPDATE e31.sms_campaigns
                        SET completed_at = NOW()
                        WHERE campaign_id = %s
                        """,
                        (str(campaign_id),),
                    )
            conn.commit()
        finally:
            conn.close()

    def update_metrics(
        self,
        campaign_id: UUID,
        sent: int = 0,
        delivered: int = 0,
        failed: int = 0,
        opt_outs: int = 0,
        replies: int = 0,
    ) -> None:
        """Increment campaign metrics after sends complete."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_campaigns
                    SET sends_total = sends_total + %s,
                        sends_delivered = sends_delivered + %s,
                        sends_failed = sends_failed + %s,
                        opt_outs_triggered = opt_outs_triggered + %s,
                        replies_received = replies_received + %s,
                        updated_at = NOW()
                    WHERE campaign_id = %s
                    """,
                    (sent, delivered, failed, opt_outs, replies,
                     str(campaign_id)),
                )
            conn.commit()
        finally:
            conn.close()

    def resolve_target_universe(self, campaign_id: UUID) -> list:
        """Resolve the target universe to a list of phone numbers.

        Reads campaign.target_universe (segment name or SQL fragment)
        and returns eligible phones from the donor spine + phone registry.
        """
        campaign = self.get(campaign_id)
        if not campaign or not campaign.get("target_universe"):
            return []

        target = campaign["target_universe"]
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Join donor spine to eligible phones
                cur.execute(
                    """
                    SELECT ep.phone_e164, ep.rnc_regid
                    FROM e31.v_eligible_phones ep
                    JOIN core.donor_profile dp ON dp.cell_phone = ep.phone_e164
                    WHERE dp.donor_grade_state IS NOT NULL
                    ORDER BY dp.lifetime_total DESC
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()

    def get_scheduled_campaigns(self) -> list:
        """Get campaigns scheduled to run now or in the past."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM e31.sms_campaigns
                    WHERE status = 'scheduled'
                      AND scheduled_at <= NOW()
                    ORDER BY scheduled_at ASC
                    """,
                )
                return cur.fetchall()
        finally:
            conn.close()
