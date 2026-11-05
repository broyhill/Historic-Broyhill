"""E30 data contracts — typed inputs and outputs for every boundary.

PersonalizedMessage  — input from E19 / Brain / Wizard
SendOutcome          — output to E11 rollup + E60 cost ledger
CostEvent            — output to E60 Profit Engine
WebhookEvent         — inbound from ESP (SendGrid/SES webhooks)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class MatchTier(str, Enum):
    A_EXACT = "A_EXACT"
    B_ALIAS = "B_ALIAS"
    C_FIRST3 = "C_FIRST3"
    D_HOUSEHOLD = "D_HOUSEHOLD"
    E_WRONG_LAST = "E_WRONG_LAST"
    UNMATCHED = "UNMATCHED"


class SendStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    BOUNCED = "bounced"
    COMPLAINED = "complained"
    UNSUBSCRIBED = "unsubscribed"
    FAILED = "failed"
    BLOCKED = "blocked"


class BounceType(str, Enum):
    HARD = "hard"
    SOFT = "soft"
    BLOCK = "block"
    COMPLAINT = "complaint"
    NONE = "none"


class SuppressionReason(str, Enum):
    HARD_BOUNCE = "HARD_BOUNCE"
    COMPLAINT = "COMPLAINT"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    MANUAL = "MANUAL"
    LIST_UNSUBSCRIBE = "LIST_UNSUBSCRIBE"


class WebhookType(str, Enum):
    DELIVERED = "delivered"
    OPEN = "open"
    CLICK = "click"
    BOUNCE = "bounce"
    DROPPED = "dropped"
    SPAM_REPORT = "spamreport"
    UNSUBSCRIBE = "unsubscribe"
    GROUP_UNSUBSCRIBE = "group_unsubscribe"
    DEFERRED = "deferred"


class EmailTemplate(str, Enum):
    PERSONALIZED_VIP = "personalized_vip"
    HIGH_VALUE = "high_value"
    STANDARD_SEGMENTED = "standard_segmented"
    MASS_OPTIMIZED = "mass_optimized"
    MINIMAL = "minimal"


class SequenceType(str, Enum):
    WELCOME = "welcome"
    DONOR_CULTIVATION = "donor_cultivation"
    VOLUNTEER_RECRUITMENT = "volunteer_recruitment"
    LAPSED_REACTIVATION = "lapsed_reactivation"
    EVENT_INVITATION = "event_invitation"
    GOTV = "gotv"
    POST_EVENT = "post_event"


# ---------------------------------------------------------------------------
# Email-allowed tiers (Pentad Rule P-5)
# ---------------------------------------------------------------------------

EMAIL_ALLOWED_TIERS = frozenset({MatchTier.A_EXACT, MatchTier.B_ALIAS})


# ---------------------------------------------------------------------------
# Data contracts
# ---------------------------------------------------------------------------

@dataclass
class PersonalizedMessage:
    """Input payload from E19 / Brain / Wizard."""
    donor_id: str
    candidate_id: str
    recipient_email: str
    subject: str
    body_html: str
    body_text: str = ""
    match_tier: MatchTier = MatchTier.UNMATCHED
    is_fundraising: bool = False
    campaign_id: Optional[str] = None
    template_id: Optional[str] = None
    tenant_id: Optional[str] = None
    personalization_vars: Dict[str, Any] = field(default_factory=dict)
    pattern_code: Optional[str] = None
    stop_codes: List[str] = field(default_factory=list)
    donor_grade: Optional[str] = None
    experiment_id: Optional[str] = None
    variation_id: Optional[str] = None


@dataclass
class SendOutcome:
    """Output to E11 rollup pipeline."""
    send_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    delivered: bool = False
    blocked_by: Optional[str] = None
    gate_passed: bool = True
    recipient_email: str = ""
    donor_id: str = ""
    candidate_id: str = ""
    tenant_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    cost_cents: int = 0
    sent_at: Optional[datetime] = None
    channel: str = "email"
    experiment_id: Optional[str] = None
    variation_id: Optional[str] = None
    status: SendStatus = SendStatus.QUEUED


@dataclass
class CostEvent:
    """Output to E60 Profit Engine cost ledger."""
    event_id: str = field(default_factory=lambda: f"E30:{uuid.uuid4().hex[:12]}")
    ecosystem: str = "E30"
    channel: str = "email"
    vendor: str = "sendgrid"
    cost_cents: int = 0
    send_id: str = ""
    donor_id: str = ""
    candidate_id: str = ""
    tenant_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class WebhookEvent:
    """Inbound event from ESP webhook (SendGrid / SES)."""
    event_type: WebhookType
    send_id: str = ""
    recipient_email: str = ""
    provider_message_id: str = ""
    timestamp: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    os_name: Optional[str] = None
    geo_city: Optional[str] = None
    geo_state: Optional[str] = None
    geo_country: Optional[str] = None
    link_url: Optional[str] = None
    link_position: Optional[str] = None
    bounce_type: BounceType = BounceType.NONE
    bounce_reason: Optional[str] = None
    smtp_code: Optional[int] = None
    raw_payload: Dict[str, Any] = field(default_factory=dict)
