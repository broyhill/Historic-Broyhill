"""Engagement ingress → brain.event_queue (native; not Iterable System Webhooks SaaS).

Live brain.event_queue (verified 2026-10-04 via keyless /relay/nexus) is the
17-column table. The Closer's writer (funnel_controller/brain.py) uses this
9-column subset — Engage must match it, not the obsolete
(event_id, event_class, source, payload, created_at) list.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

CANARY_CLUSTER = 372171

# Closer's INSERT list — unit tests assert this exact order.
EVENT_QUEUE_COLUMNS = (
    "event_type",
    "source_universe",
    "source_ecosystem",
    "event_class",
    "entity_type",
    "entity_id",
    "event_data",
    "donor_id",
    "scheduled_for",
)

_EVENT_QUEUE_INSERT_SQL = """
            INSERT INTO brain.event_queue (
                event_type, source_universe, source_ecosystem, event_class,
                entity_type, entity_id, event_data, donor_id, scheduled_for
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, NOW())
            """

_INGRESS_PRECHECK_SQL = """
            SELECT 1 FROM brain.event_queue
            WHERE event_data->>'ingress_id' = %s
            LIMIT 1
            """


def _event_type(event_name: str) -> str:
    return str(event_name or "ENGAGE_EVENT").upper().replace(" ", "_").replace(".", "_")


def _is_canary(ev: Dict[str, Any]) -> bool:
    if ev.get("donor_id") == CANARY_CLUSTER:
        return True
    body = (ev.get("event_data") or {}).get("body")
    if not isinstance(body, dict):
        body = ev.get("payload") if isinstance(ev.get("payload"), dict) else {}
    cluster = body.get("cluster_id") if isinstance(body, dict) else None
    if cluster is None:
        return False
    try:
        return int(cluster) == CANARY_CLUSTER
    except (TypeError, ValueError):
        return False


def normalize_engagement(
    payload: Dict[str, Any],
    donor_id_resolver: Optional[Callable[[Dict[str, Any]], Optional[int]]] = None,
) -> Dict[str, Any]:
    event_name = payload.get("event") or payload.get("event_name") or "engage.event"
    engage_user_id = str(payload.get("engage_user_id") or "")
    # Payload cluster_id is untrusted. Keep it in event_data.body only.
    donor_id = None
    if callable(donor_id_resolver):
        donor_id = donor_id_resolver(payload)
    ingress_id = str(payload.get("ingress_id") or uuid.uuid4())
    event_data = {
        "trigger_src": "bgop_engage_webhooks",
        "engage_user_id": engage_user_id,
        "ingress_id": ingress_id,
        "body": payload,
    }
    return {
        "event_id": str(uuid.uuid4()),
        "event_class": f"engage.{event_name}".lower().replace(" ", "_"),
        "event_type": _event_type(event_name),
        "source": "bgop_engage",
        "source_universe": "ENGAGE",
        "source_ecosystem": "ENGAGE",
        "entity_type": "engage_user",
        "entity_id": engage_user_id,
        "donor_id": donor_id,
        "engage_user_id": engage_user_id,
        "payload": payload,
        "ingress_id": ingress_id,
        "event_data": event_data,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }


def row_for_event_queue(ev: Dict[str, Any]) -> tuple:
    """Positional values matching EVENT_QUEUE_COLUMNS (scheduled_for is NOW())."""
    event_data = ev.get("event_data") or {
        "trigger_src": "bgop_engage_webhooks",
        "engage_user_id": ev.get("engage_user_id"),
        "ingress_id": ev.get("ingress_id"),
        "body": ev.get("payload"),
    }
    return (
        ev.get("event_type") or _event_type("engage.event"),
        ev.get("source_universe") or "ENGAGE",
        ev.get("source_ecosystem") or "ENGAGE",
        "ENGAGEMENT",
        ev.get("entity_type") or "engage_user",
        ev.get("entity_id") or ev.get("engage_user_id") or "",
        json.dumps(event_data),
        ev.get("donor_id"),
    )


def enqueue(
    events: List[Dict[str, Any]],
    *,
    db_conn=None,
    dry_run: bool = True,
    donor_id_resolver: Optional[Callable[[Dict[str, Any]], Optional[int]]] = None,
) -> int:
    """Enqueue to brain.event_queue when live. dry_run default until schema+auth.

    Skips canary cluster 372171 (count, never write). Idempotent on
    event_data.ingress_id. donor_id comes only from donor_id_resolver.
    """
    prepared: List[Dict[str, Any]] = []
    for ev in events:
        row = dict(ev)
        if callable(donor_id_resolver):
            body = (row.get("event_data") or {}).get("body") or row.get("payload") or {}
            row["donor_id"] = donor_id_resolver(body if isinstance(body, dict) else {})
        if _is_canary(row):
            continue
        prepared.append(row)

    if dry_run or db_conn is None:
        return len(prepared)

    cur = db_conn.cursor()
    inserted = 0
    for ev in prepared:
        event_data = ev.get("event_data") or {}
        ingress_id = event_data.get("ingress_id") or ev.get("ingress_id")
        if ingress_id:
            cur.execute(_INGRESS_PRECHECK_SQL, (str(ingress_id),))
            seen = cur.fetchone()
            if seen:
                continue
        cur.execute(_EVENT_QUEUE_INSERT_SQL, row_for_event_queue(ev))
        inserted += 1
    if inserted:
        db_conn.commit()
    return inserted
