"""
ECO_CANONICAL/E41/code/e41_studio_cannon_adapter.py

ONE StudioCannonAdapter interface, keyed by W-code  (ruling G5, 2026-10-02)

Sources this consolidates (Devin evidence memo MATRIX_G_RULINGS_EVIDENCE_2026-10-02, ruling 5):
  Weapon Studio Spec §9 / §14 / §15 · NES §5.1 / §5.2 · Action Socket doc ·
  live ops.gate_r4_studio_gate_state (studio_id = W-code, execution_mode OBSERVE|…, guard DIGITAL|TELEPHONY|…)
The executor for each W-code comes from e41.weapon_registry. E84 is the library that
finds these documents — it is not a cannon, not an adapter, and has no execution role.

Lifecycle (identical for all 16 cannons; a studio may refine, never skip). Built editors per NES §5.1:
  W01 WaypointEmailAdapter, W05 PdfmePrintAdapter; the other 14 are StubNativeAdapter until a pilot needs them.
    compose(brief, variation, donor_ctx)  -> Munition         (E80/E48 do the writing; adapter shapes the channel payload)
    validate(munition)                    -> list[str]        (channel rules: length, 10DLC, CAN-SPAM footer, print bleed …)
    preview(munition)                     -> dict             (what the Step 3 studio card shows)
    request(munition, proposal)           -> ActionRequest    (the ONE thing E41 hands the socket: POST /api/v2/actions/execute)

Nothing here fires. request() returns the body; the E20 drain owns the POST, and
ops.gate_r4_studio_gate_state.execution_mode='OBSERVE' means the socket records and
does not send. If the gate row is missing for a W-code the adapter refuses.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

ACTION_SOCKET_PATH = "/api/v2/actions/execute"


@dataclass
class Munition:
    w_code: str                      # W01..W16
    weapon_code: str                 # EMAIL, SMS, …  (e41.weapon_registry.weapon_code)
    payload: Dict[str, Any]          # channel-shaped: subject/body, post_copy, headline/qr, script …
    munition_ref: Optional[str] = None   # E08 asset ref once minted
    ask_tier: Optional[str] = None
    compliance_flags: List[str] = field(default_factory=list)


@dataclass
class ActionRequest:
    path: str
    body: Dict[str, Any]
    execution_mode: str              # PREVIEW | OBSERVE | FIRE — FIRE only when gate, executor and Ed's hash all agree


class StudioCannonAdapter:
    """Base: works for every W-code out of the box; subclasses add channel validation."""
    w_code: str = ""

    def __init__(self, db, registry_row: Dict[str, Any]):
        self.db = db
        self.reg = registry_row
        self.w_code = registry_row["w_code"]
        gate = db.fetchone("SELECT execution_mode, guard FROM ops.gate_r4_studio_gate_state WHERE studio_id=%s", (self.w_code,))
        if not gate:
            raise RuntimeError(f"{self.w_code}: no ops.gate_r4_studio_gate_state row — studio is not admitted")
        self.execution_mode = gate["execution_mode"]
        self.guard = gate["guard"]

    # -- lifecycle ----------------------------------------------------------
    def compose(self, brief: Dict[str, Any], variation: Dict[str, Any], donor_ctx: Dict[str, Any]) -> Munition:
        payload = dict(variation.get("payload") or {})
        payload.setdefault("safe_greeting", donor_ctx.get("safe_greeting") or "Friend")
        return Munition(self.w_code, self.reg["weapon_code"], payload,
                        munition_ref=variation.get("munition_ref"), ask_tier=brief.get("ask_tier"))

    def validate(self, m: Munition) -> List[str]:
        errs = []
        if not m.payload:
            errs.append("empty payload")
        if m.compliance_flags:
            errs.append("compliance flags unresolved: " + ",".join(m.compliance_flags))
        return errs

    @staticmethod
    def content_hash(m: Munition) -> str:
        """Immutable authorized package (Weapon Studio Spec §15): Ed authorizes a hash, not a draft."""
        return hashlib.sha256(json.dumps({"w": m.w_code, "p": m.payload, "ref": m.munition_ref, "ask": m.ask_tier},
                                         sort_keys=True, default=str).encode()).hexdigest()

    def preview(self, m: Munition) -> ActionRequest:
        """Socket renders, never sends (mode=PREVIEW)."""
        return ActionRequest(ACTION_SOCKET_PATH, {**self._body(m, {}, None, None), "mode": "PREVIEW"}, "PREVIEW")

    def request(self, m: Munition, proposal: Dict[str, Any], decision_id: Optional[str] = None,
                audience_snapshot_id: Optional[str] = None, ed_authorized_hash: Optional[str] = None) -> ActionRequest:
        """
        proposal = the brain.weapon_queue payload e41_journey_engine.propose_step built.
        mode follows ops.gate_r4_studio_gate_state. FIRE is refused unless ALL of:
          gate_r4_studio_gate_state[studio_id] = FIRE  ·  action_executors[executor_code].enabled  ·
          ed_authorized_hash == content_hash(m)
        otherwise the request is downgraded to OBSERVE (recorded, not sent).
        """
        errs = self.validate(m)
        if errs:
            raise ValueError(f"{self.w_code} munition invalid: {errs}")
        mode = self.execution_mode
        if mode == "FIRE":
            ex = self.db.fetchone("SELECT enabled FROM brain.action_executors WHERE executor_code=%s", (self.reg["executor_code"],))
            if not (ex and ex["enabled"]) or ed_authorized_hash != self.content_hash(m):
                mode = "OBSERVE"
        return ActionRequest(ACTION_SOCKET_PATH, {**self._body(m, proposal, decision_id, audience_snapshot_id), "mode": mode}, mode)

    def _body(self, m, proposal, decision_id, audience_snapshot_id) -> Dict[str, Any]:
        return {
            "decision_id": decision_id,                          # socket is idempotent on this
            "studio_id": m.w_code,
            "executor_code": self.reg["executor_code"],         # from e41.weapon_registry, never hard-coded
            "ecosystem_code": self.reg["ecosystem_code"],
            "guard": self.guard,
            "munition_id": m.munition_ref,
            "content_hash": self.content_hash(m),
            "audience_snapshot_id": audience_snapshot_id,
            "munition": {"ref": m.munition_ref, "payload": m.payload, "ask_tier": m.ask_tier},
            "proposal": proposal,                                 # bgop_trace_id, e41_journey_id, e41_tile_id, e41_run_id
        }


# -- channel refinements (validation only; the lifecycle is the base's) ---------
class EmailAdapter(StudioCannonAdapter):
    def validate(self, m):
        e = super().validate(m)
        if not m.payload.get("subject"): e.append("subject required")
        if "unsubscribe" not in json.dumps(m.payload).lower(): e.append("CAN-SPAM unsubscribe footer required")
        return e


class SmsAdapter(StudioCannonAdapter):
    LIMIT = 160
    def validate(self, m):
        e = super().validate(m)
        if len(m.payload.get("body", "")) > self.LIMIT: e.append(f"body > {self.LIMIT} chars")
        if "stop" not in m.payload.get("body", "").lower(): e.append("10DLC STOP language required")
        return e


class MmsAdapter(SmsAdapter):
    LIMIT = 1600
    def validate(self, m):
        e = super().validate(m)
        if not m.payload.get("media_ref"): e.append("media_ref required for MMS")
        return e


class PostcardAdapter(StudioCannonAdapter):
    def validate(self, m):
        e = super().validate(m)
        if m.payload.get("dimensions") not in ("4x6", "6x9", "6x11"): e.append("dimensions must be 4x6|6x9|6x11")
        if not m.payload.get("headline"): e.append("headline required")
        return e


class SocialAdapter(StudioCannonAdapter):
    def validate(self, m):
        e = super().validate(m)
        if not m.payload.get("platforms"): e.append("platforms required")
        if len(m.payload.get("post_copy", "")) > 280 and "X" in (m.payload.get("platforms") or []): e.append("X copy > 280")
        return e


class PersonalAdapter(StudioCannonAdapter):
    """W14 fires AS the candidate — campaign manager always CC'd (platform rule)."""
    def request(self, m, proposal, **kw):
        req = super().request(m, proposal, **kw)
        req.body["cc_campaign_manager"] = True
        return req


ADAPTERS: Dict[str, type] = {
    "W01": EmailAdapter, "W02": SmsAdapter, "W03": MmsAdapter, "W05": PostcardAdapter, "W06": SocialAdapter,
    "W14": PersonalAdapter,
}


def adapter_for(db, weapon_code: str) -> StudioCannonAdapter:
    """Resolve by weapon_code (what tiles carry) -> registry row -> W-code -> adapter class."""
    row = db.fetchone("SELECT * FROM e41.weapon_registry WHERE weapon_code=%s AND active", (weapon_code,))
    if not row:
        raise KeyError(f"weapon {weapon_code} not in e41.weapon_registry")
    cls = ADAPTERS.get(row["w_code"], StudioCannonAdapter)
    return cls(db, dict(row))
