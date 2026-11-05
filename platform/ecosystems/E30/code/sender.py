"""E30 Enterprise Email Sender — consolidated public entry point.

This is THE canonical public API for E30.  All email sends flow through
here.  It wires together every subsystem:

  config          → centralised env-driven settings
  providers       → SendGrid / SES / Mock with retry + rate limiting
  compliance      → 4-gate pipeline (match_tier, suppression, consent, footer)
  deliverability  → DNS validation, IP warmup, reputation monitoring
  pipeline        → concurrent batch send engine
  tracking        → webhook ingestion + event processing
  grading_router  → dual-grade template selection
  sequences       → drip / cultivation automation
  ml_loop         → send-time optimisation, content scoring, E22 bridge
  tenant          → multi-tenant isolation

Usage:
    from ecosystems.e30_email import EnterpriseEmailSender

    sender = EnterpriseEmailSender.from_env()
    outcome = sender.send(msg)
    batch_result = sender.send_campaign(messages)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from ecosystems.e30_email.compliance import (
    ComplianceFooter,
    CompliancePipeline,
    ConsentGate,
    MatchTierGate,
    SuppressionGate,
)
from ecosystems.e30_email.config import E30Config
from ecosystems.e30_email.contracts import (
    CostEvent,
    PersonalizedMessage,
    SendOutcome,
    SendStatus,
)
from ecosystems.e30_email.deliverability import (
    DNSCheckResult,
    ReputationTracker,
    WarmupState,
    validate_dns,
)
from ecosystems.e30_email.ml_loop import (
    ContentScorer,
    E22Bridge,
    EngagementPredictor,
    SendTimeOptimiser,
)
from ecosystems.e30_email.pipeline import BatchResult, SendPipeline
from ecosystems.e30_email.providers import EmailProvider, create_provider
from ecosystems.e30_email.sequences import SequenceEngine
from ecosystems.e30_email.tenant import TenantManager
from ecosystems.e30_email.tracking import (
    BounceClassifier,
    WebhookProcessor,
    parse_sendgrid_events,
    parse_ses_notification,
)

logger = logging.getLogger("e30.sender")


class EnterpriseEmailSender:
    """Production email sender — the single public API for E30.

    Handles:
      - Single sends and batch campaigns
      - 4-gate compliance (match_tier, suppression, consent, footer)
      - IP warmup enforcement
      - Concurrent sending with backpressure
      - Webhook processing (bounce, complaint, open, click)
      - Multi-tenant isolation
      - E22 experiment tracking
      - Send-time optimisation
      - Engagement prediction

    Canary: cluster_id 372171 = 147 / $332,631.30
    """

    def __init__(self, config: E30Config, db_pool: Any = None):
        self._config = config
        self._db_pool = db_pool

        # Provider
        self._provider: EmailProvider = self._init_provider()

        # Compliance pipeline
        self._suppression_gate = SuppressionGate(db_pool)
        self._compliance = CompliancePipeline(
            match_tier_gate=MatchTierGate(),
            suppression_gate=self._suppression_gate,
            consent_gate=ConsentGate(db_pool, config.require_double_opt_in),
            footer=ComplianceFooter(
                sender_org_name=config.sender_org_name,
                physical_address=config.physical_address,
                unsubscribe_url_template=config.unsubscribe_url_template,
                paid_for_by=config.paid_for_by,
                not_authorized_disclaimer=config.not_authorized_disclaimer,
            ),
        )

        # Deliverability
        self._warmup: Optional[WarmupState] = None
        if config.ip_warmup_start_date:
            try:
                start = date.fromisoformat(config.ip_warmup_start_date)
                self._warmup = WarmupState(start_date=start)
            except ValueError:
                logger.warning("Invalid warmup start date: %s", config.ip_warmup_start_date)
        if config.warmup_override_cap and self._warmup:
            pass  # warmup handles this internally

        self._reputation = ReputationTracker(db_pool)

        # Pipeline
        self._pipeline = SendPipeline(
            provider=self._provider,
            compliance=self._compliance,
            config=config,
            warmup=self._warmup,
            db_pool=db_pool,
            on_outcome=self._on_send_outcome,
        )

        # ML loop
        self._send_time = SendTimeOptimiser(db_pool)
        self._content_scorer = ContentScorer(db_pool)
        self._engagement = EngagementPredictor(db_pool)
        self._e22_bridge = E22Bridge(config.e22_enabled)

        # Sequences
        self._sequences = SequenceEngine(db_pool)

        # Multi-tenant
        self._tenants = TenantManager(db_pool)

        # Tracking
        self._webhook_processor = WebhookProcessor(db_pool, self._suppression_gate)

        logger.info("E30 EnterpriseEmailSender initialised (provider=%s, warmup=%s)",
                     config.default_provider,
                     "active" if self._warmup else "none")

    @classmethod
    def from_env(cls, db_pool: Any = None) -> "EnterpriseEmailSender":
        """Construct from environment variables."""
        return cls(config=E30Config.from_env(), db_pool=db_pool)

    # -- Provider init -----------------------------------------------------

    def _init_provider(self) -> EmailProvider:
        name = self._config.default_provider
        if name == "sendgrid" and self._config.sendgrid_api_key:
            return create_provider("sendgrid",
                                   api_key=self._config.sendgrid_api_key,
                                   rpm_limit=self._config.provider_rpm_limit,
                                   sandbox=self._config.sendgrid_sandbox)   # dark by default (E30_SENDGRID_SANDBOX)
        if name == "ses" and self._config.ses_access_key_id:
            return create_provider("ses",
                                   region=self._config.ses_region,
                                   access_key_id=self._config.ses_access_key_id,
                                   secret_access_key=self._config.ses_secret_access_key,
                                   rpm_limit=self._config.provider_rpm_limit)
        logger.warning("No ESP credentials found; using MockProvider")
        return create_provider("mock")

    # -- Single send -------------------------------------------------------

    def send(self, msg: PersonalizedMessage, force: bool = False) -> SendOutcome:
        """Send a single email through the full pipeline."""
        return self._pipeline._send_single(msg, force=force)

    # -- Batch / campaign send ---------------------------------------------

    def send_batch(self, messages: List[PersonalizedMessage],
                   force: bool = False) -> BatchResult:
        """Send a batch concurrently."""
        return self._pipeline.send_batch(messages, force=force)

    def send_campaign(self, messages: List[PersonalizedMessage],
                      force: bool = False) -> BatchResult:
        """Send an entire campaign in batches."""
        return self._pipeline.send_campaign(messages, force=force)

    # -- Webhook processing ------------------------------------------------

    def process_sendgrid_webhook(self, payload: List[Dict[str, Any]]) -> Dict[str, int]:
        """Process a SendGrid Event Webhook batch."""
        events = parse_sendgrid_events(payload)
        return self._webhook_processor.process(events)

    def process_ses_notification(self, payload: Dict[str, Any]) -> Dict[str, int]:
        """Process an SES SNS notification."""
        events = parse_ses_notification(payload)
        return self._webhook_processor.process(events)

    # -- Deliverability checks ---------------------------------------------

    def check_dns(self) -> DNSCheckResult:
        """Validate SPF/DKIM/DMARC for the sending domain."""
        return validate_dns(self._config.sending_domain)

    def warmup_status(self) -> Dict[str, Any]:
        """Get IP warmup status."""
        if not self._warmup:
            return {"active": False, "note": "no warmup configured"}
        return {"active": True, **self._warmup.status()}

    def reputation(self, tenant_id: Optional[str] = None,
                   days: int = 7) -> Dict[str, Any]:
        """Get reputation metrics for the last N days."""
        snap = self._reputation.snapshot(tenant_id, days)
        return snap.to_dict()

    # -- Pause / throttle (E60 RuleFired handlers) -------------------------

    def pause(self) -> None:
        self._pipeline.pause()

    def resume(self) -> None:
        self._pipeline.resume()

    def throttle(self, pct: int) -> None:
        self._pipeline.throttle(pct)

    # -- ML loop access ----------------------------------------------------

    def optimal_send_time(self, email: str) -> Dict[str, Any]:
        return self._send_time.get_optimal(email)

    def top_subject_lines(self, candidate_id: Optional[str] = None,
                          limit: int = 10):
        return self._content_scorer.top_subject_lines(candidate_id, limit)

    def engagement_score(self, email: str):
        return self._engagement.score(email)

    def high_churn_recipients(self, limit: int = 500) -> List[str]:
        return self._engagement.high_churn_list(limit)

    # -- Sequence access ---------------------------------------------------

    @property
    def sequences(self) -> SequenceEngine:
        return self._sequences

    # -- Tenant access -----------------------------------------------------

    @property
    def tenants(self) -> TenantManager:
        return self._tenants

    # -- Outcome callback --------------------------------------------------

    def _on_send_outcome(self, outcome: SendOutcome) -> None:
        """Called after every send — reports to E22 if experiment tracked."""
        if outcome.delivered and outcome.experiment_id:
            self._e22_bridge.report_send(
                send_id=outcome.send_id,
                experiment_id=outcome.experiment_id,
                variation_id=outcome.variation_id,
                donor_id=outcome.donor_id,
            )

    # -- Status / health ---------------------------------------------------

    def status(self) -> Dict[str, Any]:
        """Full system health check."""
        dns = self.check_dns()
        rep = self.reputation(days=1)
        warmup = self.warmup_status()
        return {
            "provider": self._config.default_provider,
            "sending_domain": self._config.sending_domain,
            "dns": {
                "spf": dns.spf_ok,
                "dkim": dns.dkim_ok,
                "dmarc": dns.dmarc_ok,
                "all_pass": dns.all_pass,
            },
            "reputation_24h": rep,
            "warmup": warmup,
            "paused": self._pipeline._paused,
            "throttle_pct": self._pipeline._throttle_pct,
            "e22_enabled": self._config.e22_enabled,
        }
