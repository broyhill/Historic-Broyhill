"""Send-time LP hook — native Data Feed equivalent (not Iterable Data Feed SaaS).

# CORRECTION 2026-10-04: Re-mapped decision ecosystem from E19 to E60 per core registry.
E60 owns Linear Programming / Decision Optimization. E19 is Social Media.

The stub must never authorize FIRE. Unreachable E60 returns NO_ACTION /
ALLOW_PASS=False and optionally records E60_LP_UNREACHABLE_FALLBACK_BLOCKED.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from ecosystems.bgop_engage.modules.webhooks import enqueue, normalize_engagement

LpFn = Callable[[str], Dict[str, Any]]

# Documented E60 solver door (E60 DATAIKU canon): /lp/solve on the profit-engine port.
E60_LP_PATH = "/lp/solve"
E60_LP_DEFAULT_BASE = "http://127.0.0.1:8083"


class LiveLpRequired(RuntimeError):
    """Raised when a FIRE-path decision is requested without a live E60 client."""


class E60LpUnreachable(RuntimeError):
    """Raised when E60 answers anything other than a signed HTTP 200."""


def default_lp_stub(engage_user_id: str) -> Dict[str, Any]:
    """Placeholder only. Never authorize a send."""
    return {
        "engage_user_id": engage_user_id,
        "ask_amount": None,
        "channel": None,
        "copy_variant": None,
        "lp_status": "stub",
        "decision": "NO_ACTION",
        "allow_pass": False,
        "send_email": False,
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "source": "bgop_engage.data_feed",
        "decision_eco": "E60",  # CORRECTION 2026-10-04: Re-mapped decision ecosystem from E19 to E60 per core registry
    }


def e60_lp_decide(
    engage_user_id: str,
    *,
    base_url: Optional[str] = None,
    timeout: float = 2.0,
) -> Dict[str, Any]:
    """Thin E60 client. Require HTTP 200 before authorizing any campaign trigger."""
    root = (base_url or os.environ.get("E60_LP_BASE_URL") or E60_LP_DEFAULT_BASE).rstrip("/")
    url = f"{root}{E60_LP_PATH}"
    body = json.dumps({"engage_user_id": engage_user_id, "eco": "E60"}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = getattr(resp, "status", None) or resp.getcode()
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        raise E60LpUnreachable(f"E60 LP HTTP {exc.code} at {url}") from exc
    except urllib.error.URLError as exc:
        raise E60LpUnreachable(f"E60 LP unreachable at {url}: {exc.reason}") from exc
    if int(status) != 200:
        raise E60LpUnreachable(f"E60 LP HTTP {status} at {url} (require 200)")
    try:
        parsed = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise E60LpUnreachable("E60 LP returned non-JSON body") from exc
    if not isinstance(parsed, dict):
        raise E60LpUnreachable("E60 LP returned a non-object JSON body")
    parsed.setdefault("decision_eco", "E60")
    parsed.setdefault("lp_status", "live")
    parsed.setdefault("source", "e60.lp_solve")
    return parsed


def _blocked_fallback(engage_user_id: str, reason: str, *, db_conn=None) -> Dict[str, Any]:
    decision = {
        "engage_user_id": engage_user_id,
        "ask_amount": None,
        "channel": None,
        "decision": "NO_ACTION",
        "allow_pass": False,
        "send_email": False,
        "lp_status": "unreachable_blocked",
        "reason": reason,
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "source": "bgop_engage.data_feed",
        "decision_eco": "E60",
        "event_type": "E60_LP_UNREACHABLE_FALLBACK_BLOCKED",
    }
    ev = normalize_engagement(
        {
            "event": "E60_LP_UNREACHABLE_FALLBACK_BLOCKED",
            "engage_user_id": engage_user_id,
            "reason": reason,
        }
    )
    enqueue([ev], db_conn=db_conn, dry_run=db_conn is None)
    return decision


def decide_at_send(
    engage_user_id: str,
    *,
    lp_fn: Optional[LpFn] = None,
    require_live: bool = False,
    db_conn=None,
) -> Dict[str, Any]:
    """Called at send time — E60 LP decides; Engage renders/sends via E30.

    # CORRECTION 2026-10-04: Re-mapped decision ecosystem from E19 to E60 per core registry
    """
    if require_live and lp_fn is None:
        raise LiveLpRequired("FIRE-path decisions require a live E60 lp_fn; stub is forbidden")
    if lp_fn is None:
        decision = default_lp_stub(engage_user_id)
        decision.setdefault("vendor_saas", False)
        return decision
    try:
        decision = lp_fn(engage_user_id)
    except E60LpUnreachable as exc:
        return _blocked_fallback(engage_user_id, str(exc), db_conn=db_conn)
    if not isinstance(decision, dict):
        return _blocked_fallback(engage_user_id, "E60 LP returned a non-object", db_conn=db_conn)
    decision.setdefault("vendor_saas", False)
    decision.setdefault("decision_eco", "E60")
    return decision
