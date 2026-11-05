"""
ecosystems/E19_social/dm/response_router.py

Async worker. Consumes queued comment events.
Resolves identity, matches keyword, picks branch, dispatches DM.
Emits cost to E61 on every dispatch attempt.

Branch logic (per Eddie's spec):
    known_a_plus_in_district  → flag candidate (E15) + DM with major-donor link
    known_b_in_district       → DM with WinRed link voiced via E48
    voter_match_no_history    → DM with district-specific volunteer ask
    unknown_in_district       → DM with enrichment form + soft donate
    out_of_district           → polite generic DM, no resources spent
    skipped_low_confidence    → no action, log only

Every step is gated by:
    - TCPA compliance (shared.compliance.tcpa_gate)
    - FEC disclaimer (shared.compliance.fec_disclaimer)
    - E61 throttle (skip if candidate's IG DM channel is paused)
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social branched-response identity-resolver branch-decision e08 e48 dispatch tcpa fec


from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class RouteDecision:
    branch: str
    template_id: uuid.UUID | None
    attribution_code: str | None
    escalate_to_human: bool
    skip_reason: str | None = None


class ResponseRouter:
    def __init__(
        self,
        db: Any,
        identity_resolver,
        tcpa_gate,
        disclaimer_service,
        cost_emitter,
        meta_dm_client,
    ):
        self.db = db
        self.identity_resolver = identity_resolver
        self.tcpa_gate = tcpa_gate
        self.disclaimer_service = disclaimer_service
        self.cost_emitter = cost_emitter
        self.meta_dm_client = meta_dm_client

    def process(self, event_id: uuid.UUID) -> None:
        event = self._load_event(event_id)
        if not event:
            logger.warning("event %s not found", event_id)
            return

        if event["processing_state"] != "queued":
            logger.info("event %s already in state %s; skipping", event_id, event["processing_state"])
            return

        self._mark_state(event_id, "resolving")

        # 1. Throttle check — is this candidate's IG DM channel paused?
        if self._is_paused(event["candidate_id"], "send_dm_instagram"):
            self._mark_state(event_id, "skipped", error="channel paused by E61 throttle")
            return

        # 2. Identity resolution
        from shared.identity_resolution.resolver import ResolverInput
        ri = ResolverInput(
            candidate_id=uuid.UUID(str(event["candidate_id"])),
            handle=event["commenter_handle"],
            display_name=event["commenter_display_name"],
            platform=event["source_platform"],
        )
        resolution = self.identity_resolver.resolve(ri)
        self._update_resolution(event_id, resolution)

        # 3. Keyword match
        keyword_match = self._match_keyword(
            candidate_id=event["candidate_id"],
            comment_text=event["comment_text"] or "",
        )
        if not keyword_match:
            self._mark_state(event_id, "skipped", error="no keyword match")
            return

        # 4. Branch selection
        decision = self._select_branch(
            resolution=resolution,
            keyword_match=keyword_match,
        )
        self._update_branch(event_id, decision.branch)

        if decision.skip_reason:
            self._mark_state(event_id, "skipped", error=decision.skip_reason)
            return

        # 5. TCPA gate
        from shared.compliance.tcpa_gate import GateRequest, GateDecision
        gate_req = GateRequest(
            candidate_id=uuid.UUID(str(event["candidate_id"])),
            contact_id=uuid.UUID(str(resolution.contact_id)) if resolution.contact_id else None,
            rncid=resolution.rncid,
            channel=f"dm_{event['source_platform']}",
            is_marketing=(decision.branch != "out_of_district"),
        )
        gate_result = self.tcpa_gate.evaluate(gate_req)
        if gate_result.decision == GateDecision.BLOCK:
            self._mark_state(event_id, "skipped", error=f"tcpa_block: {gate_result.reason}")
            return

        # 6. Render and dispatch
        try:
            self._dispatch_dm(
                event=event,
                decision=decision,
                resolution=resolution,
                gate_result=gate_result,
                keyword_match=keyword_match,
            )
            self._mark_state(event_id, "dispatched")
        except Exception as e:
            logger.exception("dispatch failed for event %s", event_id)
            self._mark_state(event_id, "failed", error=str(e))

    # -- branch logic --------------------------------------------------------

    def _select_branch(self, *, resolution, keyword_match) -> RouteDecision:
        if not resolution.success:
            return RouteDecision(
                branch="unknown_in_district",
                template_id=keyword_match.get("unknown_template_id"),
                attribution_code=keyword_match.get("attribution_code"),
                escalate_to_human=False,
            )

        if not resolution.district_match:
            return RouteDecision(
                branch="out_of_district",
                template_id=keyword_match.get("out_of_district_template_id"),
                attribution_code=None,
                escalate_to_human=False,
            )

        grade = (resolution.grade or "").upper()
        if grade in ("A++", "A+"):
            return RouteDecision(
                branch="known_a_plus_in_district",
                template_id=keyword_match.get("major_donor_template_id"),
                attribution_code=keyword_match.get("major_donor_attribution_code"),
                escalate_to_human=True,
            )
        if grade.startswith(("A", "B")):
            return RouteDecision(
                branch="known_b_in_district",
                template_id=keyword_match.get("mid_donor_template_id"),
                attribution_code=keyword_match.get("attribution_code"),
                escalate_to_human=False,
            )

        # Voter file match, no donor history (or low-grade donor)
        return RouteDecision(
            branch="voter_match_no_history",
            template_id=keyword_match.get("voter_template_id"),
            attribution_code=keyword_match.get("attribution_code"),
            escalate_to_human=False,
        )

    # -- helpers -------------------------------------------------------------

    def _load_event(self, event_id: uuid.UUID) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM e19_dm.comment_events WHERE id = %(id)s",
            {"id": str(event_id)},
        )

    def _is_paused(self, candidate_id: str, action_type: str) -> bool:
        row = self.db.fetch_one(
            """
            SELECT throttle_state FROM e61.automation_throttles
             WHERE candidate_id = %(cand)s AND action_type = %(at)s
            """,
            {"cand": str(candidate_id), "at": action_type},
        )
        return bool(row and row["throttle_state"] == "pause")

    def _match_keyword(self, *, candidate_id, comment_text: str) -> dict | None:
        text_lower = comment_text.lower()
        rows = self.db.fetch_all(
            """
            SELECT keyword, intent_class, response_template_id, priority
              FROM e19_dm.keyword_configs
             WHERE candidate_id = %(cand)s
               AND is_active = TRUE
             ORDER BY priority DESC
            """,
            {"cand": str(candidate_id)},
        )
        for r in rows:
            if r["keyword"].lower() in text_lower:
                # Production: template_id branches per donor grade live in
                # e08.template_collections; this simplified return uses one template_id
                return {
                    "keyword": r["keyword"],
                    "intent_class": r["intent_class"],
                    "major_donor_template_id": r["response_template_id"],
                    "mid_donor_template_id": r["response_template_id"],
                    "voter_template_id": r["response_template_id"],
                    "unknown_template_id": r["response_template_id"],
                    "out_of_district_template_id": r["response_template_id"],
                    "attribution_code": f"e19_social_dm_{r['intent_class']}",
                    "major_donor_attribution_code": f"e19_social_dm_{r['intent_class']}_a_plus",
                }
        return None

    def _mark_state(self, event_id, state, error: str | None = None) -> None:
        self.db.execute(
            """
            UPDATE e19_dm.comment_events
               SET processing_state = %(state)s,
                   processing_state_at = NOW(),
                   processing_error = %(err)s
             WHERE id = %(id)s
            """,
            {"id": str(event_id), "state": state, "err": error},
        )

    def _update_resolution(self, event_id, resolution) -> None:
        self.db.execute(
            """
            UPDATE e19_dm.comment_events
               SET resolved_contact_id = %(cid)s,
                   resolved_rncid = %(rncid)s,
                   resolved_grade = %(grade)s,
                   resolved_district_match = %(dm)s,
                   identity_match_score = %(score)s
             WHERE id = %(id)s
            """,
            {
                "id": str(event_id),
                "cid": str(resolution.contact_id) if resolution.contact_id else None,
                "rncid": resolution.rncid,
                "grade": resolution.grade,
                "dm": resolution.district_match,
                "score": resolution.confidence,
            },
        )

    def _update_branch(self, event_id, branch: str) -> None:
        self.db.execute(
            """
            UPDATE e19_dm.comment_events
               SET matched_intent_class = %(intent)s,
                   branch_taken = %(branch)s
             WHERE id = %(id)s
            """,
            {"id": str(event_id), "intent": branch.split("_")[0], "branch": branch},
        )

    def _dispatch_dm(self, *, event, decision, resolution, gate_result, keyword_match) -> None:
        # Render template via E08 + voice match via E48 (skipped here; production wiring)
        rendered_body = self._render_template(
            template_id=decision.template_id,
            candidate_id=event["candidate_id"],
            attribution_code=decision.attribution_code,
            include_opt_in=gate_result.must_include_opt_in_language,
            include_stop=gate_result.must_include_stop_keyword,
        )
        disclaimer = self.disclaimer_service.render(
            uuid.UUID(str(event["candidate_id"])), channel="dm_short_form"
        )
        final_body = f"{rendered_body}\n\n{disclaimer.short_form}"

        # Insert dispatched row first (for cost emission idempotency)
        dm_row = self.db.fetch_one(
            """
            INSERT INTO e19_dm.dm_dispatched (
                candidate_id, comment_event_id,
                destination_platform, destination_user_id,
                template_id, rendered_body,
                attribution_code,
                tcpa_consent_captured, tcpa_opt_in_method,
                fec_disclaimer_version,
                cost_event_id
            ) VALUES (
                %(cand)s, %(eid)s,
                %(plat)s, %(uid)s,
                %(tpl)s, %(body)s,
                %(attr)s,
                %(consent)s, %(method)s,
                %(disc_v)s,
                %(cost)s
            )
            RETURNING id
            """,
            {
                "cand": str(event["candidate_id"]),
                "eid": str(event["id"]),
                "plat": event["source_platform"],
                "uid": event["external_commenter_id"],
                "tpl": str(decision.template_id) if decision.template_id else None,
                "body": final_body,
                "attr": decision.attribution_code,
                "consent": gate_result.opt_in_method is not None,
                "method": gate_result.opt_in_method.value if gate_result.opt_in_method else None,
                "disc_v": disclaimer.version,
                "cost": "00000000-0000-0000-0000-000000000000",   # placeholder, updated post-emit
            },
        )
        dm_id = uuid.UUID(str(dm_row["id"]))

        # Emit cost to E61
        cost_id = self.cost_emitter.emit_cost(
            ecosystem_code="E19_social",
            action_type=f"send_dm_{event['source_platform']}",
            source_table="e19_dm.dm_dispatched",
            source_id=dm_id,
            units=1,
            segment={
                "grade": resolution.grade,
                "district_match": resolution.district_match,
                "keyword": keyword_match["keyword"],
            },
            idempotency_key=f"e19_social:dm:{dm_id}",
        )

        # Update DM row with real cost_event_id
        self.db.execute(
            "UPDATE e19_dm.dm_dispatched SET cost_event_id = %(cid)s WHERE id = %(id)s",
            {"cid": str(cost_id), "id": str(dm_id)},
        )

        # Send via Meta API
        self.meta_dm_client.send(
            platform=event["source_platform"],
            recipient_id=event["external_commenter_id"],
            text=final_body,
        )

        # Mark dispatched
        self.db.execute(
            """
            UPDATE e19_dm.dm_dispatched
               SET delivery_status = 'delivered',
                   delivery_status_at = NOW()
             WHERE id = %(id)s
            """,
            {"id": str(dm_id)},
        )

    def _render_template(self, *, template_id, candidate_id, attribution_code,
                         include_opt_in, include_stop) -> str:
        # Production path: E08 → E48 voice DNA → final string.
        # Scaffold: stub renderer. Real integration is a separate deliverable.
        base = "Hi! Thanks for the comment. Click here to learn more."
        if attribution_code:
            base += f" (ref: {attribution_code})"
        if include_opt_in:
            base += "\nReply YES to receive updates."
        if include_stop:
            base += " Reply STOP to opt out."
        return base
