"""Iterable bridge endpoints — E57 IN + E55/E19 OUT.

Endpoints (mount under your HTTP app):
  POST /api/iterable/system-webhook   — System Webhooks → brain.event_queue
  POST /api/brain/event               — Journey Webhook → Brain (alias)
  GET  /api/lp/decision               — Data Feed (LP decides at send time)

Auth: X-Api-Key == ITERABLE_WEBHOOK_API_KEY (required). IP allowlist is outer fence only.

Sacred tables never written. Donation processing never touched.
"""

from __future__ import annotations

import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger("api.iterable_bridge")


def _webhook_key() -> str:
    return os.environ.get("ITERABLE_WEBHOOK_API_KEY", "")


def authorize_request(headers: Dict[str, str]) -> Tuple[bool, str]:
    expected = _webhook_key()
    if not expected:
        return False, "ITERABLE_WEBHOOK_API_KEY not configured"
    provided = (
        headers.get("X-Api-Key")
        or headers.get("x-api-key")
        or headers.get("Authorization", "").removeprefix("Bearer ").strip()
    )
    if not provided or not hmac.compare_digest(provided, expected):
        return False, "unauthorized"
    return True, "ok"


def normalize_system_events(payload: Any) -> List[Dict[str, Any]]:
    """Normalize Iterable System Webhook body into brain.event_queue-shaped dicts."""
    if payload is None:
        return []
    if isinstance(payload, list):
        events = payload
    elif isinstance(payload, dict):
        if "events" in payload and isinstance(payload["events"], list):
            events = payload["events"]
        else:
            events = [payload]
    else:
        return []

    now = datetime.now(timezone.utc).isoformat()
    out: List[Dict[str, Any]] = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        event_name = (
            ev.get("eventName")
            or ev.get("event")
            or ev.get("eventType")
            or "iterable.engagement"
        )
        user_id = str(ev.get("userId") or ev.get("email") or "")
        out.append(
            {
                "event_id": str(uuid.uuid4()),
                "event_class": f"iterable.{event_name}".lower().replace(" ", "_"),
                "source": "iterable_system_webhook",
                "user_id": user_id,
                "payload": ev,
                "received_at": now,
            }
        )
    return out


def enqueue_brain_events(
    events: List[Dict[str, Any]],
    *,
    db_conn=None,
    dry_run: bool = True,
) -> int:
    """Insert into brain.event_queue when live; otherwise log-only."""
    if dry_run or db_conn is None:
        logger.info("iterable bridge dry_run enqueue: %d events", len(events))
        return len(events)

    cur = db_conn.cursor()
    for ev in events:
        cur.execute(
            """
            INSERT INTO brain.event_queue (event_id, event_class, source, payload, created_at)
            VALUES (%(event_id)s::uuid, %(event_class)s, %(source)s, %(payload)s::jsonb, NOW())
            ON CONFLICT DO NOTHING
            """,
            {
                "event_id": ev["event_id"],
                "event_class": ev["event_class"],
                "source": ev["source"],
                "payload": json.dumps(
                    {"user_id": ev.get("user_id"), "iterable": ev.get("payload")}
                ),
            },
        )
    db_conn.commit()
    return len(events)


def handle_system_webhook(
    headers: Dict[str, str],
    body: Any,
    *,
    db_conn=None,
    dry_run: bool = True,
) -> Dict[str, Any]:
    ok, reason = authorize_request(headers)
    if not ok:
        return {"ok": False, "status": 401, "error": reason}
    events = normalize_system_events(body)
    n = enqueue_brain_events(events, db_conn=db_conn, dry_run=dry_run)
    return {"ok": True, "status": 200, "enqueued": n}


def handle_journey_webhook(
    headers: Dict[str, str],
    body: Any,
    *,
    db_conn=None,
    dry_run: bool = True,
) -> Dict[str, Any]:
    """Journey Webhook OUT → same brain.event_queue path."""
    return handle_system_webhook(headers, body, db_conn=db_conn, dry_run=dry_run)


# -- Data Feed: LP decision at send time ------------------------------------

LpDecisionFn = Callable[[str], Dict[str, Any]]


def default_lp_decision(donor_key: str) -> Dict[str, Any]:
    """Stub LP response until E19 live Decision API is wired.

    Shape matches Nova teardown Data Feed contract.
    """
    return {
        "donor": donor_key,
        "ask_amount": None,
        "channel": "email",
        "copy_variant": "default",
        "lp_status": "stub",
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }


def handle_lp_decision_data_feed(
    headers: Dict[str, str],
    query: Dict[str, str],
    *,
    lp_fn: Optional[LpDecisionFn] = None,
) -> Dict[str, Any]:
    ok, reason = authorize_request(headers)
    if not ok:
        return {"ok": False, "status": 401, "error": reason}

    donor = query.get("donor") or query.get("userId") or query.get("email") or ""
    if not donor:
        return {"ok": False, "status": 400, "error": "missing donor/userId"}

    decide = lp_fn or default_lp_decision
    decision = decide(donor)
    # Data Feed expects a JSON object of personalization fields
    return {"ok": True, "status": 200, "body": decision}
