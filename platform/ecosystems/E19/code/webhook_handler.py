"""
ecosystems/E19_social/dm/webhook_handler.py

Meta Graph webhook handler for IG/FB/Threads comment events.

Responsibilities:
    1. Validate webhook signature (HMAC-SHA256 with app secret)
    2. Idempotency check via external_event_id
    3. Persist comment_event row in queued state
    4. Hand off to async worker (response_router)
    5. ACK Meta within 20s (Meta's hard timeout)

Routes through E55 API Gateway. Never bypassed.
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social meta-webhook hmac idempotency queue e55 graph-api


from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class WebhookValidationResult:
    valid: bool
    reason: str | None = None


class MetaWebhookHandler:
    def __init__(self, db: Any, app_secret: str, queue: Any):
        self.db = db
        self.app_secret = app_secret.encode("utf-8")
        self.queue = queue

    def handle(
        self,
        *,
        raw_body: bytes,
        signature_header: str,
        candidate_id: uuid.UUID,
    ) -> dict:
        """
        Entry point invoked by E55 API Gateway.
        Returns dict suitable for HTTP 200 response.
        """
        validation = self._validate_signature(raw_body, signature_header)
        if not validation.valid:
            logger.warning("webhook signature invalid: %s", validation.reason)
            return {"status": "rejected", "reason": validation.reason}

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError as e:
            logger.warning("webhook body not JSON: %s", e)
            return {"status": "rejected", "reason": "malformed_body"}

        # Meta payloads can include multiple entries; iterate
        events_queued = 0
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") not in ("comments", "feed"):
                    continue
                value = change.get("value", {})
                if value.get("verb") != "add":   # we only care about new comments
                    continue

                event_id = self._persist_comment_event(
                    candidate_id=candidate_id,
                    source_platform=self._infer_platform(payload),
                    raw_value=value,
                )
                if event_id:
                    self.queue.enqueue("e19_dm.process_comment", {"event_id": str(event_id)})
                    events_queued += 1

        return {"status": "ok", "events_queued": events_queued}

    # -- validation ----------------------------------------------------------

    def _validate_signature(self, raw_body: bytes, header: str) -> WebhookValidationResult:
        """
        Meta sends X-Hub-Signature-256 header: 'sha256=<hex digest>'.
        """
        if not header or not header.startswith("sha256="):
            return WebhookValidationResult(False, "missing_or_malformed_signature")

        expected = header.split("=", 1)[1]
        computed = hmac.new(self.app_secret, raw_body, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected, computed):
            return WebhookValidationResult(False, "signature_mismatch")
        return WebhookValidationResult(True)

    @staticmethod
    def _infer_platform(payload: dict) -> str:
        obj = payload.get("object", "")
        if obj == "instagram":
            return "instagram"
        if obj == "page":
            return "facebook"
        return "facebook"

    # -- persistence ---------------------------------------------------------

    def _persist_comment_event(
        self,
        *,
        candidate_id: uuid.UUID,
        source_platform: str,
        raw_value: dict,
    ) -> uuid.UUID | None:
        external_event_id = raw_value.get("comment_id") or raw_value.get("id")
        if not external_event_id:
            logger.warning("comment event missing id; skipping")
            return None

        # Idempotency: ON CONFLICT DO NOTHING via UNIQUE(source_platform, external_event_id)
        from_user = raw_value.get("from", {}) or {}
        row = self.db.fetch_one(
            """
            INSERT INTO e19_dm.comment_events (
                candidate_id, source_platform, external_event_id,
                external_post_id, external_comment_id, external_commenter_id,
                commenter_handle, commenter_display_name,
                comment_text, processing_state, processing_state_at
            ) VALUES (
                %(cand)s, %(plat)s, %(eid)s,
                %(post)s, %(cid)s, %(commenter)s,
                %(handle)s, %(name)s,
                %(text)s, 'queued', NOW()
            )
            ON CONFLICT (source_platform, external_event_id) DO NOTHING
            RETURNING id
            """,
            {
                "cand": str(candidate_id),
                "plat": source_platform,
                "eid": external_event_id,
                "post": raw_value.get("post_id"),
                "cid": raw_value.get("comment_id"),
                "commenter": from_user.get("id"),
                "handle": from_user.get("username") or from_user.get("name"),
                "name": from_user.get("name"),
                "text": raw_value.get("text") or raw_value.get("message"),
            },
        )
        return uuid.UUID(str(row["id"])) if row else None
