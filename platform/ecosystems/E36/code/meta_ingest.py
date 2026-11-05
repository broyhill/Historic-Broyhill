"""
ecosystems/E36_unified_inbox_extension/ingestion/meta_ingest.py

Ingests IG and Facebook Page DMs into e36.external_messages.

Two ingest paths:
    1. Webhook (real-time)   — Meta pushes message events to E55 gateway
    2. Polling (catch-up)    — periodic pull for any source where webhooks lapsed

Webhook path is preferred. Polling is a safety net.

After ingestion, fires triage_engine for the new message.
"""

# SEARCH-INDEX: ecosystem=E36 tier=service
# SEARCH-KEYWORDS: e36 meta-ingest instagram facebook threads dm-polling webhook-ingest


from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


class MetaInboxIngester:
    def __init__(self, db: Any, app_secret: str, triage_engine, queue=None):
        self.db = db
        self.app_secret = app_secret.encode("utf-8")
        self.triage_engine = triage_engine
        self.queue = queue

    def handle_webhook(self, *, raw_body: bytes, signature_header: str) -> dict:
        if not self._validate_signature(raw_body, signature_header):
            return {"status": "rejected", "reason": "invalid_signature"}

        payload = json.loads(raw_body)
        ingested = 0
        for entry in payload.get("entry", []):
            page_or_account_id = entry.get("id")
            for messaging_event in entry.get("messaging", []):
                msg_id = self._ingest_messaging_event(
                    external_account_id=page_or_account_id,
                    event=messaging_event,
                    object_type=payload.get("object", "page"),
                )
                if msg_id:
                    ingested += 1
                    if self.queue:
                        self.queue.enqueue("e36.triage", {"message_id": str(msg_id)})
                    else:
                        # Synchronous triage fallback
                        try:
                            self.triage_engine.triage(msg_id)
                        except Exception:
                            logger.exception("inline triage failed for %s", msg_id)
        return {"status": "ok", "ingested": ingested}

    # -- core ingestion ------------------------------------------------------

    def _ingest_messaging_event(
        self,
        *,
        external_account_id: str,
        event: dict,
        object_type: str,
    ) -> uuid.UUID | None:
        # Resolve the source row (which candidate this Page/IG account belongs to)
        platform = "instagram" if object_type == "instagram" else "facebook"
        source = self.db.fetch_one(
            """
            SELECT id, candidate_id FROM e36.message_sources
             WHERE source_platform = %(plat)s
               AND external_account_id = %(eid)s
               AND is_active = TRUE
            """,
            {"plat": platform, "eid": external_account_id},
        )
        if not source:
            logger.warning(
                "no active message_source for %s account %s; skipping",
                platform, external_account_id,
            )
            return None

        sender = event.get("sender", {}) or {}
        recipient = event.get("recipient", {}) or {}
        message = event.get("message", {}) or {}

        # Skip our own outbound messages and read receipts
        if sender.get("id") == external_account_id:
            return None
        if event.get("delivery") or event.get("read"):
            return None
        if not message:
            return None

        external_message_id = message.get("mid") or event.get("message_id")
        if not external_message_id:
            return None

        # Idempotent insert
        row = self.db.fetch_one(
            """
            INSERT INTO e36.external_messages (
                candidate_id, source_id,
                external_message_id, external_thread_id, external_sender_id,
                sender_handle, sender_display_name,
                direction, message_text, media_attachments, raw_payload
            ) VALUES (
                %(cand)s, %(sid)s,
                %(mid)s, %(tid)s, %(sender_id)s,
                %(handle)s, %(name)s,
                'inbound', %(text)s, %(media)s::jsonb, %(raw)s::jsonb
            )
            ON CONFLICT (source_id, external_message_id) DO NOTHING
            RETURNING id
            """,
            {
                "cand": str(source["candidate_id"]),
                "sid": str(source["id"]),
                "mid": external_message_id,
                "tid": sender.get("id"),       # thread keyed by sender for DMs
                "sender_id": sender.get("id"),
                "handle": sender.get("username"),
                "name": sender.get("name"),
                "text": message.get("text"),
                "media": json.dumps(message.get("attachments", [])),
                "raw": json.dumps(event),
            },
        )
        return uuid.UUID(str(row["id"])) if row else None

    # -- signature validation (same algorithm as E19 Social DM) ----------------------

    def _validate_signature(self, raw_body: bytes, header: str | None) -> bool:
        if not header or not header.startswith("sha256="):
            return False
        expected = header.split("=", 1)[1]
        computed = hmac.new(self.app_secret, raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, computed)

    # -- polling fallback ----------------------------------------------------

    def poll_source(self, source_id: uuid.UUID, since_minutes: int = 60) -> int:
        """
        Pull recent messages via Graph API for a single source.
        Used as catch-up when webhook delivery lapses.

        Production: implement Graph API call to:
            GET /{ig-user-id}/conversations?fields=messages{from,message,created_time}&since={ts}
        Scaffold: stub returns 0.
        """
        logger.info("polling source %s (last %dm)", source_id, since_minutes)
        return 0
