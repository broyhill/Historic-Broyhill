"""
E31 — Enterprise SMS/MMS/iMessage Texting Platform
===================================================
AI-powered omnichannel texting: SMS, MMS, RCS, iMessage (Sendblue).
TCPA/10DLC compliant. Brain-throttled. Candidate-siloed via RLS.

Replaces: RumbleUp ($30K-90K/yr), Hustle ($48K/yr), Twilio direct,
          Attentive ($200K+/yr enterprise SMS)
Diamond Vault source: AI_POWERED_INTELLIGENT_TEXTING_PLATFORM_COMPLETE.md (73KB)

Providers
---------
sendblue        — iMessage (blue bubbles, read receipts, vCard, reactions)
twilio          — SMS/MMS primary carrier
sinch           — SMS failover
bandwidth       — SMS tertiary failover

Modules
-------
config          — Environment, costs, provider credentials
entities        — Dataclasses: Message, Campaign, Conversation, Consent, etc.
providers       — Twilio, Sinch, Bandwidth, Sendblue adapters
consent         — TCPA/10DLC consent gate, STOP keyword processing
phone_registry  — Phone validation, line-type, carrier, iMessage detection
campaigns       — Campaign CRUD, scheduling, target universe resolution
send_engine     — Orchestrator: consent → fatigue → route → dispatch
conversations   — Two-way threading, AI intent classification
ai_journeys     — ML-driven adaptive conversation flows (Attentive AI Pro equiv)
ab_testing      — Multi-variant A/B tests with statistical significance
drip_sequences  — Multi-step automated sequences with delay scheduling
shortlinks      — Trackable short URLs with click attribution
number_pool     — Twilio/Sendblue number → candidate assignment, 10DLC
cost_ledger     — Per-candidate per-day cost accounting, budget caps
ai_composer     — AI message personalization (microsegment × issue × tone)
webhooks        — Provider status callbacks + inbound message handlers
analytics       — Real-time dashboards, behavior tracking, cohort performance
"""

from ecosystems.e31_sms_mms.config import E31Config
from ecosystems.e31_sms_mms.entities import (
    ABTestStatus, CampaignStatus, CampaignType,
    ConsentStatus, DripStatus, EnrollmentStatus,
    InboundClassification, LineType, MessageChannel,
    MessageDirection, MessageStatus, NumberType,
    ABTestVariant, ConsentRecord, DripStep,
    InboundMessage, NumberPoolEntry, SendResult,
    ShortlinkClick, SMSCampaign, SMSMessage,
)

__all__ = [
    # Config
    "E31Config",
    # Enums
    "ABTestStatus", "CampaignStatus", "CampaignType",
    "ConsentStatus", "DripStatus", "EnrollmentStatus",
    "InboundClassification", "LineType", "MessageChannel",
    "MessageDirection", "MessageStatus", "NumberType",
    # Dataclasses
    "ABTestVariant", "ConsentRecord", "DripStep",
    "InboundMessage", "NumberPoolEntry", "SendResult",
    "ShortlinkClick", "SMSCampaign", "SMSMessage",
]
