#!/usr/bin/env python3
"""
============================================================================
ECOSYSTEM 70: DIGITAL ADS STUDIO — CANNON GATEWAY (W13)
============================================================================
Author: Claude · 2026-10-02 · Status: SEAM. Nothing in this file sends.

Why this file exists: ECO_CANONICAL/E70 had an ECO_MODEL and no code lane.
The cannon door backend/python/api/cannon_doors/w13_digital_ad.py needs something real
to bind to, and the next AI needs one named place to put the vendor call.
This is the same spine every built cannon uses (E32 call-center gateway,
E17 RVM gateway): one canonical task contract, one compliance gate evaluated
at dispatch, thin per-vendor adapters, one event processor that writes the
lifecycle back to journey.weapon_journey.

Layers:
  E41 journey tile -> brain.weapon_queue (EXEC_E70_DIGITAL_AD_AUDIENCE) -> E20 drain
    -> /api/v2/actions/execute -> cannon door W13 -> AudienceTask
    -> DeIdentificationGate -> AdPlatformAdapter (per vendor) -> provider
  provider webhooks -> AdPlatformAdapter.normalize_event -> EventProcessor
    -> e70.events + journey.weapon_journey + brain.event_queue

Schema: database/migrations/dryrun/DRYRUN_CANNON_LANES_E67_E69_E70_E71_E75_E76_2026-10-02.sql
Registry: e41.weapon_registry['DIGITAL_AD'] -> EXEC_E70_DIGITAL_AD_AUDIENCE; ops.gate_r4_studio_gate_state['W13']

Hard rails:
  - AUDIENCE WEAPON: a 'send' pushes a hashed audience + creative, never a message to a person.
  - Nothing leaves BGOP un-hashed: SHA-256 of normalized email/phone; the gate refuses anything that is not 64 hex.
    brain.action_executors row MUST carry is_vendor=TRUE, de_identified_only=TRUE before FIRE (socket Gates refuse otherwise).
  - Outcomes are audience-level; per-donor attribution comes only from E56 visitor de-anonymization, never the ad platform.
============================================================================
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ecosystem70.gateway")

SEAM = "execution lane: Cursor/Codex on Ed authorization — provider call not implemented"

class AdPlatform(str, Enum):
    META = "meta"; GOOGLE = "google"


class AudEventType(str, Enum):
    DISPATCHED = "dispatched"; AUDIENCE_READY = "audience_ready"; IMPRESSION = "impression"; CLICK = "click"; FAILED = "failed"


@dataclass
class HashedMember:
    cluster_id: int
    email_sha256: Optional[str] = None
    phone_sha256: Optional[str] = None


@dataclass
class AudienceTask:
    task_id: str
    silo_id: str
    campaign_id: str
    cluster_id: int                        # the journey donor that triggered this push (audience may be 1..n)
    platform: AdPlatform
    audience_ref: str                      # BGOP-side audience key (donor group / journey slice)
    members: List[HashedMember]
    creative_ref: Optional[str] = None
    daily_budget_cents: int = 0
    priority: int = 50


@dataclass
class AudienceEvent:
    task_id: str
    cluster_id: int
    event_type: AudEventType
    occurred_at: datetime
    platform: Optional[AdPlatform] = None
    raw_payload: Dict[str, Any] = field(default_factory=dict)
    hmac_verified: bool = False


def hash_email(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def hash_phone_e164(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    return hashlib.sha256(digits.encode()).hexdigest()


class DeIdentificationGate:
    """Refuses anything that could be raw PII. 64 hex chars or nothing."""
    @classmethod
    def check(cls, task: AudienceTask) -> Optional[str]:
        if not task.members:
            return "empty_audience"
        for m in task.members:
            for v in (m.email_sha256, m.phone_sha256):
                if v is None:
                    continue
                if len(v) != 64 or any(c not in "0123456789abcdef" for c in v):
                    return "member_not_hashed_refused"
            if m.email_sha256 is None and m.phone_sha256 is None:
                return "member_has_no_hashed_identifier"
        if task.platform == AdPlatform.META and len(task.members) < 100:
            return "meta_custom_audience_minimum_100"
        return None


class AdPlatformAdapter(ABC):
    vendor_id: str

    def __init__(self, vendor_id: str, signing_key_ref: str):
        self.vendor_id = vendor_id
        self.signing_key = os.environ.get(signing_key_ref, "").encode()

    @abstractmethod
    def dispatch(self, task: AudienceTask) -> bool: ...

    @abstractmethod
    def normalize_event(self, payload: Dict[str, Any]) -> AudienceEvent: ...

    def verify_hmac(self, body: bytes, signature: str) -> bool:
        return hmac.compare_digest(hmac.new(self.signing_key, body, hashlib.sha256).hexdigest(), signature)


class MetaCustomAudienceAdapter(AdPlatformAdapter):
    """Meta Marketing API custom audiences (hashed). SEAM."""
    def dispatch(self, task: AudienceTask) -> bool:
        raise NotImplementedError(SEAM + " — POST /act_{AD_ACCOUNT}/customaudiences + /users")
    def normalize_event(self, payload):
        raise NotImplementedError(SEAM)


class GoogleCustomerMatchAdapter(AdPlatformAdapter):
    """Google Ads Customer Match (hashed). SEAM."""
    def dispatch(self, task: AudienceTask) -> bool:
        raise NotImplementedError(SEAM + " — OfflineUserDataJobService")
    def normalize_event(self, payload):
        raise NotImplementedError(SEAM)


class EventProcessor:
    """Fan-out for every verified AudienceEvent — the learning loop.
    Writes e70.events (raw payload verbatim), then journey.weapon_journey
    lifecycle columns, then brain.event_queue so E20 triggers (family 'ad') fire.
    db = fetchone/fetchall/execute contract; None = dry (log only).
    """

    def __init__(self, db=None):
        self.db = db

    def process(self, ev: "AudienceEvent") -> Dict[str, Any]:
        col = LIFECYCLE_COLUMN.get(ev.event_type)
        out = {"event_type": ev.event_type.value, "lifecycle_column": col, "written": False}
        if self.db is None:
            logger.info("DRY %s %s", ev.event_type.value, ev.task_id)
            return out
        self.db.execute(
            "INSERT INTO e70.events (task_id, event_type, occurred_at, raw_payload, hmac_verified) VALUES (%s,%s,%s,%s,%s)",
            (ev.task_id, ev.event_type.value, ev.occurred_at, json_dumps(ev.raw_payload), ev.hmac_verified))
        if col:
            self.db.execute(
                f"UPDATE journey.weapon_journey SET {col} = COALESCE({col}, %s), journey_state=%s, updated_at=NOW() "
                "WHERE provider_message_id=%s OR weapon_queue_id::text=%s",
                (ev.occurred_at, STATE_FOR_COLUMN[col], ev.task_id, ev.task_id))
        self.db.execute(
            "INSERT INTO brain.event_queue (event_id, event_type, source_ecosystem, entity_type, entity_id, event_data, status, created_at) "
            "VALUES (gen_random_uuid(), %s, %s, 'task', %s, %s, 'pending', NOW())",
            (f"ad.{ev.event_type.value}", "E70", ev.task_id, json_dumps(ev.raw_payload)))
        if ev.event_type in TERMINAL_SUPPRESS:
            self.db.execute(
                "INSERT INTO brain.suppression_list (suppression_id, cluster_id, suppression_type, channel, source, effective_at) "
                "VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())",
                (ev.cluster_id, ev.event_type.value.upper(), "ad", "E70"))
        out["written"] = True
        return out


def json_dumps(o):
    import json
    return json.dumps(o, default=str)


LIFECYCLE_COLUMN = {AudEventType.AUDIENCE_READY: "delivered_at", AudEventType.CLICK: "engaged_at", AudEventType.FAILED: "failed_at"}
STATE_FOR_COLUMN = {"dispatched_at": "dispatched", "delivered_at": "delivered", "engaged_at": "engaged",
                     "responded_at": "responded", "donated_at": "donated", "failed_at": "failed"}
TERMINAL_SUPPRESS = set()


def dispatch(task, adapter: "AdPlatformAdapter", db=None) -> Dict[str, Any]:
    """The one call the cannon door makes. Gate first, then vendor; never the other way round."""
    why = DeIdentificationGate.check(task)
    if why:
        return {"provider_message_id": None, "blocked_by": why}
    ok = adapter.dispatch(task)          # raises NotImplementedError until the seam is filled
    return {"provider_message_id": task.task_id if ok else None, "dispatched": bool(ok), "vendor": adapter.vendor_id}
