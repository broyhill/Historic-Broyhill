"""
ecosystems/E36_unified_inbox_extension/triage_engine.py

Triages every inbound external_message into the right queue.

Decision flow:
    1. Resolve identity (shared/identity_resolution)
    2. Walk e36.routing_rules in priority order
    3. First matching rule sets:
        - triage_priority
        - assigned_to_user_id (or assigned_role)
        - escalation channel
    4. If no rule matches, default fallback (unknown → AI auto-handle via E09)
    5. If donor grade = A++/A+ → always alert candidate's E15 dashboard
"""

# SEARCH-INDEX: ecosystem=E36 tier=service
# SEARCH-KEYWORDS: e36 triage routing-rules grade-based sla e15-escalation e09-auto-handle


from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class TriageDecision:
    triage_priority: str
    assigned_user_id: uuid.UUID | None
    auto_handle_response_id: uuid.UUID | None
    escalation_target: str | None
    matched_rule_id: uuid.UUID | None
    rationale: str


class TriageEngine:
    def __init__(self, db: Any, identity_resolver, e09_auto_handler=None):
        self.db = db
        self.identity_resolver = identity_resolver
        self.e09_auto_handler = e09_auto_handler

    def triage(self, external_message_id: uuid.UUID) -> TriageDecision | None:
        msg = self.db.fetch_one(
            """
            SELECT em.*, ms.source_platform
              FROM e36.external_messages em
              JOIN e36.message_sources ms ON ms.id = em.source_id
             WHERE em.id = %(id)s
            """,
            {"id": str(external_message_id)},
        )
        if not msg:
            logger.warning("external message %s not found", external_message_id)
            return None

        # 1. Identity resolution if not already resolved
        if not msg["resolved_contact_id"]:
            from shared.identity_resolution.resolver import ResolverInput
            resolution = self.identity_resolver.resolve(ResolverInput(
                candidate_id=uuid.UUID(str(msg["candidate_id"])),
                handle=msg["sender_handle"],
                display_name=msg["sender_display_name"],
                platform=msg["source_platform"],
            ))
            self.db.execute(
                """
                UPDATE e36.external_messages
                   SET resolved_contact_id = %(cid)s,
                       resolved_rncid = %(rncid)s,
                       resolved_grade = %(grade)s,
                       resolved_at = NOW()
                 WHERE id = %(id)s
                """,
                {
                    "id": str(external_message_id),
                    "cid": str(resolution.contact_id) if resolution.contact_id else None,
                    "rncid": resolution.rncid,
                    "grade": resolution.grade,
                },
            )
            grade = resolution.grade
            district_match = resolution.district_match
        else:
            grade = msg["resolved_grade"]
            district_match = None

        # 2. Walk routing rules
        rules = self.db.fetch_all(
            """
            SELECT id, rule_name, grade_in, keywords_any, source_platforms,
                   district_match_required,
                   action_type, action_target, triage_priority
              FROM e36.routing_rules
             WHERE candidate_id = %(cand)s AND is_active = TRUE
             ORDER BY rule_priority DESC
            """,
            {"cand": str(msg["candidate_id"])},
        )

        for rule in rules:
            if self._rule_matches(rule, msg, grade, district_match):
                decision = self._apply_rule(rule, msg)
                self._persist_decision(external_message_id, decision)
                return decision

        # 3. Fallback — A++/A+ always urgent, others auto-handle
        if grade in ("A++", "A+"):
            decision = TriageDecision(
                triage_priority="urgent",
                assigned_user_id=None,         # candidate's E15 alert path
                auto_handle_response_id=None,
                escalation_target="e15_candidate_live",
                matched_rule_id=None,
                rationale="fallback: A++/A+ grade always escalates to candidate",
            )
        else:
            response_id = None
            if self.e09_auto_handler:
                response_id = self.e09_auto_handler.draft_response(
                    candidate_id=uuid.UUID(str(msg["candidate_id"])),
                    inbound_text=msg["message_text"] or "",
                )
            decision = TriageDecision(
                triage_priority="auto_handled" if response_id else "low",
                assigned_user_id=None,
                auto_handle_response_id=response_id,
                escalation_target=None,
                matched_rule_id=None,
                rationale="fallback: no rule matched; auto-handle via E09",
            )

        self._persist_decision(external_message_id, decision)
        return decision

    # -- rule matching -------------------------------------------------------

    def _rule_matches(self, rule, msg, grade, district_match) -> bool:
        if rule["grade_in"] and grade not in rule["grade_in"]:
            return False
        if rule["source_platforms"] and msg["source_platform"] not in rule["source_platforms"]:
            return False
        if rule["district_match_required"] and not district_match:
            return False
        if rule["keywords_any"]:
            text = (msg["message_text"] or "").lower()
            if not any(kw.lower() in text for kw in rule["keywords_any"]):
                return False
        return True

    def _apply_rule(self, rule, msg) -> TriageDecision:
        atype = rule["action_type"]
        assigned_user_id = None
        escalation_target = None
        auto_handle_response_id = None

        if atype == "assign_user":
            assigned_user_id = uuid.UUID(rule["action_target"])
        elif atype == "escalate_candidate":
            escalation_target = "e15_candidate_live"
        elif atype == "route_press_e45":
            escalation_target = "e45_press_operations"
        elif atype == "route_volunteer_e38":
            escalation_target = "e38_field_ops"
        elif atype == "auto_handle_e09":
            if self.e09_auto_handler:
                auto_handle_response_id = self.e09_auto_handler.draft_response(
                    candidate_id=uuid.UUID(str(msg["candidate_id"])),
                    inbound_text=msg["message_text"] or "",
                )

        return TriageDecision(
            triage_priority=rule["triage_priority"],
            assigned_user_id=assigned_user_id,
            auto_handle_response_id=auto_handle_response_id,
            escalation_target=escalation_target,
            matched_rule_id=uuid.UUID(str(rule["id"])),
            rationale=f"matched rule: {rule['rule_name']}",
        )

    def _persist_decision(self, message_id: uuid.UUID, d: TriageDecision) -> None:
        self.db.execute(
            """
            UPDATE e36.external_messages
               SET triage_priority = %(prio)s,
                   assigned_to_user_id = %(uid)s,
                   assigned_at = CASE WHEN %(uid)s IS NOT NULL THEN NOW() ELSE assigned_at END,
                   auto_handled_response_id = %(rid)s
             WHERE id = %(id)s
            """,
            {
                "id": str(message_id),
                "prio": d.triage_priority,
                "uid": str(d.assigned_user_id) if d.assigned_user_id else None,
                "rid": str(d.auto_handle_response_id) if d.auto_handle_response_id else None,
            },
        )
