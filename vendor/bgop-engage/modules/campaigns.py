"""Campaign orchestration — sends via E30 only (not Iterable email API).

FIRE goes only through the Action Execution Socket. OBSERVE is the safe
default. Hardcoded from-addresses are forbidden; brand identity comes from
env / per-candidate config.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Protocol

from backend.python.api.action_socket import (  # type: ignore
    ActionRequest,
    Mode,
)

# Back-compat name. Do not keep a parallel enum.
FiringMode = Mode


class EmailGun(Protocol):
    """E30-shaped send adapter."""

    def send_one(self, **kwargs: Any) -> Any: ...


@dataclass
class Campaign:
    campaign_id: str
    candidate_id: str
    name: str
    channel: str = "email"
    template_ref: Optional[str] = None
    enabled: bool = False
    meta: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SendIntent:
    campaign_id: str
    engage_user_id: str
    to_email: str
    subject: str
    html_body: str
    text_body: str = ""
    from_email: Optional[str] = None
    from_name: Optional[str] = None


def resolve_from_identity(intent: SendIntent) -> tuple[Optional[str], Optional[str]]:
    """Brand identity from intent or runtime env — never a hardcoded mailbox."""
    from_email = intent.from_email or os.environ.get("ENGAGE_FROM_EMAIL") or None
    from_name = intent.from_name or os.environ.get("ENGAGE_FROM_NAME") or None
    return from_email, from_name


def _socket_summary(intent: SendIntent, mode: FiringMode, from_email, from_name) -> Dict[str, Any]:
    """Socket-path summary — no to_email / PII."""
    return {
        "campaign_id": intent.campaign_id,
        "engage_user_id": intent.engage_user_id,
        "subject": intent.subject,
        "from_email": from_email,
        "from_name": from_name,
        "mode": mode.value,
        "vendor_saas": False,
    }


class CampaignOrchestrator:
    """Owns campaign records; FIRE delegates only to ActionSocket.execute."""

    def __init__(
        self,
        email_gun: Optional[EmailGun] = None,
        action_socket: Optional[Any] = None,
        default_mode: FiringMode = FiringMode.OBSERVE,
    ):
        self.email_gun = email_gun
        self.action_socket = action_socket
        self.default_mode = default_mode
        self._campaigns: Dict[str, Campaign] = {}

    def upsert(self, campaign: Campaign) -> Campaign:
        self._campaigns[campaign.campaign_id] = campaign
        return campaign

    def execute_send(
        self,
        intent: SendIntent,
        *,
        mode: Optional[FiringMode] = None,
    ) -> Dict[str, Any]:
        mode = mode or self.default_mode
        if not isinstance(mode, FiringMode):
            mode = FiringMode(mode)
        from_email, from_name = resolve_from_identity(intent)
        campaign = self._campaigns.get(intent.campaign_id)
        socket_summary = _socket_summary(intent, mode, from_email, from_name)

        if mode is FiringMode.FIRE:
            if self.action_socket is None:
                return {"ok": False, "status": "blocked", "error": "socket_required", **socket_summary}
            if campaign is None:
                return {
                    "ok": False,
                    "status": "blocked",
                    "error": "campaign_not_registered",
                    **socket_summary,
                }
            req = ActionRequest(
                candidate_id=campaign.candidate_id,
                cluster_id_pseudonymous=intent.engage_user_id,
                decision_id=f"engage:{intent.campaign_id}:{intent.engage_user_id}",
                event_class="donation.ask",
                weapon="email",
                mode=mode,
            )
            socket_out = self.action_socket.execute(req)
            return {
                "ok": True,
                "status": socket_out.get("status", mode.value),
                "socket": socket_out,
                **socket_summary,
            }

        if self.action_socket is not None:
            req = ActionRequest(
                candidate_id=(campaign.candidate_id if campaign else intent.campaign_id),
                cluster_id_pseudonymous=intent.engage_user_id,
                decision_id=f"engage:{intent.campaign_id}:{intent.engage_user_id}",
                event_class="donation.ask",
                weapon="email",
                mode=mode,
            )
            socket_out = self.action_socket.execute(req)
            return {
                "ok": True,
                "status": socket_out.get("status", mode.value),
                "socket": socket_out,
                **socket_summary,
            }

        local_summary = {
            **socket_summary,
            "to_email": intent.to_email,
        }
        if mode is FiringMode.OBSERVE:
            return {"ok": True, "status": "observed", "would_send": local_summary, "actually_taken": False}
        if mode is FiringMode.PREVIEW:
            return {"ok": True, "status": "preview", "asset": local_summary, "actually_taken": False}
        return {"ok": False, "status": "blocked", "error": "socket_required", **socket_summary}
