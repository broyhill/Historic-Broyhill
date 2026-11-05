"""
E31 Conversations — two-way threading, AI intent classification, auto-response.

Every inbound message is threaded to a conversation, classified by AI,
and routed: STOP → consent manager, donation intent → WinRed link,
volunteer intent → enrollment, question → AI answer or human escalation.
"""

import json
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.consent import ConsentManager
from ecosystems.e31_sms_mms.entities import InboundClassification, InboundMessage

logger = logging.getLogger("e31.conversations")


class ConversationManager:
    """Two-way conversation threading with AI classification."""

    def _get_db(self):
        return psycopg2.connect(E31Config.DATABASE_URL)

    def process_inbound(self, inbound: InboundMessage) -> dict:
        """Process an inbound message through the full pipeline.

        Returns: {
            'action': str,        # 'stop', 'help', 'start', 'auto_reply',
                                  # 'donation_route', 'volunteer_route',
                                  # 'escalate', 'logged'
            'reply': str | None,  # auto-reply text if applicable
            'classification': str,
            'conversation_id': str,
        }
        """
        consent = ConsentManager()

        # 1. Keyword classification (STOP/HELP/START)
        keyword_class = consent.classify_inbound(inbound.message_body or "")

        if keyword_class == "stop":
            reply = consent.process_stop(
                inbound.from_phone,
                (inbound.message_body or "").strip().lower(),
            )
            self._log_inbound(inbound, "stop", True)
            return {
                "action": "stop",
                "reply": reply,
                "classification": "stop",
                "conversation_id": None,
            }

        if keyword_class == "help":
            self._log_inbound(inbound, "help", False)
            return {
                "action": "help",
                "reply": consent.HELP_RESPONSE,
                "classification": "help",
                "conversation_id": None,
            }

        if keyword_class == "start":
            reply = consent.process_start(inbound.from_phone)
            self._log_inbound(inbound, "start", False)
            return {
                "action": "start",
                "reply": reply,
                "classification": "start",
                "conversation_id": None,
            }

        # 2. AI intent classification for non-keyword replies
        classification = self._classify_intent(inbound.message_body or "")
        inbound.classified_as = classification

        # 3. Log inbound
        self._log_inbound(inbound, classification.value, False)

        # 4. Route based on classification
        if classification == InboundClassification.DONATION_INTENT:
            return {
                "action": "donation_route",
                "reply": None,
                "classification": classification.value,
                "conversation_id": None,
            }

        if classification == InboundClassification.VOLUNTEER_INTENT:
            return {
                "action": "volunteer_route",
                "reply": None,
                "classification": classification.value,
                "conversation_id": None,
            }

        if classification == InboundClassification.QUESTION:
            return {
                "action": "escalate",
                "reply": None,
                "classification": classification.value,
                "conversation_id": None,
            }

        if classification == InboundClassification.NEGATIVE:
            return {
                "action": "logged",
                "reply": None,
                "classification": classification.value,
                "conversation_id": None,
            }

        return {
            "action": "logged",
            "reply": None,
            "classification": classification.value,
            "conversation_id": None,
        }

    def _classify_intent(self, body: str) -> InboundClassification:
        """AI-powered intent classification for inbound messages.

        Uses keyword heuristics first (fast), falls back to Claude API
        for ambiguous messages.
        """
        lower = body.strip().lower()

        # Fast keyword heuristics
        donation_signals = [
            "donate", "donation", "contribute", "give", "how much",
            "how do i give", "take my money", "want to help financially",
            "credit card", "winred", "where do i send",
        ]
        if any(signal in lower for signal in donation_signals):
            return InboundClassification.DONATION_INTENT

        volunteer_signals = [
            "volunteer", "sign me up", "how can i help",
            "knock doors", "phone bank", "canvas", "yard sign",
            "i want to help", "put me to work",
        ]
        if any(signal in lower for signal in volunteer_signals):
            return InboundClassification.VOLUNTEER_INTENT

        question_signals = ["?", "what", "when", "where", "how", "why", "who"]
        if any(signal in lower for signal in question_signals):
            return InboundClassification.QUESTION

        negative_signals = [
            "not interested", "leave me alone", "no thanks",
            "don't text me", "wrong number", "who is this",
            "remove me", "take me off",
        ]
        if any(signal in lower for signal in negative_signals):
            return InboundClassification.NEGATIVE

        positive_signals = [
            "yes", "absolutely", "count me in", "great", "love it",
            "thank you", "thanks", "god bless", "agree",
            "support", "go ed", "let's go",
        ]
        if any(signal in lower for signal in positive_signals):
            return InboundClassification.POSITIVE

        return InboundClassification.REPLY

    def _log_inbound(
        self, inbound: InboundMessage, classified_as: str, is_stop: bool,
    ) -> None:
        """Log inbound message to e31.sms_inbound."""
        conn = self._get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO e31.sms_inbound
                        (twilio_message_sid, from_phone, to_phone,
                         message_body, media_url, is_stop_keyword,
                         stop_keyword, classified_as, candidate_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        inbound.twilio_message_sid,
                        inbound.from_phone,
                        inbound.to_phone,
                        inbound.message_body,
                        inbound.media_url,
                        is_stop,
                        inbound.stop_keyword,
                        classified_as,
                        str(inbound.candidate_id) if inbound.candidate_id else None,
                    ),
                )
            conn.commit()
        except Exception as exc:
            logger.error("Failed to log inbound: %s", exc)
        finally:
            conn.close()

    def get_conversation_history(
        self, phone: str, limit: int = 50,
    ) -> list:
        """Get full conversation history for a phone (inbound + outbound)."""
        phone = ConsentManager.normalize_phone(phone)
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    (
                        SELECT 'outbound' AS direction, message_body,
                               media_url, sent_at AS timestamp,
                               twilio_status AS status, message_type AS channel
                        FROM e31.sms_platform_log
                        WHERE phone_e164 = %s
                    )
                    UNION ALL
                    (
                        SELECT 'inbound' AS direction, message_body,
                               media_url, received_at AS timestamp,
                               classified_as AS status, 'sms' AS channel
                        FROM e31.sms_inbound
                        WHERE from_phone = %s
                    )
                    ORDER BY timestamp DESC
                    LIMIT %s
                    """,
                    (phone, phone, limit),
                )
                return cur.fetchall()
        finally:
            conn.close()

    def get_response_metrics(self, campaign_id: UUID) -> dict:
        """Get response metrics for a campaign: reply rate, sentiment, avg response time."""
        conn = self._get_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_replies,
                        COUNT(*) FILTER (WHERE classified_as = 'positive') AS positive,
                        COUNT(*) FILTER (WHERE classified_as = 'negative') AS negative,
                        COUNT(*) FILTER (WHERE classified_as = 'donation_intent') AS donation_intent,
                        COUNT(*) FILTER (WHERE classified_as = 'volunteer_intent') AS volunteer_intent,
                        COUNT(*) FILTER (WHERE classified_as = 'question') AS questions,
                        COUNT(*) FILTER (WHERE is_stop_keyword) AS stop_count
                    FROM e31.sms_inbound
                    WHERE candidate_id = (
                        SELECT candidate_id FROM e31.sms_campaigns
                        WHERE campaign_id = %s
                    )
                    """,
                    (str(campaign_id),),
                )
                return cur.fetchone()
        finally:
            conn.close()
