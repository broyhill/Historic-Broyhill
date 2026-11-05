"""E30 Enterprise Email Platform — production-grade, volume-ready.

Replaces the three legacy files (ecosystem_30_email.py,
ecosystem_30_email_complete.py, e30_enterprise_email_sender.py) with a
single modular package.

Public API:
    from ecosystems.e30_email import EnterpriseEmailSender

Modules:
    config          — centralised configuration (env-driven, no hardcoded creds)
    contracts       — data contracts (PersonalizedMessage, SendOutcome, CostEvent)
    providers       — email provider adapters (SendGrid, SES) with retry + rate limiting
    compliance      — 4-gate compliance pipeline (match_tier, suppression, consent, footer)
    deliverability  — SPF/DKIM/DMARC DNS validation, IP warmup enforcement, reputation
    pipeline        — async batch send engine with concurrency, backpressure, retry
    tracking        — webhook ingestion (bounce, complaint, open, click, unsub)
    grading_router  — dual-grade email routing (state vs county grade -> template tier)
    sequences       — drip / cultivation sequences (7 political sequence types)
    ml_loop         — ML feedback loop + E22 What's Working integration
    tenant          — multi-tenant isolation (per-candidate sending domains, RLS)
    sender          — consolidated public entry point

Canary: cluster_id 372171 = 147 / $332,631.30
"""

__version__ = "2.0.0"

from ecosystems.e30_email.sender import EnterpriseEmailSender

__all__ = ["EnterpriseEmailSender"]
