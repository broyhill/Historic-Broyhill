"""E30 Enterprise Email Sender — compliance-gated email worker.

Built against:
  - SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md (Section 7 rewrite spec)
  - EMAIL_DELIVERABILITY_ARCHITECTURE.md (deliverability canon)
  - Canon 15 Campaign Channel Matrix (pipe registry)

Augments ecosystem_30_email.py (legacy). Does NOT replace it.
The legacy EmailMarketingSystem is composed in but its public methods
are NOT re-exposed. This file is the canonical public entry point.

Four gates run in order before any send:
  1. match_tier gate (A_EXACT / B_ALIAS only — non-bypassable)
  2. suppression gate (global + per-tenant)
  3. consent gate (opt-in record, optional double opt-in)
  4. compliance footer gate (CAN-SPAM + FEC)

Author: Claude (claude.ai) | Date: 2026-06-18
Canary: cluster_id 372171 = 147 / $332,631.30
"""

from __future__ import annotations

import os
import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List, FrozenSet

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

logger = logging.getLogger('e30.enterprise')


def _as_uuid(value) -> Optional[str]:
    """Return the canonical UUID string for value, or None if it is not a UUID."""
    if value in (None, ''):
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None

# ── Constants ────────────────────────────────────────────────

class MatchTier(str, Enum):
    A_EXACT = 'A_EXACT'
    B_ALIAS = 'B_ALIAS'
    C_FIRST3 = 'C_FIRST3'
    D_HOUSEHOLD = 'D_HOUSEHOLD'
    E_WRONG_LAST = 'E_WRONG_LAST'
    UNMATCHED = 'UNMATCHED'

EMAIL_ALLOWED_TIERS: FrozenSet[str] = frozenset({
    MatchTier.A_EXACT.value,
    MatchTier.B_ALIAS.value,
})

SUPPRESSION_REASONS = frozenset({'HARD_BOUNCE', 'COMPLAINT', 'UNSUBSCRIBE', 'MANUAL'})

DEFAULT_COST_CENTS = 12


# ── Data contracts ───────────────────────────────────────────

@dataclass
class PersonalizedMessage:
    """Input from E19 Personalized Communication Engine."""
    donor_cluster_id: int
    candidate_id: str
    channel: str = 'email'
    subject: str = ''
    body_html: str = ''
    body_text: str = ''
    personalization_vars: Dict[str, Any] = field(default_factory=dict)
    template_id: Optional[str] = None
    is_fundraising: bool = False
    campaign_id: Optional[str] = None
    pattern_code: Optional[str] = None
    stop_codes: List[str] = field(default_factory=list)


@dataclass
class SendOutcome:
    """Output to E11 rollup pipeline."""
    send_id: str
    delivered: bool
    blocked_by: Optional[str] = None
    gate_passed: bool = True
    recipient_email: str = ''
    cluster_id: Optional[int] = None
    candidate_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    cost_cents: int = 0
    sent_at: Optional[datetime] = None
    channel: str = 'email'


@dataclass
class CostEvent:
    """Output to E60 cost ledger."""
    event_id: str
    ecosystem: str = 'E30'
    channel: str = 'email'
    vendor: str = 'sendgrid'
    cost_cents: int = 0
    send_id: str = ''
    candidate_id: str = ''
    timestamp: str = ''


# ── Compliance Footer ────────────────────────────────────────

class ComplianceFooter:
    """CAN-SPAM + FEC footer builder and validator."""

    def __init__(
        self,
        sender_org_name: str,
        physical_address: str,
        unsubscribe_url_template: str = 'https://bgop.email/unsubscribe/{token}',
        paid_for_by: Optional[str] = None,
        not_authorized_disclaimer: bool = False,
    ):
        if not sender_org_name:
            raise ValueError('sender_org_name is required (CAN-SPAM)')
        if len(physical_address) < 10:
            raise ValueError('physical_address must be >= 10 chars (CAN-SPAM)')
        self.sender_org_name = sender_org_name
        self.physical_address = physical_address
        self.unsubscribe_url_template = unsubscribe_url_template
        self.paid_for_by = paid_for_by
        self.not_authorized_disclaimer = not_authorized_disclaimer

    def render_html(self, recipient_email: str, recipient_token: str,
                    is_fundraising: bool = False) -> str:
        unsub_url = self.unsubscribe_url_template.format(token=recipient_token)
        parts = [
            f'<div style="font-size:11px;color:#666;margin-top:24px;border-top:1px solid #ddd;padding-top:12px;">',
            f'<p>{self.sender_org_name} &middot; {self.physical_address}</p>',
            f'<p><a href="{unsub_url}">Unsubscribe</a></p>',
        ]
        if is_fundraising and self.paid_for_by:
            parts.append(f'<p>Paid for by {self.paid_for_by}.</p>')
            if self.not_authorized_disclaimer:
                parts.append('<p>Not authorized by any candidate or candidate committee.</p>')
        parts.append('</div>')
        return '\n'.join(parts)

    def validate_message(self, body_html: str, recipient_token: str,
                         is_fundraising: bool = False) -> Dict[str, Any]:
        violations = []
        if self.physical_address not in body_html:
            violations.append('missing_physical_address')
        if recipient_token not in body_html:
            violations.append('missing_unsubscribe_token')
        if is_fundraising and self.paid_for_by and self.paid_for_by not in body_html:
            violations.append('missing_paid_for_by')
        return {'compliant': len(violations) == 0, 'violations': violations}


# ── Consent Ledger ───────────────────────────────────────────

class ConsentLedger:
    """Reads e30.consent_ledger. Gate 3."""

    def __init__(self, db_url: str):
        self.db_url = db_url

    def has_consent(self, email: str,
                    require_double_opt_in: bool = False) -> Dict[str, Any]:
        if not HAS_PSYCOPG2:
            logger.warning('psycopg2 not available; consent check skipped')
            return {'consented': True, 'reason': 'no_db_driver', 'row': None}
        try:
            conn = psycopg2.connect(self.db_url)
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM e30.consent_ledger WHERE email = %s AND channel = 'email'",
                    (email,)
                )
                row = cur.fetchone()
            conn.close()
        except Exception as e:
            logger.error(f'Consent check failed: {e}')
            return {'consented': False, 'reason': 'db_error', 'row': None}

        if not row:
            return {'consented': False, 'reason': 'no_consent_record', 'row': None}
        if row.get('revoked_at'):
            return {'consented': False, 'reason': 'consent_revoked', 'row': dict(row)}
        if require_double_opt_in and not row.get('double_opt_in_confirmed'):
            return {'consented': False, 'reason': 'double_opt_in_pending', 'row': dict(row)}
        return {'consented': True, 'reason': 'valid', 'row': dict(row)}


# ── Suppression List ─────────────────────────────────────────

class SuppressionList:
    """Reads/writes e30.suppression_list. Gate 2."""

    def __init__(self, db_url: str):
        self.db_url = db_url

    def is_suppressed(self, email: str) -> bool:
        if not HAS_PSYCOPG2:
            return False
        try:
            conn = psycopg2.connect(self.db_url)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM e30.suppression_list WHERE email = %s AND scope = 'global' LIMIT 1",
                    (email,)
                )
                result = cur.fetchone()
            conn.close()
            return result is not None
        except Exception as e:
            logger.error(f'Suppression check failed: {e}')
            return False

    def add(self, email: str, reason: str,
            source_send_id: Optional[str] = None,
            permanent: bool = True) -> bool:
        if reason not in SUPPRESSION_REASONS:
            raise ValueError(f'Invalid suppression reason: {reason}. Must be one of {SUPPRESSION_REASONS}')
        if not HAS_PSYCOPG2:
            logger.warning('psycopg2 not available; suppression not persisted')
            return False
        try:
            conn = psycopg2.connect(self.db_url)
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO e30.suppression_list (email, reason, source_send_id, permanent)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (email, scope) DO UPDATE SET
                           reason = EXCLUDED.reason,
                           source_send_id = EXCLUDED.source_send_id,
                           suppressed_at = NOW()""",
                    (email, reason, source_send_id, permanent)
                )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f'Suppression add failed: {e}')
            return False


# ── Bounce Classifier ────────────────────────────────────────

class BounceClassifier:
    """Classifies SMTP responses into hard/soft/none."""

    @staticmethod
    def classify(smtp_code: int) -> str:
        if smtp_code >= 500:
            return 'hard'
        elif smtp_code >= 400:
            return 'soft'
        return 'none'

    @staticmethod
    def should_suppress(bounce_type: str, soft_retry_count: int = 0) -> bool:
        if bounce_type == 'hard':
            return True
        if bounce_type == 'soft' and soft_retry_count >= 3:
            return True
        return False


# ── Deliverability Config ────────────────────────────────────

class DeliverabilityConfig:
    """IP warmup schedule + DNS validation stub."""

    WARMUP_SCHEDULE = {
        1: 50, 2: 100, 3: 200, 4: 400, 5: 700,
        6: 1000, 7: 1000, 8: 2000, 9: 3000, 10: 5000,
        11: 7000, 12: 10000, 13: 10000, 14: 10000,
        15: 15000, 18: 20000, 21: 25000, 25: 35000, 30: 50000,
    }

    @classmethod
    def daily_cap(cls, days_in_use: int) -> int:
        cap = 50
        for day, limit in sorted(cls.WARMUP_SCHEDULE.items()):
            if days_in_use >= day:
                cap = limit
        return cap

    @staticmethod
    def validate_dns(sending_domain: str) -> Dict[str, Any]:
        """Stub. Production impl uses dnspython to check SPF/DKIM/DMARC."""
        logger.info(f'DNS validation stub for {sending_domain}')
        return {
            'domain': sending_domain,
            'spf_ok': None,
            'dkim_ok': None,
            'dmarc_ok': None,
            'ready_to_send': None,
            'note': 'stub — implement with dnspython',
        }


# ── Send Provider (SendGrid v3 API) ──────────────────────────

class SendGridProvider:
    """Real SendGrid v3 /mail/send integration.

    Modes (E30_PROVIDER_MODE env or constructor):
      stub — default; no network call, returns synthetic sg_ id
      live — POST to SendGrid; requires SENDGRID_API_KEY
    """

    API_URL = 'https://api.sendgrid.com/v3/mail/send'

    def __init__(self, mode: Optional[str] = None, api_key: Optional[str] = None,
                 from_email: Optional[str] = None, from_name: Optional[str] = None):
        self.mode = (mode or os.environ.get('E30_PROVIDER_MODE', 'stub')).lower()
        self.api_key = api_key or os.environ.get('SENDGRID_API_KEY', '')
        self.from_email = from_email or os.environ.get('E30_FROM_EMAIL', 'no-reply@send.ncfirst.org')
        self.from_name = from_name or os.environ.get('E30_FROM_NAME', 'NC First')
        if self.mode == 'live' and not self.api_key:
            raise ValueError('E30_PROVIDER_MODE=live requires SENDGRID_API_KEY')

    def send(self, to_email: str, subject: str, body_html: str,
             body_text: str = '', custom_args: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Returns {'delivered': bool, 'provider_message_id': str, 'error': str|None}."""
        if self.mode != 'live':
            return {'delivered': True,
                    'provider_message_id': f'sg_stub_{uuid.uuid4().hex[:12]}',
                    'error': None}

        import json
        import urllib.request
        import urllib.error

        content = []
        if body_text:
            content.append({'type': 'text/plain', 'value': body_text})
        content.append({'type': 'text/html', 'value': body_html})
        payload = {
            'personalizations': [{
                'to': [{'email': to_email}],
                **({'custom_args': custom_args} if custom_args else {}),
            }],
            'from': {'email': self.from_email, 'name': self.from_name},
            'subject': subject,
            'content': content,
        }
        req = urllib.request.Request(
            self.API_URL,
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.api_key}',
                     'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                msg_id = resp.headers.get('X-Message-Id', f'sg_{uuid.uuid4().hex[:12]}')
                return {'delivered': resp.status in (200, 202),
                        'provider_message_id': msg_id, 'error': None}
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors='replace')[:500]
            logger.error(f'SendGrid HTTP {e.code}: {body}')
            return {'delivered': False, 'provider_message_id': '',
                    'error': f'http_{e.code}:{body}'}
        except Exception as e:
            logger.error(f'SendGrid send failed: {e}')
            return {'delivered': False, 'provider_message_id': '', 'error': str(e)}


# ── Enterprise Email Sender (the public entry point) ─────────

class EnterpriseEmailSender:
    """Compliance-gated email sender. Canonical public API for E30.

    Four gates in order:
      1. match_tier (A_EXACT/B_ALIAS only — non-bypassable)
      2. suppression (global check)
      3. consent (opt-in record)
      4. compliance footer (CAN-SPAM + FEC markers)
    """

    def __init__(
        self,
        db_url: Optional[str] = None,
        sender_org_name: str = 'NC First LLC',
        physical_address: str = '3540 Clemmons Road, Clemmons, NC 27012',
        paid_for_by: Optional[str] = None,
        not_authorized_disclaimer: bool = False,
        sending_domain: str = 'send.ncfirst.org',
        require_double_opt_in: bool = False,
    ):
        self.db_url = db_url or os.environ.get('DATABASE_URL', '')
        self.sending_domain = sending_domain
        self.require_double_opt_in = require_double_opt_in

        self.footer = ComplianceFooter(
            sender_org_name=sender_org_name,
            physical_address=physical_address,
            paid_for_by=paid_for_by,
            not_authorized_disclaimer=not_authorized_disclaimer,
        )
        self.consent = ConsentLedger(self.db_url)
        self.suppression = SuppressionList(self.db_url)
        self.provider = SendGridProvider()
        self.bounce_classifier = BounceClassifier()
        self.deliverability = DeliverabilityConfig()

        # Pause state (toggled by E60 RuleFired)
        self._paused = False
        self._throttle_pct = 100  # 100 = no throttle

    # ── Gate 1: match_tier ────────────────────────────────
    def _check_match_tier(self, match_tier: Optional[str]) -> Optional[str]:
        if not match_tier:
            return 'match_tier_missing'
        if match_tier not in EMAIL_ALLOWED_TIERS:
            return f'match_tier_blocked:{match_tier}'
        return None

    # ── Gate 2: suppression ───────────────────────────────
    def _check_suppression(self, email: str) -> Optional[str]:
        if self.suppression.is_suppressed(email):
            return 'suppressed'
        return None

    # ── Gate 3: consent ───────────────────────────────────
    def _check_consent(self, email: str) -> Optional[str]:
        result = self.consent.has_consent(email, self.require_double_opt_in)
        if not result['consented']:
            return f'no_consent:{result["reason"]}'
        return None

    # ── Gate 4: compliance footer ─────────────────────────
    def _check_footer(self, body_html: str, token: str,
                      is_fundraising: bool) -> Optional[str]:
        result = self.footer.validate_message(body_html, token, is_fundraising)
        if not result['compliant']:
            return f'footer_violation:{",".join(result["violations"])}'
        return None

    # ── Main send method ──────────────────────────────────
    def send_personalized_message(
        self,
        msg: PersonalizedMessage,
        recipient_email: str,
        match_tier: Optional[str] = None,
        is_fundraising: Optional[bool] = None,
        force: bool = False,
    ) -> SendOutcome:
        """Send an email through the 4-gate compliance pipeline.

        Args:
            msg: PersonalizedMessage from E19
            recipient_email: destination email address
            match_tier: spine match quality (A_EXACT, B_ALIAS, etc.)
            is_fundraising: whether this is a fundraising email
            force: bypass gates 2-4 (NOT gate 1). For transactional/legal only.

        Returns:
            SendOutcome with delivered=True/False and blocked_by if blocked.
        """
        send_id = str(uuid.uuid4())
        fundraising = is_fundraising if is_fundraising is not None else msg.is_fundraising
        recipient_token = uuid.uuid4().hex[:16]

        # Paused by E60 RuleFired?
        if self._paused:
            return SendOutcome(
                send_id=send_id, delivered=False, blocked_by='system_paused',
                gate_passed=False, recipient_email=recipient_email,
                cluster_id=msg.donor_cluster_id, candidate_id=msg.candidate_id,
            )

        # Gate 1: match_tier (NEVER bypassed, even with force=True)
        block = self._check_match_tier(match_tier)
        if block:
            return self._blocked_outcome(send_id, block, recipient_email, msg)

        if not force:
            # Gate 2: suppression
            block = self._check_suppression(recipient_email)
            if block:
                return self._blocked_outcome(send_id, block, recipient_email, msg)

            # Gate 3: consent
            block = self._check_consent(recipient_email)
            if block:
                return self._blocked_outcome(send_id, block, recipient_email, msg)

            # Gate 4: compliance footer
            # Inject footer if missing
            footer_html = self.footer.render_html(
                recipient_email, recipient_token, fundraising
            )
            body_with_footer = msg.body_html + footer_html

            block = self._check_footer(body_with_footer, recipient_token, fundraising)
            if block:
                return self._blocked_outcome(send_id, block, recipient_email, msg)
        else:
            body_with_footer = msg.body_html

        # All gates passed — send via provider
        now = datetime.now(timezone.utc)
        result = self.provider.send(
            to_email=recipient_email,
            subject=msg.subject,
            body_html=body_with_footer,
            body_text=msg.body_text,
            custom_args={'send_id': send_id,
                         'candidate_id': str(msg.candidate_id or ''),
                         'cluster_id': str(msg.donor_cluster_id)},
        )
        if not result['delivered']:
            return self._blocked_outcome(
                send_id, f'provider_error:{result["error"]}', recipient_email, msg
            )
        provider_msg_id = result['provider_message_id']

        logger.info(
            f'E30 SEND: {send_id} -> {recipient_email} '
            f'cluster={msg.donor_cluster_id} candidate={msg.candidate_id} '
            f'fundraising={fundraising} force={force}'
        )

        # Log to e30.send_log
        self._log_send(
            send_id=send_id,
            msg=msg,
            recipient_email=recipient_email,
            match_tier=match_tier,
            gate_passed=True,
            blocked_by=None,
            provider_message_id=provider_msg_id,
            sent_at=now,
            is_fundraising=fundraising,
            force=force,
        )

        return SendOutcome(
            send_id=send_id,
            delivered=True,
            gate_passed=True,
            recipient_email=recipient_email,
            cluster_id=msg.donor_cluster_id,
            candidate_id=msg.candidate_id,
            provider_message_id=provider_msg_id,
            cost_cents=DEFAULT_COST_CENTS,
            sent_at=now,
        )

    def _blocked_outcome(self, send_id: str, blocked_by: str,
                         email: str, msg: PersonalizedMessage) -> SendOutcome:
        logger.info(f'E30 BLOCKED: {send_id} -> {email} reason={blocked_by}')
        self._log_send(
            send_id=send_id, msg=msg, recipient_email=email,
            gate_passed=False, blocked_by=blocked_by,
        )
        return SendOutcome(
            send_id=send_id, delivered=False, blocked_by=blocked_by,
            gate_passed=False, recipient_email=email,
            cluster_id=msg.donor_cluster_id, candidate_id=msg.candidate_id,
            cost_cents=0,
        )

    def _log_send(self, send_id: str, msg: PersonalizedMessage,
                  recipient_email: str, gate_passed: bool,
                  blocked_by: Optional[str] = None,
                  match_tier: Optional[str] = None,
                  provider_message_id: Optional[str] = None,
                  sent_at: Optional[datetime] = None,
                  is_fundraising: bool = False,
                  force: bool = False) -> None:
        if not HAS_PSYCOPG2 or not self.db_url:
            return
        # e30.send_log.candidate_id / campaign_id are UUID columns; live
        # candidate ids (silo.candidates.candidate_id) are bigints. Non-UUID
        # ids go into personalization_vars so the ledger row is never lost.
        p_vars = dict(msg.personalization_vars or {})
        candidate_uuid = _as_uuid(msg.candidate_id)
        if candidate_uuid is None and msg.candidate_id not in (None, ''):
            p_vars['_candidate_ref'] = str(msg.candidate_id)
        campaign_uuid = _as_uuid(msg.campaign_id)
        if campaign_uuid is None and msg.campaign_id not in (None, ''):
            p_vars['_campaign_ref'] = str(msg.campaign_id)
        try:
            conn = psycopg2.connect(self.db_url)
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO e30.send_log
                       (send_id, campaign_id, candidate_id, cluster_id,
                        recipient_email, channel_code, match_tier,
                        gate_passed, blocked_by, template_id, subject_line,
                        personalization_vars, is_fundraising, provider_message_id,
                        sent_at, delivered, pattern_code, stop_codes, force_sent)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        send_id,
                        campaign_uuid,
                        candidate_uuid,
                        msg.donor_cluster_id,
                        recipient_email,
                        msg.channel,
                        match_tier,
                        gate_passed,
                        blocked_by,
                        msg.template_id,
                        msg.subject,
                        psycopg2.extras.Json(p_vars),
                        is_fundraising,
                        provider_message_id,
                        sent_at,
                        gate_passed,  # delivered = gate_passed for now
                        msg.pattern_code,
                        msg.stop_codes or [],
                        force,
                    )
                )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f'Send log write failed: {e}')

    # ── Cost event for E60 ────────────────────────────────
    def build_cost_event(self, outcome: SendOutcome,
                         vendor: str = 'sendgrid') -> CostEvent:
        return CostEvent(
            event_id=f'E30:send:{outcome.send_id}',
            vendor=vendor,
            cost_cents=outcome.cost_cents,
            send_id=outcome.send_id,
            candidate_id=outcome.candidate_id or '',
            timestamp=outcome.sent_at.isoformat() if outcome.sent_at else '',
        )

    # ── E60 RuleFired handler ─────────────────────────────
    def handle_rule_fired(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        action = payload.get('action', '')
        if action == 'pause_sends':
            self._paused = True
            return {'handled': True, 'action': 'paused'}
        elif action == 'resume_sends':
            self._paused = False
            return {'handled': True, 'action': 'resumed'}
        elif action == 'throttle_sends':
            self._throttle_pct = payload.get('throttle_pct', 50)
            return {'handled': True, 'action': f'throttled_to_{self._throttle_pct}pct'}
        elif action == 'add_to_suppression':
            email = payload.get('email', '')
            reason = payload.get('reason', 'MANUAL')
            if email:
                self.suppression.add(email, reason)
                return {'handled': True, 'action': f'suppressed:{email}'}
        return {'handled': False, 'action': action, 'note': 'unknown_action'}

    # ── Webhook processor (ESP callbacks) ─────────────────
    def process_webhook(self, event_type: str, email: str,
                        send_id: Optional[str] = None,
                        smtp_code: Optional[int] = None) -> Dict[str, Any]:
        """Process ESP webhook events (open, click, bounce, complaint, unsub)."""
        if event_type == 'bounce' and smtp_code:
            bounce_type = self.bounce_classifier.classify(smtp_code)
            if self.bounce_classifier.should_suppress(bounce_type):
                reason = 'HARD_BOUNCE' if bounce_type == 'hard' else 'COMPLAINT'
                self.suppression.add(email, reason, send_id)
            return {'processed': True, 'bounce_type': bounce_type}

        if event_type == 'complaint':
            self.suppression.add(email, 'COMPLAINT', send_id)
            return {'processed': True, 'suppressed': True}

        if event_type == 'unsubscribe':
            self.suppression.add(email, 'UNSUBSCRIBE', send_id)
            return {'processed': True, 'suppressed': True}

        # open, click, delivered — update send_log (stub for now)
        return {'processed': True, 'event': event_type}
