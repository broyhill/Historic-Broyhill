#!/usr/bin/env python3
"""
============================================================================
ECOSYSTEM 17: RVM GATEWAY — Gun 4 of the 16-gun arsenal
============================================================================
DESIGN-ONLY MODULE (2026-07-07). Companion to ecosystem_32_call_center_gateway.py.
Vendor telephony (Slybroadcast / Drop Cowboy / VoiceDrop class) sits behind one
canonical DropTask/DropEvent contract; BGOP keeps the queue, consent gate,
audio factory, fatigue writeback, and learning loop.

COMPLIANCE (supersedes ecosystem_17_rvm.py Dec-2024 header):
FCC 2022 ringless-voicemail ruling: RVM to a WIRELESS number IS a call under
TCPA — prerecorded/AI voice to cells needs prior express consent (political
included). Landline voicemail keeps the political prerecorded carve-out.
E17 therefore reuses e32.phone_consent_ledger and the E32 provenance lanes:
  self_provided mobile + consent -> eligible
  appended mobile               -> SUPPRESSED (no consent on file)
  landline mailbox              -> political carve-out lane
============================================================================
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Canonical contracts
# ---------------------------------------------------------------------------

class DropEventType(str, Enum):
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    MAILBOX_FULL = "mailbox_full"
    FAILED = "failed"
    CALLBACK = "callback"
    IVR_BUTTON = "ivr_button"          # Canon 18: E35 7-button matrix press
    TEXT_REPLY = "text_reply"
    OPT_OUT = "opt_out"


@dataclass
class DropTask:
    """Canonical outbound contract (Gateway -> vendor adapter)."""
    drop_id: str
    silo_id: str
    campaign_id: str
    wave_id: str
    cluster_id: int
    phone_e164: str
    line_type: str                       # 'mobile' | 'landline' | 'voip' | 'unknown'
    carrier: Optional[str]
    consent: Dict[str, Any]             # {ai_voice, autodial, provenance} from e32 ledger
    audio_url: str
    audio_ai_generated: bool
    callback_number: str                # campaign tracking DID
    deliver_window_start: Optional[datetime] = None
    deliver_window_end: Optional[datetime] = None
    priority: int = 50


@dataclass
class DropEvent:
    """Canonical inbound contract (vendor webhook -> Gateway)."""
    drop_id: str
    vendor_id: str
    event_type: DropEventType
    occurred_at: datetime
    status_detail: Optional[str] = None
    reply_text: Optional[str] = None
    ivr_button: Optional[int] = None    # Canon 18: 1-7, 0 = opt-out
    brain_event_code: Optional[str] = None  # rvm_rsvp_yes .. rvm_candidate_message_left | s_rvm_stop
    raw_payload: Dict[str, Any] = field(default_factory=dict)
    hmac_verified: bool = False


# ---------------------------------------------------------------------------
# Consent gate — hard pre-send compliance rail
# ---------------------------------------------------------------------------

class RVMConsentGate:
    """FCC 2022 RVM ruling + FCC 24-17 AI-voice rules, shared with E32."""

    @classmethod
    def check(cls, task: DropTask) -> Optional[str]:
        """Return a rejection reason, or None if the drop passes."""
        line = task.line_type if task.line_type in ("mobile", "landline") else "mobile"
        if line == "mobile":
            provenance = task.consent.get("provenance")
            if provenance != "self_provided":
                return "appended_number_no_consent"
            if task.audio_ai_generated and not task.consent.get("ai_voice"):
                return "ai_voice_consent_missing"
            if not task.consent.get("autodial"):
                return "prerecorded_consent_missing"
        # landline mailbox: political prerecorded carve-out — no consent required
        if task.consent.get("opted_out"):
            return "opt_out_on_ledger"
        return None


# ---------------------------------------------------------------------------
# Vendor adapters
# ---------------------------------------------------------------------------

class RVMVendorAdapter(ABC):
    """Thin per-vendor translation layer."""

    @abstractmethod
    def dispatch_batch(self, tasks: List[DropTask]) -> Dict[str, bool]:
        """Push a batch of canonical drops to the vendor; drop_id -> accepted."""

    @abstractmethod
    def normalize_event(self, payload: Dict[str, Any]) -> DropEvent:
        """Map a vendor webhook body into the canonical DropEvent."""


class SlybroadcastAdapter(RVMVendorAdapter):
    """Slybroadcast-class API vendor (Tier 1)."""

    STATUS_MAP = {
        "OK": DropEventType.DELIVERED,
        "MAILBOX_FULL": DropEventType.MAILBOX_FULL,
        "FAILED": DropEventType.FAILED,
        "OPTOUT": DropEventType.OPT_OUT,
    }

    def dispatch_batch(self, tasks: List[DropTask]) -> Dict[str, bool]:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")

    def normalize_event(self, payload: Dict[str, Any]) -> DropEvent:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")


class DropCowboyAdapter(RVMVendorAdapter):
    """Drop Cowboy (Tier 1, installed) — dispatch via E55 api_gateway drop_cowboy_request()."""

    def dispatch_batch(self, tasks: List[DropTask]) -> Dict[str, bool]:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")

    def normalize_event(self, payload: Dict[str, Any]) -> DropEvent:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")


# ---------------------------------------------------------------------------
# Event processor — learning loop + fatigue + BPF writeback
# ---------------------------------------------------------------------------

class RVMEventProcessor:
    """
    Webhook ingest pipeline (design):
      1. Verify HMAC; persist to e17.rvm_responses / update e17.rvm_drops.
      2. delivered/callback/text_reply -> fatigue ledger touch (shared caps with E32).
      3. callback -> E35 Canon 18 seven-button IVR on the campaign's dedicated
         per-candidate DID; button presses land here as IVR_BUTTON events and
         fire their Canon 18 Brain events (rvm_rsvp_yes, rvm_donation_intent,
         rvm_live_transfer_request -> e32 task, rvm_candidate_message_left ->
         E52 candidate-private inbox / iPhone app, press 0 -> s_rvm_stop).
      4. opt_out -> ledger within 5s; suppress across ALL guns for the silo.
      5. Engaged statuses -> BPF stage writeback (brain.prospect_pipeline).
      6. failed_carrier/bad_number -> phone-quality flag on the contact spine.
    """

    def process(self, event: DropEvent) -> None:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")


# ---------------------------------------------------------------------------
# Oversight — auto-pause rails
# ---------------------------------------------------------------------------

class RVMOversightEngine:
    """
    Auto-pause a campaign when:
      - opt_out rate > 1.5% of delivered
      - failed rate > 20% (carrier reputation risk)
      - any drop dispatched with consent gate bypassed (hard kill + alert)
      - callback volume > staff capacity threshold (throttle, not kill)
    100% of AI-generated audio requires E48 voice gate >= 0.85 and human
    approval (audio_assets.approved_by) before any campaign can go live.
    """

    def evaluate(self, campaign_id: str) -> Optional[str]:
        raise NotImplementedError("Execution lane: Cursor/Codex post-authorization")
