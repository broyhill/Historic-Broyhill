"""E30 4-gate compliance pipeline.

Gates run in order before any send — all four must pass:
  1. match_tier  — A_EXACT / B_ALIAS only (non-bypassable, per Pentad Rule P-5)
  2. suppression — global + per-tenant suppression list
  3. consent     — opt-in record in e30.consent_ledger
  4. footer      — CAN-SPAM physical address + unsubscribe + FEC disclaimer

Gate 1 cannot be bypassed even with force=True (spine quality is a
hard compliance requirement).  Gates 2-4 can be bypassed for
transactional/legal emails only.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Dict, List, Optional

from ecosystems.e30_email.contracts import (
    EMAIL_ALLOWED_TIERS,
    MatchTier,
    PersonalizedMessage,
    SuppressionReason,
)

logger = logging.getLogger("e30.compliance")


# ---------------------------------------------------------------------------
# Gate result
# ---------------------------------------------------------------------------

class GateResult:
    __slots__ = ("passed", "gate_name", "reason", "details")

    def __init__(self, passed: bool, gate_name: str,
                 reason: str = "", details: Optional[Dict[str, Any]] = None):
        self.passed = passed
        self.gate_name = gate_name
        self.reason = reason
        self.details = details or {}

    def __repr__(self) -> str:
        status = "PASS" if self.passed else "BLOCK"
        return f"GateResult({status}, gate={self.gate_name}, reason={self.reason})"


# ---------------------------------------------------------------------------
# Gate 1: Match tier
# ---------------------------------------------------------------------------

class MatchTierGate:
    """Per Pentad Rule P-5: email sends restricted to A_EXACT and B_ALIAS.
    This gate is NEVER bypassable — even force=True does not skip it.
    """

    @staticmethod
    def check(msg: PersonalizedMessage) -> GateResult:
        if msg.match_tier in EMAIL_ALLOWED_TIERS:
            return GateResult(True, "match_tier")
        return GateResult(
            False, "match_tier",
            reason=f"tier_{msg.match_tier.value}_not_allowed",
            details={"match_tier": msg.match_tier.value,
                     "allowed": [t.value for t in EMAIL_ALLOWED_TIERS]},
        )


# ---------------------------------------------------------------------------
# Gate 2: Suppression
# ---------------------------------------------------------------------------

class SuppressionGate:
    """Check global + per-tenant suppression lists."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def check(self, email: str, tenant_id: Optional[str] = None) -> GateResult:
        if not self._pool:
            return GateResult(True, "suppression", reason="no_db_pool")
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT reason, suppressed_at
                           FROM e30.suppression_list
                           WHERE email = %s
                             AND (tenant_id IS NULL OR tenant_id = %s)
                           LIMIT 1""",
                        (email.lower().strip(), tenant_id),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if row:
                return GateResult(
                    False, "suppression",
                    reason=f"suppressed:{row[0]}",
                    details={"reason": row[0], "suppressed_at": str(row[1])},
                )
            return GateResult(True, "suppression")
        except Exception as exc:
            logger.error("Suppression check failed: %s", exc)
            return GateResult(True, "suppression", reason="db_error_passthrough")

    def add(self, email: str, reason: SuppressionReason,
            source_send_id: Optional[str] = None,
            tenant_id: Optional[str] = None,
            permanent: bool = True) -> bool:
        """Idempotent UPSERT into suppression list."""
        if not self._pool:
            return False
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO e30.suppression_list
                               (email, reason, source_send_id, tenant_id, permanent)
                           VALUES (%s, %s, %s, %s, %s)
                           ON CONFLICT (email, tenant_id) DO UPDATE SET
                               reason = EXCLUDED.reason,
                               source_send_id = COALESCE(EXCLUDED.source_send_id,
                                                         e30.suppression_list.source_send_id),
                               permanent = e30.suppression_list.permanent OR EXCLUDED.permanent,
                               suppressed_at = NOW()""",
                        (email.lower().strip(), reason.value, source_send_id, tenant_id, permanent),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return True
        except Exception as exc:
            logger.error("Suppression add failed: %s", exc)
            return False


# ---------------------------------------------------------------------------
# Gate 3: Consent
# ---------------------------------------------------------------------------

class ConsentGate:
    """Reads e30.consent_ledger to confirm opt-in."""

    def __init__(self, db_pool: Any = None, require_double_opt_in: bool = False):
        self._pool = db_pool
        self._require_double = require_double_opt_in

    def check(self, email: str) -> GateResult:
        if not self._pool:
            return GateResult(True, "consent", reason="no_db_pool")
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT opted_in_at, revoked_at, double_opt_in_confirmed, source
                           FROM e30.consent_ledger
                           WHERE email = %s AND channel = 'email'""",
                        (email.lower().strip(),),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if not row:
                return GateResult(False, "consent", reason="no_consent_record")
            if row[1] is not None:  # revoked_at
                return GateResult(False, "consent", reason="consent_revoked")
            if self._require_double and not row[2]:  # double_opt_in_confirmed
                return GateResult(False, "consent", reason="double_opt_in_pending")
            return GateResult(True, "consent")
        except Exception as exc:
            logger.error("Consent check failed: %s", exc)
            return GateResult(False, "consent", reason="db_error")


# ---------------------------------------------------------------------------
# Gate 4: Compliance footer (CAN-SPAM + FEC)
# ---------------------------------------------------------------------------

class ComplianceFooter:
    """Builds and validates CAN-SPAM + FEC compliance footer.

    CAN-SPAM (15 U.S.C. 7704(a)(5)):
      - Physical postal address of the sender
      - Clear opt-out link (one-click per Google/Yahoo 2024)
      - Truthful sender identification

    FEC (52 U.S.C. 30120 + 11 CFR 110.11):
      - "Paid for by ..." on fundraising/political emails
      - "Not authorized by any candidate" if applicable
    """

    def __init__(self, sender_org_name: str, physical_address: str,
                 unsubscribe_url_template: str = "https://bgop.email/unsubscribe/{token}",
                 paid_for_by: Optional[str] = None,
                 not_authorized_disclaimer: bool = False):
        if not sender_org_name:
            raise ValueError("CAN-SPAM requires sender_org_name")
        if not physical_address or len(physical_address) < 10:
            raise ValueError("CAN-SPAM requires a real physical address (>= 10 chars)")
        self.sender_org_name = sender_org_name
        self.physical_address = physical_address
        self.unsubscribe_url_template = unsubscribe_url_template
        self.paid_for_by = paid_for_by
        self.not_authorized_disclaimer = not_authorized_disclaimer

    def generate_token(self, donor_id: str, email: str) -> str:
        """Deterministic unsubscribe token per donor+email."""
        return hashlib.sha256(f"{donor_id}|{email}".encode()).hexdigest()[:24]

    def render_html(self, recipient_email: str, token: str,
                    is_fundraising: bool = False) -> str:
        unsub_url = self.unsubscribe_url_template.format(token=token)
        lines = [
            '<div style="font-size:11px;color:#666;margin-top:24px;'
            'border-top:1px solid #ddd;padding-top:12px;font-family:Arial,sans-serif;">',
            f'  <p>{self.sender_org_name} &middot; {self.physical_address}</p>',
            f'  <p><a href="{unsub_url}" style="color:#666;">Unsubscribe</a> '
            f'| <a href="{unsub_url}&prefs=1" style="color:#666;">Email Preferences</a></p>',
        ]
        if is_fundraising and self.paid_for_by:
            lines.append(f'  <p style="font-size:10px;color:#999;">Paid for by {self.paid_for_by}.')
            if self.not_authorized_disclaimer:
                lines.append('  Not authorized by any candidate or candidate\'s committee.')
            lines.append('  </p>')
        lines.append('</div>')
        return "\n".join(lines)

    def validate(self, body_html: str, token: str,
                 is_fundraising: bool = False) -> GateResult:
        """Check that the final email body contains all required elements."""
        violations: List[str] = []
        if self.physical_address not in body_html:
            violations.append("missing_physical_address")
        if token not in body_html:
            violations.append("missing_unsubscribe_token")
        if "unsubscribe" not in body_html.lower():
            violations.append("missing_unsubscribe_link")
        if is_fundraising and self.paid_for_by and "paid for by" not in body_html.lower():
            violations.append("missing_paid_for_by")
        if violations:
            return GateResult(
                False, "compliance_footer",
                reason=",".join(violations),
                details={"violations": violations},
            )
        return GateResult(True, "compliance_footer")


# ---------------------------------------------------------------------------
# Combined pipeline
# ---------------------------------------------------------------------------

class CompliancePipeline:
    """Run all four gates in order. Returns first failing gate or all-pass."""

    def __init__(self, match_tier_gate: MatchTierGate,
                 suppression_gate: SuppressionGate,
                 consent_gate: ConsentGate,
                 footer: ComplianceFooter):
        self.match_tier = match_tier_gate
        self.suppression = suppression_gate
        self.consent = consent_gate
        self.footer = footer

    def run(self, msg: PersonalizedMessage, force: bool = False) -> List[GateResult]:
        """Run all gates.  Gate 1 is NEVER bypassed.  Gates 2-4 are
        skippable with force=True (transactional/legal only)."""
        results: List[GateResult] = []

        # Gate 1: match_tier (non-bypassable)
        g1 = self.match_tier.check(msg)
        results.append(g1)
        if not g1.passed:
            return results

        if not force:
            # Gate 2: suppression
            g2 = self.suppression.check(msg.recipient_email, msg.tenant_id)
            results.append(g2)
            if not g2.passed:
                return results

            # Gate 3: consent
            g3 = self.consent.check(msg.recipient_email)
            results.append(g3)
            if not g3.passed:
                return results

            # Gate 4: compliance footer
            token = self.footer.generate_token(msg.donor_id, msg.recipient_email)
            body_with_footer = msg.body_html + "\n" + self.footer.render_html(
                msg.recipient_email, token, msg.is_fundraising,
            )
            g4 = self.footer.validate(body_with_footer, token, msg.is_fundraising)
            results.append(g4)
            if not g4.passed:
                return results

        return results

    def all_passed(self, results: List[GateResult]) -> bool:
        return all(r.passed for r in results)

    def first_failure(self, results: List[GateResult]) -> Optional[GateResult]:
        for r in results:
            if not r.passed:
                return r
        return None
