"""
E31 Entities — dataclasses and enums for the SMS/MMS platform.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID


# ── Enums ─────────────────────────────────────────────────────────────

class MessageChannel(Enum):
    SMS = "sms"
    MMS = "mms"
    RCS = "rcs"
    IMESSAGE = "imessage"


class MessageStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"  # iMessage read receipts
    FAILED = "failed"
    UNDELIVERED = "undelivered"


class MessageDirection(Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class CampaignType(Enum):
    BLAST = "blast"
    DRIP = "drip"
    AB_TEST = "ab_test"
    P2P = "p2p"
    TRIGGERED = "triggered"


class CampaignStatus(Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ConsentStatus(Enum):
    OPTED_IN = "opted_in"
    OPTED_OUT = "opted_out"
    UNKNOWN = "unknown"
    PENDING = "pending"


class LineType(Enum):
    MOBILE = "mobile"
    LANDLINE = "landline"
    VOIP = "voip"
    UNKNOWN = "unknown"


class NumberType(Enum):
    LOCAL = "local"
    TOLL_FREE = "toll_free"
    SHORT_CODE = "short_code"
    TEN_DLC = "10dlc"


class InboundClassification(Enum):
    STOP = "stop"
    HELP = "help"
    REPLY = "reply"
    QUESTION = "question"
    DONATION_INTENT = "donation_intent"
    VOLUNTEER_INTENT = "volunteer_intent"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    UNKNOWN = "unknown"


class ABTestStatus(Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DripStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class EnrollmentStatus(Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OPTED_OUT = "opted_out"


# ── Dataclasses ───────────────────────────────────────────────────────

@dataclass
class SMSMessage:
    """A single outbound or inbound SMS/MMS message."""
    phone_e164: str
    message_body: str
    candidate_id: UUID
    channel: MessageChannel = MessageChannel.SMS
    direction: MessageDirection = MessageDirection.OUTBOUND
    media_url: Optional[str] = None
    campaign_id: Optional[UUID] = None
    send_id: Optional[UUID] = None
    rnc_regid: Optional[str] = None
    variant_name: Optional[str] = None
    shortlink_code: Optional[str] = None
    status: MessageStatus = MessageStatus.PENDING
    provider: Optional[str] = None
    provider_message_id: Optional[str] = None
    cost_usd: Optional[float] = None
    segments: int = 1
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None


@dataclass
class SMSCampaign:
    """An SMS campaign belonging to a single candidate."""
    candidate_id: UUID
    campaign_name: str
    message_body: str
    campaign_type: CampaignType = CampaignType.BLAST
    status: CampaignStatus = CampaignStatus.DRAFT
    campaign_id: Optional[UUID] = None
    wizard_session_id: Optional[UUID] = None
    media_url: Optional[str] = None
    target_universe: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    sends_total: int = 0
    sends_delivered: int = 0
    sends_failed: int = 0
    opt_outs_triggered: int = 0
    replies_received: int = 0


@dataclass
class ConsentRecord:
    """TCPA consent state for a single phone number (platform-wide)."""
    phone_e164: str
    opt_in_status: ConsentStatus = ConsentStatus.UNKNOWN
    opt_in_source: Optional[str] = None
    opt_in_timestamp: Optional[datetime] = None
    opt_out_timestamp: Optional[datetime] = None
    opt_out_keyword: Optional[str] = None
    rnc_regid: Optional[str] = None
    is_valid: bool = True
    line_type: Optional[LineType] = None
    carrier: Optional[str] = None
    texts_today: int = 0


@dataclass
class InboundMessage:
    """An inbound message received via Twilio/Sinch webhook."""
    from_phone: str
    to_phone: str
    message_body: Optional[str] = None
    media_url: Optional[str] = None
    twilio_message_sid: Optional[str] = None
    is_stop_keyword: bool = False
    stop_keyword: Optional[str] = None
    classified_as: Optional[InboundClassification] = None
    candidate_id: Optional[UUID] = None
    received_at: Optional[datetime] = None


@dataclass
class NumberPoolEntry:
    """A Twilio phone number assigned to a candidate."""
    phone_e164: str
    number_type: NumberType = NumberType.LOCAL
    candidate_id: Optional[UUID] = None
    twilio_sid: Optional[str] = None
    ten_dlc_brand_id: Optional[str] = None
    ten_dlc_campaign_id: Optional[str] = None
    status: str = "active"


@dataclass
class ABTestVariant:
    """One variant in an A/B test."""
    variant_name: str
    message_body: str
    allocation_pct: float = 50.0
    media_url: Optional[str] = None
    sends: int = 0
    deliveries: int = 0
    replies: int = 0
    opt_outs: int = 0
    donations_attributed: int = 0
    donation_amount: float = 0.0
    variant_id: Optional[UUID] = None


@dataclass
class DripStep:
    """One step in a drip sequence."""
    step_number: int
    message_body: str
    delay_days: int = 0
    delay_hours: int = 0
    media_url: Optional[str] = None
    step_id: Optional[UUID] = None


@dataclass
class ShortlinkClick:
    """A click event on a tracked shortlink."""
    short_code: str
    phone_number: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    clicked_at: Optional[datetime] = None


@dataclass
class SendResult:
    """Result of a single send attempt through a provider."""
    success: bool
    provider: str
    message_id: Optional[str] = None
    status: Optional[str] = None
    segments: int = 1
    cost_usd: float = 0.0
    error: Optional[str] = None
