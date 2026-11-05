"""
ECO_CANONICAL/E41/code/e41_wizard_workflow.py

E41 — HubSpot AI Campaign Wizard parity: compiler + per-donor scheduler

WHAT THIS ADDS (and what e41_journey_engine.py already had)
  e41_journey_engine.py (2026-07-28) walks a journey tree depth-first and
  proposes EVERY weapon tile for EVERY entrant. Its §H comment says wait/split/
  filter are "handled by the scheduler, not here". That scheduler never existed.
  This file is it.

  1. StrategyAdvisor   — Step 1: target donor-group size, optimal weapon mix,
                          computed from core.donor_profile reachability. Never
                          invents a donor set: it counts the filter the candidate
                          chose (a donor group is a QUERY over tattoos — Ed 07-28).
  2. WorkflowDSL       — Step 4: parse/validate the canvas JSON (nodes + edges).
  3. compile_session   — Step 4 Approve & Publish: DSL -> e41.journey_definition
                          + journey_tile (weapon/wait/split/filter/exit) +
                          entry_source + control_state(off) + wizard.campaigns.
                          Result status = 'draft', wizard_approved = FALSE.
                          NOTHING IS LIVE. ("saved/queued/authorized are never live")
  4. enroll            — put donors on the first tile (e41.journey_position).
  5. Scheduler.advance — drain e41.v_journey_position_due: weapon -> propose via
                          e41_journey_engine.propose_step (dark by default);
                          wait -> wait_until; split -> PredicateEvaluator picks
                          the yes/no child; filter -> continue or exit; exit -> exit.

BOUNDARIES (unchanged from E41_CAMPAIGN_BUILDER_SCHEMA_V1 and the journey engine)
  - E41 sequences; E20 decides and dispatches. We never write brain.weapon_queue
    unless e41_journey_engine.PROPOSALS_ENABLED is True, and never write
    journey.weapon_journey at all — that is E20's ledger. Predicates READ it.
  - E41 never writes ml.donor_fingerprint (Ed Ruling Option A, 2026-07-25).
  - Vocabulary: donor group, never "microsegment" (Ed 2026-07-27). Existing
    column names on read-only tables are used as-is.

DB adapter contract (same as e41_journey_engine): fetchall/fetchone return dict
rows, execute returns rowcount. PgDB below wraps psycopg 3.

Canary: cluster 372171 -> 147 txns / $332,631.30
"""
from __future__ import annotations

import json
import logging
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e41_journey_engine as engine  # noqa: E402  (same lane; reuse, don't fork)

logger = logging.getLogger("e41.wizard_workflow")

WEAPON_ECOSYSTEM = {  # mirrors e41.action_catalog weapon rows
    "EMAIL": ("E30", "EXEC_E30_SEND"),
    "SMS": ("E31", "EXEC_E31_SEND"),
    "RVM": ("E17", "EXEC_E17_SEND"),
    "POSTCARD": ("E33", "EXEC_E33_SEND"),
    "SOCIAL": ("E19", "EXEC_E19_POST"),
    "PUSH": ("E67", "EXEC_E67_PUSH"),
    "PHONE": ("E32", "EXEC_E32_QUEUE"),
}
REACH_COLUMN = {  # which core.donor_profile column proves a weapon can reach the donor
    "EMAIL": "personal_email", "SMS": "cell_phone", "RVM": "cell_phone",
    "PHONE": "cell_phone", "POSTCARD": "street_line_1", "SOCIAL": "personal_email",
    "PUSH": "cell_phone",
}
SUPPRESSION_COLUMN = {
    "EMAIL": "s_email_unsubscribed_flag", "SMS": "s_sms_stop_flag",
    "RVM": "s_phone_dnc_flag", "PHONE": "s_phone_dnc_flag",
}
MAX_HOPS = 64
PREFERRED = "PREFERRED"            # SEND_PREFERRED: weapon resolved per donor at run time
TELEPHONY_WEAPONS = {"SMS", "MMS", "RVM", "PHONE", "PUSH"}   # R4_TIME_WINDOW guard group — quiet hours are a compliance block here

# Channel token (e59.microsegment_faction_crosswalk.primary_channel) -> weapon_code
CHANNEL_TOKEN_TO_WEAPON = {"email": "EMAIL", "sms": "SMS", "mms": "MMS", "rvm": "RVM", "mail": "POSTCARD",
                           "social": "SOCIAL", "volunteer": "VOLUNTEER", "tv": "TV_RADIO", "broadcast": "BROADCAST",
                           "event": "TOWNHALL", "push": "PUSH", "messenger": "MESSENGER", "ad": "DIGITAL_AD",
                           "personal": "CANDIDATE_PERSONAL", "manager": "MANAGER_PERSONAL", "phone": "PHONE"}


def load_weapon_registry(db) -> Dict[str, Dict[str, Any]]:
    """
    e41.weapon_registry (part-2 dryrun) is the truth for the 16 cannons. When the
    table is absent (part 1 only) fall back to the 7-weapon constants above.
    """
    try:
        rows = db.fetchall("SELECT * FROM e41.weapon_registry WHERE active")
    except Exception:
        rows = []
    if not rows:
        return {w: {"weapon_code": w, "ecosystem_code": e, "executor_code": x, "reach_column": REACH_COLUMN.get(w),
                    "suppression_channel": {"EMAIL": "email", "SMS": "sms", "RVM": "phone", "PHONE": "phone"}.get(w),
                    "addressable": w != "SOCIAL", "channel_token": w.lower()}
                for w, (e, x) in WEAPON_ECOSYSTEM.items()}
    return {r["weapon_code"]: dict(r) for r in rows}
PUBLISH_EVENT = "w_wizard_workflow_published"   # brain.triggers T-W-115


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — DB ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class PgDB:
    """psycopg3 wrapper exposing the fetchall/fetchone/execute contract."""

    def __init__(self, conn):
        self.conn = conn

    def fetchall(self, sql, params=None):
        from psycopg.rows import dict_row
        with self.conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def fetchone(self, sql, params=None):
        rows = self.fetchall(sql, params)
        return rows[0] if rows else None

    def execute(self, sql, params=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — STEP 1: STRATEGY & OBJECTIVE Q&A
# ═══════════════════════════════════════════════════════════════════════════════

_ALLOWED_FILTER_COLUMNS = {
    "grade", "donor_grade_state", "donor_grade_district", "donor_grade_county",
    "county_name", "district_state_house", "district_state_senate", "district_us_house",
    "primary_affinity_issue", "secondary_affinity_issue", "industry_sector",
    "is_super_voter", "is_business_owner", "is_ncgop_donor", "is_trump_donor",
    "religion_modeled_label", "media_market", "controlling_candidate_id",
}


def _filter_to_sql(filter_json: Dict[str, Any]) -> Tuple[str, list]:
    """
    Donor-group filter -> WHERE clause over core.donor_profile.
    {"all": [{"col":"county_name","op":"in","values":["Forsyth","Guilford"]},
             {"col":"grade","op":"in","values":["A","B"]},
             {"col":"is_super_voter","op":"true"}],
     "none":[{"col":"s_global_optout_flag","op":"true"}]}
    Column names are whitelisted; values are bound. Nothing is interpolated.
    """
    clauses, params = [], []
    for group, joiner in (("all", " AND "), ("any", " OR ")):
        sub = []
        for f in filter_json.get(group, []):
            col = f["col"]
            if col not in _ALLOWED_FILTER_COLUMNS and col not in set(SUPPRESSION_COLUMN.values()) | {"s_global_optout_flag"}:
                raise ValueError(f"filter column not allowed: {col}")
            op = f.get("op", "in")
            if op == "in":
                sub.append(f"{col} = ANY(%s)"); params.append(list(f["values"]))
            elif op == "true":
                sub.append(f"{col} IS TRUE")
            elif op == "false":
                sub.append(f"{col} IS NOT TRUE")
            elif op == "not_null":
                sub.append(f"{col} IS NOT NULL")
            else:
                raise ValueError(f"unsupported op: {op}")
        if sub:
            clauses.append("(" + joiner.join(sub) + ")")
    for f in filter_json.get("none", []):
        col = f["col"]
        if col not in _ALLOWED_FILTER_COLUMNS | set(SUPPRESSION_COLUMN.values()) | {"s_global_optout_flag"}:
            raise ValueError(f"filter column not allowed: {col}")
        clauses.append(f"NOT ({col} IS TRUE)")
    return (" AND ".join(clauses) if clauses else "TRUE"), params


def donor_group_size(db, donor_group_keys: List[str], candidate_id: Optional[int] = None) -> int:
    r = db.fetchone(
        "SELECT COUNT(DISTINCT cluster_id) n FROM e59.donor_segment_assignment WHERE microsegment_key = ANY(%s) "
        "  AND NOT COALESCE(do_not_contact, FALSE) AND (%s::int IS NULL OR candidate_id = %s)",
        (donor_group_keys, candidate_id, candidate_id))
    return int(r["n"]) if r else 0


def import_launch_context(db, session_id: str, context_id: str) -> Dict[str, Any]:
    """
    Step 1 shortcut: a donor-group launch context (e59.wizard_launch_context) already
    carries the group, ask ladder, recommended funnel/subject lines and pre-loaded
    cluster_ids. Pull it straight into the wizard session instead of re-asking.
    """
    c = db.fetchone("SELECT * FROM e59.wizard_launch_context WHERE context_id=%s", (context_id,))
    if not c:
        raise ValueError(f"launch context {context_id} not found")
    pre = c.get("pre_loaded_cluster_ids") or []
    strat = {
        "target_group": {"donor_group_keys": [c["microsegment_key"]], "size": int(c.get("donor_count") or len(pre)),
                         "status": "verified", "source": "e59.wizard_launch_context", "quadrant": c.get("quadrant"),
                         "pre_loaded_cluster_ids": list(pre)[:5000]},
        "primary_offer": {"text": c.get("recommended_message_frame"), "ask_tier": None,
                          "asks": {k: c.get(k) for k in ("ask_a_plus_plus", "ask_a_plus", "ask_a", "ask_b", "ask_c")},
                          "recommended_ask_amount": c.get("recommended_ask_amount"),
                          "urgency_window_days": c.get("recommended_urgency_window_days"), "status": "configured"},
        "optimal_mix": {"weapons": [], "status": "recommended", "reason": {"recommended_funnel": c.get("recommended_funnel")}},
        "subject_lines": {"a": c.get("recommended_subject_line_a"), "b": c.get("recommended_subject_line_b")},
        "compliance": {"cleared": c.get("compliance_cleared"), "flags": c.get("compliance_flags")},
    }
    db.execute("UPDATE wizard.wizard_session SET strategy_qa=%s, state='AUDIENCE_SELECTED', updated_at=NOW() WHERE session_id=%s",
               (json.dumps(strat, default=str), session_id))
    return strat


class StrategyAdvisor:
    """
    Fills the Step 1 panel:
      Target Segment Size      -> count of core.donor_profile matching the filter (status 'verified')
      Primary Campaign Offer   -> passthrough of what the candidate typed (status 'configured')
      Optimal Ecosystem Mix    -> weapons ranked by reachable share, minus suppressed (status 'recommended')
    """

    @staticmethod
    def suggest(db, filter_json: Dict[str, Any], offer: Dict[str, Any], top_n: int = 3,
                donor_group_keys: Optional[List[str]] = None, candidate_id: Optional[int] = None) -> Dict[str, Any]:
        """
        filter_json: whitelisted attribute filter over core.donor_profile (tattoo query), and/or
        donor_group_keys: materialized donor groups (e59.donor_segment_assignment). When both are
        given the group list narrows the attribute filter.
        """
        where, params = _filter_to_sql(filter_json)
        if donor_group_keys:
            where += (" AND cluster_id IN (SELECT cluster_id FROM e59.donor_segment_assignment WHERE microsegment_key = ANY(%s) "
                      "AND NOT COALESCE(do_not_contact, FALSE) AND (%s::int IS NULL OR candidate_id = %s))")
            params += [donor_group_keys, candidate_id, candidate_id]
        reach_cols = ", ".join(
            f"COUNT(*) FILTER (WHERE {REACH_COLUMN[w]} IS NOT NULL"
            + (f" AND NOT ({SUPPRESSION_COLUMN[w]} IS TRUE)" if w in SUPPRESSION_COLUMN else "")
            + f") AS reach_{w.lower()}"
            for w in WEAPON_ECOSYSTEM
        )
        row = db.fetchone(
            f"SELECT COUNT(*) AS n, {reach_cols} FROM core.donor_profile WHERE {where}", params
        ) or {"n": 0}
        n = int(row.get("n") or 0)
        reach = {w: int(row.get(f"reach_{w.lower()}") or 0) for w in WEAPON_ECOSYSTEM}
        ranked = sorted(reach.items(), key=lambda kv: kv[1], reverse=True)
        mix = [w for w, c in ranked if c > 0][:top_n]
        return {
            "target_group": {"filter": filter_json, "donor_group_keys": donor_group_keys or [], "size": n,
                             "status": "verified", "source": "core.donor_profile" + (" ∩ e59.donor_segment_assignment" if donor_group_keys else "")},
            "primary_offer": {**offer, "status": "configured"},
            "optimal_mix": {"weapons": mix, "status": "recommended",
                            "reason": {w: {"reachable": reach[w],
                                           "share": round(reach[w] / n, 4) if n else 0.0}
                                       for w in WEAPON_ECOSYSTEM}},
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — STEP 4: WORKFLOW DSL
# ═══════════════════════════════════════════════════════════════════════════════

VALID_KINDS = {"trigger", "send", "wait", "branch", "filter", "webhook", "exit", "goal"}


@dataclass
class Node:
    id: str
    kind: str
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowDSL:
    nodes: Dict[str, Node]
    edges: List[Tuple[str, str, str]]          # (from, to, label) label in {'default','yes','no',<value>}
    smart_send: bool = False
    policy: Dict[str, Any] = field(default_factory=dict)   # HubSpot "Settings" tab -> e41.journey_policy
    known_weapons: Optional[set] = None

    @classmethod
    def parse(cls, dsl: Dict[str, Any], known_weapons: Optional[set] = None) -> "WorkflowDSL":
        nodes: Dict[str, Node] = {}
        for n in dsl.get("nodes", []):
            nid, kind = n["id"], n["kind"]
            if kind not in VALID_KINDS:
                raise ValueError(f"node {nid}: unknown kind {kind}")
            if nid in nodes:
                raise ValueError(f"duplicate node id {nid}")
            nodes[nid] = Node(nid, kind, {k: v for k, v in n.items() if k not in ("id", "kind")})
        edges = []
        for e in dsl.get("edges", []):
            frm, to = e[0], e[1]
            label = e[2] if len(e) > 2 else "default"
            if frm not in nodes or to not in nodes:
                raise ValueError(f"edge {frm}->{to} references unknown node")
            edges.append((frm, to, str(label)))
        wf = cls(nodes, edges, bool(dsl.get("smart_send", False)), dict(dsl.get("policy") or {}), known_weapons)
        wf.validate()
        return wf

    def children(self, nid: str) -> List[Tuple[str, str]]:
        return [(to, lbl) for frm, to, lbl in self.edges if frm == nid]

    def validate(self) -> None:
        triggers = [n for n in self.nodes.values() if n.kind == "trigger"]
        if len(triggers) != 1:
            raise ValueError("exactly one trigger node required")
        if len(self.children(triggers[0].id)) != 1:
            raise ValueError("trigger must have exactly one outgoing edge")
        for n in self.nodes.values():
            ch = self.children(n.id)
            if n.kind == "branch":
                labels = sorted(l for _, l in ch)
                if labels != ["no", "yes"]:
                    raise ValueError(f"branch {n.id} needs exactly one 'yes' and one 'no' edge")
                if "predicate" not in n.params:
                    raise ValueError(f"branch {n.id} needs a predicate")
            elif n.kind in ("exit", "goal"):
                if ch:
                    raise ValueError(f"{n.kind} node {n.id} cannot have children")
            elif n.kind == "send":
                channel = n.params.get("channel")
                if channel != PREFERRED and channel not in (self.known_weapons or set(WEAPON_ECOSYSTEM)):
                    raise ValueError(f"send {n.id}: unknown channel {channel}")
                if len(ch) > 1:
                    raise ValueError(f"send {n.id} may have at most one child")
            elif n.kind == "wait":
                if int(n.params.get("seconds", 0)) <= 0:
                    raise ValueError(f"wait {n.id} needs seconds > 0")
                if len(ch) != 1:
                    raise ValueError(f"wait {n.id} needs exactly one child")
            elif n.kind == "filter":
                if "predicate" not in n.params or len(ch) != 1:
                    raise ValueError(f"filter {n.id} needs a predicate and one child")
        # acyclic (HubSpot workflows are DAGs; loops are modeled by re-enrollment, which we do not allow)
        seen, stack = set(), set()

        def dfs(nid):
            if nid in stack:
                raise ValueError(f"cycle at {nid}")
            if nid in seen:
                return
            stack.add(nid); seen.add(nid)
            for to, _ in self.children(nid):
                dfs(to)
            stack.discard(nid)
        dfs(triggers[0].id)
        unreachable = set(self.nodes) - seen
        if unreachable:
            raise ValueError(f"unreachable nodes: {sorted(unreachable)}")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — COMPILE  (wizard session -> e41 journey)  nothing goes live here
# ═══════════════════════════════════════════════════════════════════════════════

def _tile_for(node: Node, variations: Dict[str, Dict[str, Any]], registry: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    if node.kind == "send":
        ch = node.params["channel"]
        if ch == PREFERRED:
            eco, exec_code = "E41", "EXEC_E41_JOURNEY_STEP"      # resolved per donor by Scheduler._resolve_preferred
        else:
            eco, exec_code = registry[ch]["ecosystem_code"], registry[ch]["executor_code"]
        var = variations.get(node.params.get("variation_id") or ch) or {}
        return {"tile_kind": "weapon", "weapon_code": ch, "ecosystem_code": eco,
                "executor_code": exec_code, "munition_ref": var.get("munition_ref"),
                "ask_tier": node.params.get("ask_tier"),
                "predicate_json": {"node_id": node.id, "variation_id": str(var.get("variation_id") or ""),
                                   "candidates": node.params.get("candidates"), "fallback": node.params.get("fallback"),
                                   "ab_variants": node.params.get("ab_variants")}}
    if node.kind == "wait":
        return {"tile_kind": "wait", "wait_seconds": int(node.params["seconds"]),
                "predicate_json": {"node_id": node.id, "resume_on_event": node.params.get("event")}}
    if node.kind == "branch":
        return {"tile_kind": "split",
                "predicate_json": {"node_id": node.id, "predicate": node.params["predicate"],
                                   "ref": node.params.get("ref"), "window_seconds": node.params.get("window_seconds"),
                                   "attribute": node.params.get("attribute"), "values": node.params.get("values")}}
    if node.kind == "filter":
        return {"tile_kind": "filter",
                "predicate_json": {"node_id": node.id, "predicate": node.params["predicate"],
                                   "ref": node.params.get("ref")}}
    if node.kind == "webhook":
        return {"tile_kind": "webhook", "ecosystem_code": "E55", "executor_code": "EXEC_E55_WEBHOOK",
                "predicate_json": {"node_id": node.id, **node.params}}
    if node.kind in ("exit", "goal"):
        return {"tile_kind": "exit",
                "predicate_json": {"node_id": node.id, "reason": "goal_met" if node.kind == "goal" else node.params.get("reason", "exit")}}
    raise ValueError(node.kind)


def compile_session(db, session_id: str, journey_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Step 4 'Approve & Publish Workflow'. Produces a DRAFT journey.
    Returns {journey_id, campaign_id, tiles, entry_id}. State -> DRY_RUN_READY.
    """
    engine.assert_canary(db)
    s = db.fetchone("SELECT * FROM wizard.wizard_session WHERE session_id = %s", (session_id,))
    if not s:
        raise ValueError(f"wizard session {session_id} not found")
    dsl = s["workflow_dsl"] if isinstance(s["workflow_dsl"], dict) else json.loads(s["workflow_dsl"] or "{}")
    registry = load_weapon_registry(db)
    wf = WorkflowDSL.parse(dsl, set(registry))
    strategy = s["strategy_qa"] if isinstance(s["strategy_qa"], dict) else json.loads(s["strategy_qa"] or "{}")
    variations = {}
    for v in db.fetchall("SELECT * FROM wizard.channel_variation WHERE session_id = %s", (session_id,)):
        variations[str(v["variation_id"])] = v
        variations[v["weapon_code"]] = v

    journey_id = str(uuid.uuid4())
    journey_code = journey_code or f"WIZ_{str(session_id)[:8]}_{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
    db.execute(
        "INSERT INTO e41.journey_definition (journey_id, journey_code, display_name, candidate_id, "
        " authored_by, status, wizard_approved, notes) VALUES (%s,%s,%s,%s,'e68','draft',FALSE,%s)",
        (journey_id, journey_code, (s.get("brief") or {}).get("name") if isinstance(s.get("brief"), dict) else journey_code,
         s.get("candidate_id"), f"compiled from wizard.wizard_session {session_id}"),
    )

    # topological emit: parent tile per node, branch_label from the edge into it
    trigger = next(n for n in wf.nodes.values() if n.kind == "trigger")
    tile_ids: Dict[str, str] = {}
    order = 0
    queue: List[Tuple[str, Optional[str], str]] = [(wf.children(trigger.id)[0][0], None, "default")]
    while queue:
        nid, parent_tile, label = queue.pop(0)
        # e41.journey_tile is a TREE (one parent per tile). A HubSpot canvas is a DAG —
        # two branches may converge on one node. We expand the DAG into a tree: the
        # shared subtree is emitted once under each parent. DSL.validate() already
        # guaranteed there are no cycles, so this terminates.
        node = wf.nodes[nid]
        t = _tile_for(node, variations, registry)
        order += 1
        tid = str(uuid.uuid4())
        tile_ids[f"{nid}@{parent_tile}"] = tid
        db.execute(
            "INSERT INTO e41.journey_tile (tile_id, journey_id, parent_tile_id, branch_label, step_order, "
            " tile_kind, weapon_code, ecosystem_code, executor_code, wait_seconds, predicate_json, munition_ref, ask_tier) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (tid, journey_id, parent_tile, label, order, t["tile_kind"], t.get("weapon_code"),
             t.get("ecosystem_code"), t.get("executor_code"), t.get("wait_seconds"),
             json.dumps(t.get("predicate_json", {})), t.get("munition_ref"), t.get("ask_tier")),
        )
        for to, lbl in wf.children(nid):
            queue.append((to, tid, lbl))

    # entry source: the publish trigger (brain) + the donor-group filter as manual_list seed
    entry_id = str(uuid.uuid4())
    tg = (strategy.get("target_group") or {})
    db.execute(
        "INSERT INTO e41.entry_source (entry_id, journey_id, entry_kind, brain_trigger_id, filter_json, enabled) "
        "VALUES (%s,%s,'brain_trigger',%s,%s,FALSE)",
        (entry_id, journey_id, trigger.params.get("event", PUBLISH_EVENT),
         json.dumps({"donor_group_filter": tg.get("filter", {}), "expected_size": tg.get("size")})),
    )
    db.execute(
        "INSERT INTO e41.control_state (journey_id, mode, changed_by, change_reason) VALUES (%s,'off','e68','compiled by wizard') "
        "ON CONFLICT (journey_id) DO NOTHING", (journey_id,))
    _write_policy(db, journey_id, wf.policy)

    # wizard.campaigns row — its candidate_id lane is UUID; written only when the session carries one
    campaign_id = None
    weapons = sorted({n.params["channel"] for n in wf.nodes.values() if n.kind == "send"})
    if s.get("candidate_uuid"):
        campaign_id = str(uuid.uuid4())
        name = (s.get("brief") or {}).get("name", journey_code) if isinstance(s.get("brief"), dict) else journey_code
        db.execute(
            "INSERT INTO wizard.campaigns (id, candidate_id, campaign_name, campaign_code, status, step_completed, "
            " campaign_type, weapons, universe_size, wizard_session_id, channel_waterfall_json) "
            "VALUES (%s,%s,%s,%s,'draft',4,'wizard_v4',%s,%s,%s,%s)",
            (campaign_id, str(s["candidate_uuid"]), name, journey_code, json.dumps(weapons), tg.get("size"),
             session_id, json.dumps(dsl)),
        )
    db.execute(
        "UPDATE wizard.wizard_session SET journey_id=%s, campaign_id=%s, current_step=4, state='DRY_RUN_READY', "
        " smart_send=%s, updated_at=NOW() WHERE session_id=%s",
        (journey_id, campaign_id, wf.smart_send, session_id))
    if campaign_id:
        db.execute("UPDATE e41.journey_definition SET notes = notes || ' campaign=' || %s WHERE journey_id=%s", (campaign_id, journey_id))
    engine.assert_canary(db)
    return {"journey_id": journey_id, "journey_code": journey_code, "campaign_id": campaign_id,
            "tiles": len(tile_ids), "entry_id": entry_id, "state": "DRY_RUN_READY"}


_POLICY_COLS = {"goal_predicate", "unenroll_on_goal", "unenroll_siblings", "re_enrollment", "re_enrollment_days",
                "quiet_hours_start", "quiet_hours_end", "allowed_weekdays", "honor_blackout", "max_touches_per_day",
                "max_touches_total", "honor_suppression", "suppressed_action", "preferred_candidates",
                "preferred_fallback", "ab_experiment_id"}


def _write_policy(db, journey_id: str, policy: Dict[str, Any]) -> None:
    """DSL 'policy' block -> e41.journey_policy (defaults for anything not given). No-op if part 2 is not applied."""
    try:
        db.fetchone("SELECT 1 FROM e41.journey_policy LIMIT 1")
    except Exception:
        return
    cols = {k: v for k, v in policy.items() if k in _POLICY_COLS}
    names = ["journey_id"] + list(cols)
    db.execute(
        f"INSERT INTO e41.journey_policy ({', '.join(names)}) VALUES ({', '.join(['%s'] * len(names))}) "
        "ON CONFLICT (journey_id) DO NOTHING",
        [journey_id] + [v for v in cols.values()])


def load_policy(db, journey_id: str) -> Dict[str, Any]:
    try:
        r = db.fetchone("SELECT * FROM e41.journey_policy WHERE journey_id=%s", (journey_id,))
    except Exception:
        r = None
    return dict(r) if r else {"goal_predicate": "DONATED", "unenroll_on_goal": True, "unenroll_siblings": False,
                              "re_enrollment": "never", "quiet_hours_start": 21, "quiet_hours_end": 8,
                              "allowed_weekdays": [1, 2, 3, 4, 5, 6, 7], "honor_blackout": True,
                              "max_touches_per_day": 1, "max_touches_total": 6, "honor_suppression": True,
                              "suppressed_action": "skip_tile", "preferred_candidates": ["EMAIL", "SMS", "POSTCARD"],
                              "preferred_fallback": "EMAIL"}


def request_authorization(db, session_id: str, by: str) -> None:
    """Staff 'Approve & Publish' click. Moves to AUTHORIZATION_REQUIRED; Ed's phrase is still needed."""
    db.execute("UPDATE wizard.wizard_session SET state='AUTHORIZATION_REQUIRED', approved_by=%s, approved_at=NOW() "
               "WHERE session_id=%s AND state='DRY_RUN_READY'", (by, session_id))


def authorize(db, session_id: str, phrase: str, by: str = "ed") -> Dict[str, Any]:
    """Only Ed's exact phrase approves the journey. Still not live: control_state stays 'off'."""
    if phrase != "I AUTHORIZE THIS ACTION":
        return {"status": "refused", "reason": "exact phrase required"}
    s = db.fetchone("SELECT journey_id FROM wizard.wizard_session WHERE session_id=%s", (session_id,))
    db.execute("UPDATE e41.journey_definition SET status='approved', wizard_approved=TRUE, wizard_approved_by=%s, "
               "wizard_approved_at=NOW(), updated_at=NOW() WHERE journey_id=%s", (by, s["journey_id"]))
    db.execute("UPDATE wizard.wizard_session SET state='AUTHORIZED', updated_at=NOW() WHERE session_id=%s", (session_id,))
    return {"status": "authorized", "journey_id": str(s["journey_id"]), "control_mode": "off"}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — ENROLL
# ═══════════════════════════════════════════════════════════════════════════════

def enroll(db, journey_id: str, run_id: str, cluster_ids: List[int], trace_id: str, smart_send: bool = False) -> int:
    first = db.fetchone(
        "SELECT tile_id FROM e41.journey_tile WHERE journey_id=%s AND parent_tile_id IS NULL AND enabled ORDER BY step_order LIMIT 1",
        (journey_id,))
    if not first:
        return 0
    pol = load_policy(db, journey_id)
    try:
        suppressed = {r["cluster_id"] for r in db.fetchall(
            "SELECT cluster_id FROM e41.journey_suppression WHERE journey_id=%s", (journey_id,))}
    except Exception:
        suppressed = set()
    n = 0
    for cid in cluster_ids:
        if cid in suppressed:
            continue
        offset = _smart_send_offset(db, cid) if smart_send else 0
        # re-enrollment policy (HubSpot: per-trigger re-enrollment). 'never' = UNIQUE does the work.
        if pol.get("re_enrollment") in ("after_exit", "after_days"):
            prev = db.fetchone("SELECT state, last_advanced_at FROM e41.journey_position WHERE journey_id=%s AND cluster_id=%s",
                               (journey_id, cid))
            if prev and prev["state"] in ("exited", "completed", "suppressed", "failed"):
                ok = pol["re_enrollment"] == "after_exit" or (
                    prev["last_advanced_at"] <= datetime.now(timezone.utc) - timedelta(days=int(pol.get("re_enrollment_days") or 0)))
                if ok:
                    db.execute("DELETE FROM e41.journey_position WHERE journey_id=%s AND cluster_id=%s", (journey_id, cid))
        n += db.execute(
            "INSERT INTO e41.journey_position (journey_id, run_id, cluster_id, current_tile_id, state, "
            " smart_send_offset_seconds, bgop_trace_id) VALUES (%s,%s,%s,%s,'active',%s,%s) "
            "ON CONFLICT (journey_id, cluster_id) DO NOTHING",
            (journey_id, run_id, cid, first["tile_id"], offset, trace_id)) or 0
    return n


def enroll_from_donor_groups(db, journey_id: str, run_id: str, donor_group_keys: List[str], trace_id: str,
                             candidate_id: Optional[int] = None, limit: int = 500, smart_send: bool = False) -> int:
    """
    Donor-group entry (HubSpot list-based enrollment). A donor group is a query over tattoos;
    e59.donor_segment_assignment is its materialization (265,779 rows live 2026-10-02).
    do_not_contact rows are never enrolled.
    """
    rows = db.fetchall(
        "SELECT DISTINCT cluster_id FROM e59.donor_segment_assignment WHERE microsegment_key = ANY(%s) "
        "  AND NOT COALESCE(do_not_contact, FALSE) AND (%s::int IS NULL OR candidate_id = %s) LIMIT %s",
        (donor_group_keys, candidate_id, candidate_id, limit))
    return enroll(db, journey_id, run_id, [r["cluster_id"] for r in rows], trace_id, smart_send)


def _smart_send_offset(db, cluster_id: int, peak_local_hour: int = 10) -> int:
    """
    AI Smart-Send v0: shift each send to the donor's local peak hour using
    core.donor_profile.timezone_utc_offset. Returns seconds to add to 'now' at
    send time (0..86399). Per-donor observed peak activity (E06) replaces this
    constant once outcome.* has enough opens — hook, not a model.
    """
    r = db.fetchone("SELECT timezone_utc_offset FROM core.donor_profile WHERE cluster_id=%s", (cluster_id,))
    try:
        off = float(r["timezone_utc_offset"]) if r and r["timezone_utc_offset"] is not None else -5.0
    except (TypeError, ValueError):
        off = -5.0
    now = datetime.now(timezone.utc) + timedelta(hours=off)
    target = now.replace(hour=peak_local_hour, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return int((target - now).total_seconds())


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION F — PREDICATES  (read E20's ledger; never vendor callbacks)
# ═══════════════════════════════════════════════════════════════════════════════

class PredicateEvaluator:
    def __init__(self, db):
        self.db = db
        self._cat = {r["predicate_code"]: r for r in db.fetchall("SELECT * FROM e41.predicate_catalog")}

    def evaluate(self, pred: Dict[str, Any], cluster_id: int, send_refs: Dict[str, Any]) -> bool:
        code = pred.get("predicate")
        spec_row = self._cat.get(code)
        if not spec_row:
            raise ValueError(f"unknown predicate {code}")
        spec = spec_row["eval_spec"] if isinstance(spec_row["eval_spec"], dict) else json.loads(spec_row["eval_spec"])
        src = spec_row["source"]
        ref = send_refs.get(pred.get("ref") or "", {}) if pred.get("ref") else {}

        if src == "weapon_journey":
            col = spec["column"]
            if spec.get("any_weapon"):
                r = self.db.fetchone(
                    f"SELECT 1 FROM journey.weapon_journey wj JOIN e41.journey_step_log sl ON sl.e20_weapon_id = wj.weapon_queue_id "
                    f"WHERE sl.cluster_id=%s AND sl.run_id=%s AND wj.{col} IS NOT NULL LIMIT 1",
                    (cluster_id, pred.get("_run_id")))
                return bool(r)
            wq = ref.get("e20_weapon_id")
            if not wq:
                return False                      # dark mode / never dispatched -> HubSpot 'No' branch
            r = self.db.fetchone(
                f"SELECT {col} FROM journey.weapon_journey WHERE weapon_queue_id=%s AND cluster_id=%s", (wq, cluster_id))
            if not r or r[col] is None:
                return False
            win = pred.get("window_seconds")
            if win and ref.get("proposed_at"):
                return r[col] <= datetime.fromisoformat(ref["proposed_at"]) + timedelta(seconds=int(win))
            return True

        if src == "event_queue":
            since = ref.get("proposed_at")
            r = self.db.fetchone(
                "SELECT 1 FROM brain.event_queue WHERE donor_id=%s AND event_type=%s AND created_at >= COALESCE(%s::timestamptz, '-infinity') LIMIT 1",
                (cluster_id, spec["event_type"], since))
            return bool(r)

        if src == "donor_profile":
            col = spec["column"]
            if col == "$attribute":
                col = pred.get("attribute")
                if col not in _ALLOWED_FILTER_COLUMNS:
                    raise ValueError(f"attribute not allowed: {col}")
                r = self.db.fetchone(f"SELECT 1 FROM core.donor_profile WHERE cluster_id=%s AND {col} = ANY(%s)",
                                     (cluster_id, list(pred.get("values") or [])))
                return bool(r)
            op = spec.get("op", "not_null")
            cond = {"not_null": f"{col} IS NOT NULL", "true": f"{col} IS TRUE", "false": f"{col} IS NOT TRUE"}[op]
            r = self.db.fetchone(f"SELECT 1 FROM core.donor_profile WHERE cluster_id=%s AND {cond}", (cluster_id,))
            return bool(r)

        raise ValueError(f"unsupported predicate source {src}")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION G — SCHEDULER  (the part §H of the journey engine deferred)
# ═══════════════════════════════════════════════════════════════════════════════

class Scheduler:
    def __init__(self, db, now: Optional[datetime] = None):
        self.db = db
        self.now = now or datetime.now(timezone.utc)
        self.pe = PredicateEvaluator(db)
        self.registry = load_weapon_registry(db)
        self._policy: Dict[str, Dict[str, Any]] = {}

    def policy(self, journey_id) -> Dict[str, Any]:
        jid = str(journey_id)
        if jid not in self._policy:
            self._policy[jid] = load_policy(self.db, jid)
        return self._policy[jid]

    # -- constraint enforcement (E41 = constraint enforcer role, LP capstone) --
    def _is_suppressed(self, cluster_id: int, weapon: Dict[str, Any], candidate_id) -> Optional[str]:
        ch = weapon.get("suppression_channel")
        r = self.db.fetchone(
            "SELECT suppression_type FROM brain.suppression_list WHERE cluster_id=%s "
            "  AND (channel IS NULL OR channel=%s) AND (candidate_id IS NULL OR candidate_id=%s) "
            "  AND (expires_at IS NULL OR expires_at > %s) LIMIT 1",
            (cluster_id, ch, candidate_id, self.now))
        if r:
            return f"brain.suppression_list:{r['suppression_type']}"
        col = SUPPRESSION_COLUMN.get(weapon["weapon_code"])
        if col:
            r = self.db.fetchone(f"SELECT 1 FROM core.donor_profile WHERE cluster_id=%s AND ({col} IS TRUE OR s_global_optout_flag IS TRUE)",
                                 (cluster_id,))
            if r:
                return f"core.donor_profile.{col}"
        return None

    def _in_blackout(self, candidate_id, weapon_code: str) -> bool:
        try:
            r = self.db.fetchone(
                "SELECT 1 FROM e10.blackout WHERE cleared_at IS NULL AND ("
                "  (scope_type='candidate' AND scope_value=%s) OR (scope_type='weapon' AND scope_value=%s) OR scope_type='platform') LIMIT 1",
                (str(candidate_id) if candidate_id is not None else "", weapon_code))
            return bool(r)
        except Exception:
            return False

    def _local_now(self, cluster_id: int) -> datetime:
        r = self.db.fetchone("SELECT timezone_utc_offset FROM core.donor_profile WHERE cluster_id=%s", (cluster_id,))
        try:
            off = float(r["timezone_utc_offset"]) if r and r["timezone_utc_offset"] is not None else -5.0
        except (TypeError, ValueError):
            off = -5.0
        return self.now + timedelta(hours=off)

    def _quiet_hold_seconds(self, pol: Dict[str, Any], cluster_id: int) -> int:
        """Seconds until the donor's local clock leaves quiet hours / lands on an allowed weekday. 0 = send now."""
        local = self._local_now(cluster_id)
        start, end = int(pol["quiet_hours_start"]), int(pol["quiet_hours_end"])
        in_quiet = (local.hour >= start or local.hour < end) if start > end else (start <= local.hour < end)
        hold = 0
        if in_quiet:
            target = local.replace(hour=end, minute=0, second=0, microsecond=0)
            if target <= local:
                target += timedelta(days=1)
            hold = int((target - local).total_seconds())
        allowed = set(int(d) for d in (pol.get("allowed_weekdays") or [1, 2, 3, 4, 5, 6, 7]))
        probe = local + timedelta(seconds=hold)
        while probe.isoweekday() not in allowed:
            probe = (probe + timedelta(days=1)).replace(hour=end, minute=0, second=0, microsecond=0)
            hold = int((probe - local).total_seconds())
        return hold

    def _fatigue_ceiling_hit(self, cluster_id: int, weapon_code: str) -> Optional[str]:
        """
        Ruling G3 (2026-10-02): journey_policy caps are E41's own floor; e10.fatigue_policy is the
        platform CEILING (live: ALL_CHANNELS 3 touches / 168h, PER_CHANNEL 2 / 168h). Counted across
        EVERY journey for this donor: E41 proposals (e41.journey_step_log) ∪ E20 dispatches
        (brain.weapon_queue.donor_id) ∪ fired touches (brain.channel_fatigue_ledger when present).
        Returns the breached scope or None.
        """
        try:
            rules = self.db.fetchall("SELECT scope, max_touches, window_hours FROM e10.fatigue_policy")
        except Exception:
            return None
        for r in rules:
            since = self.now - timedelta(hours=int(r["window_hours"]))
            per_channel = r["scope"] == "PER_CHANNEL"
            n = int(self.db.fetchone(
                "SELECT COUNT(*) c FROM e41.journey_step_log sl JOIN e41.journey_tile t ON t.tile_id=sl.tile_id "
                "WHERE sl.cluster_id=%s AND sl.proposed_at >= %s AND sl.e20_decision <> 'rejected' "
                "  AND (%s::bool IS FALSE OR t.weapon_code=%s)",
                (cluster_id, since, per_channel, weapon_code))["c"])
            try:
                n += int(self.db.fetchone(
                    "SELECT COUNT(*) c FROM brain.weapon_queue WHERE donor_id=%s AND queued_at >= %s AND status NOT IN ('vetoed','failed') "
                    "  AND (%s::bool IS FALSE OR payload->>'weapon_code'=%s) "
                    "  AND NOT EXISTS (SELECT 1 FROM e41.journey_step_log sl WHERE sl.e20_weapon_id = weapon_queue.weapon_id)",
                    (cluster_id, since, per_channel, weapon_code))["c"])
            except Exception:
                pass
            if n >= int(r["max_touches"]):
                return f"e10.fatigue_policy:{r['scope']}({n}/{r['max_touches']}/{r['window_hours']}h)"
        return None

    def _touches(self, pos, today_only: bool) -> int:
        sql = "SELECT COUNT(*) c FROM e41.journey_step_log WHERE run_id=%s AND cluster_id=%s"
        params: list = [pos["run_id"], pos["cluster_id"]]
        if today_only:
            sql += " AND proposed_at >= %s"; params.append(self.now.replace(hour=0, minute=0, second=0, microsecond=0))
        return int(self.db.fetchone(sql, params)["c"])

    def _resolve_preferred(self, pos, pj: Dict[str, Any], pol: Dict[str, Any], candidate_id) -> Optional[Dict[str, Any]]:
        """
        OMNI-CHANNEL (ruling G4, 2026-10-02): E41 owns resolution; the action socket receives a
        resolved weapon, never PREFERRED.
          order:  group primary_channel -> group secondary_channel -> tile candidates -> policy
                  preferred_candidates -> fallback
          filter at EACH step: in e41.weapon_registry · reachable (reach_column not null) ·
                  not suppressed · not over the PER_CHANNEL fatigue ceiling
          no survivor -> journey_position exits with 'no_eligible_channel' (terminal)
        """
        order: List[str] = []
        try:
            r = self.db.fetchone(
                "SELECT x.primary_channel, x.secondary_channel FROM e59.donor_segment_assignment a "
                "JOIN e59.microsegment_faction_crosswalk x ON x.microsegment_key = a.microsegment_key "
                "WHERE a.cluster_id=%s ORDER BY a.segment_match_score DESC NULLS LAST LIMIT 1", (pos["cluster_id"],))
            for tok in ((r or {}).get("primary_channel"), (r or {}).get("secondary_channel")):
                w = CHANNEL_TOKEN_TO_WEAPON.get((tok or "").lower())
                if w:
                    order.append(w)
        except Exception:
            pass
        order += list(pj.get("candidates") or pol.get("preferred_candidates") or [])
        order.append(pj.get("fallback") or pol.get("preferred_fallback") or "EMAIL")
        seen = set()
        for w in order:
            if w in seen or w not in self.registry:
                continue
            seen.add(w)
            weapon = self.registry[w]
            col = weapon.get("reach_column")
            if col:
                ok = self.db.fetchone(f"SELECT 1 FROM core.donor_profile WHERE cluster_id=%s AND {col} IS NOT NULL", (pos["cluster_id"],))
                if not ok:
                    continue
            if pol.get("honor_suppression", True) and self._is_suppressed(int(pos["cluster_id"]), weapon, candidate_id):
                continue
            if self._fatigue_ceiling_hit(int(pos["cluster_id"]), w) and (self._fatigue_ceiling_hit(int(pos["cluster_id"]), w) or "").find("PER_CHANNEL") >= 0:
                continue                           # per-weapon ceiling: try the next eligible cannon
            return weapon
        return None

    # -- helpers ---------------------------------------------------------------
    def _tile(self, tile_id):
        return self.db.fetchone("SELECT * FROM e41.journey_tile WHERE tile_id=%s", (tile_id,))

    def _child(self, tile_id, label="default"):
        return self.db.fetchone(
            "SELECT tile_id FROM e41.journey_tile WHERE parent_tile_id=%s AND branch_label=%s AND enabled ORDER BY step_order LIMIT 1",
            (tile_id, label))

    def _move(self, pos, next_tile_id, **extra):
        state = "active" if next_tile_id else "completed"
        self.db.execute(
            "UPDATE e41.journey_position SET current_tile_id=%s, state=%s, wait_until=NULL, wait_event=NULL, "
            " hops=hops+1, last_advanced_at=%s, exit_reason=COALESCE(%s, exit_reason) WHERE position_id=%s",
            (next_tile_id, state, self.now, extra.get("exit_reason"), pos["position_id"]))
        return state

    def _exit(self, pos, reason, state="exited"):
        self.db.execute(
            "UPDATE e41.journey_position SET state=%s, exit_reason=%s, last_advanced_at=%s WHERE position_id=%s",
            (state, reason, self.now, pos["position_id"]))
        self._emit(pos, "w_journey_goal_met" if reason == "goal_met" else "w_journey_exited", {"reason": reason})

    def _emit(self, pos, event_type, data):
        """Lifecycle events to E20's queue (T-W-116/117/118). Fire-and-forget."""
        try:
            self.db.execute(
                "INSERT INTO brain.event_queue (event_id, event_type, source_ecosystem, entity_type, entity_id, event_data, donor_id, status, created_at) "
                "VALUES (%s,%s,'E41','journey',%s,%s,%s,'pending',%s)",
                (str(uuid.uuid4()), event_type, str(pos["journey_id"]), json.dumps({**data, "run_id": str(pos["run_id"])}),
                 pos["cluster_id"], self.now))
        except Exception as exc:  # event bus absent in scratch harness
            logger.debug("event emit skipped: %s", exc)

    # -- one hop ---------------------------------------------------------------
    def step(self, pos: Dict[str, Any], journey: Dict[str, Any]) -> str:
        if pos["hops"] >= MAX_HOPS:
            self._exit(pos, "max_hops", "failed"); return "failed"
        tile = self._tile(pos["current_tile_id"]) if pos["current_tile_id"] else None
        if not tile:
            self._exit(pos, "end_of_journey", "completed"); return "completed"
        pj = tile["predicate_json"] if isinstance(tile["predicate_json"], dict) else json.loads(tile["predicate_json"] or "{}")
        refs = pos["send_refs"] if isinstance(pos["send_refs"], dict) else json.loads(pos["send_refs"] or "{}")
        kind = tile["tile_kind"]

        pol = self.policy(pos["journey_id"])
        cand = journey.get("candidate_id")

        # GOAL (HubSpot: unenroll when goal met) — checked on every hop, before any further touch
        if pol.get("unenroll_on_goal") and pol.get("goal_predicate") and pos["hops"] > 0:
            if self.pe.evaluate({"predicate": pol["goal_predicate"], "_run_id": pos["run_id"]}, int(pos["cluster_id"]), refs):
                self._exit(pos, "goal_met", "completed")
                if pol.get("unenroll_siblings"):
                    self.db.execute(
                        "UPDATE e41.journey_position p SET state='exited', exit_reason='goal_met_elsewhere', last_advanced_at=%s "
                        "FROM e41.journey_definition j WHERE j.journey_id=p.journey_id AND p.cluster_id=%s "
                        "  AND p.state IN ('active','waiting') AND p.journey_id<>%s AND j.candidate_id IS NOT DISTINCT FROM %s",
                        (self.now, pos["cluster_id"], pos["journey_id"], cand))
                return "exited"

        if kind == "weapon":
            held_key = f"_held:{pj.get('node_id')}"
            # resolve the cannon (SEND_PREFERRED → per-donor; else registry)
            if tile["weapon_code"] == PREFERRED:
                weapon = self._resolve_preferred(pos, pj, pol, cand)
                if not weapon:
                    # ruling G4: skip_tile + log, do not silently exit; terminal only if nothing follows
                    self.db.execute(
                        "INSERT INTO e41.journey_step_log (run_id, journey_id, tile_id, cluster_id, e20_decision, e20_reason, bgop_trace_id, proposed_at) "
                        "VALUES (%s,%s,%s,%s,'suppressed','no_eligible_channel',%s,%s)",
                        (pos["run_id"], pos["journey_id"], tile["tile_id"], pos["cluster_id"], pos.get("bgop_trace_id") or "", self.now))
                    nxt = self._child(tile["tile_id"])
                    if not nxt:
                        self._exit(pos, "no_eligible_channel"); return "exited"
                    self.db.execute("UPDATE e41.journey_position SET send_refs=%s WHERE position_id=%s",
                                    (json.dumps({**refs, pj.get("node_id", "?"): {"skipped": "no_eligible_channel"}}), pos["position_id"]))
                    return self._move(pos, nxt["tile_id"])
                tile = {**tile, "weapon_code": weapon["weapon_code"], "ecosystem_code": weapon["ecosystem_code"],
                        "executor_code": weapon["executor_code"]}
            else:
                weapon = self.registry.get(tile["weapon_code"]) or {"weapon_code": tile["weapon_code"]}
            # constraints: suppression, blackout, touch caps, quiet hours
            if pol.get("honor_suppression", True) and tile["weapon_code"] != PREFERRED:
                why = self._is_suppressed(int(pos["cluster_id"]), weapon, cand)
                if why:
                    if pol.get("suppressed_action") == "exit_journey":
                        self._exit(pos, f"suppressed:{why}", "suppressed"); return "suppressed"
                    nxt = self._child(tile["tile_id"])
                    self.db.execute("UPDATE e41.journey_position SET send_refs=%s WHERE position_id=%s",
                                    (json.dumps({**refs, pj.get("node_id", "?"): {"skipped": why}}), pos["position_id"]))
                    return self._move(pos, nxt["tile_id"] if nxt else None)
            if pol.get("honor_blackout", True) and self._in_blackout(cand, tile["weapon_code"]):
                self.db.execute("UPDATE e41.journey_position SET state='waiting', wait_until=%s, wait_event='blackout.cleared' WHERE position_id=%s",
                                (self.now + timedelta(hours=6), pos["position_id"]))
                return "waiting"
            if self._touches(pos, today_only=False) >= int(pol.get("max_touches_total") or 10**6):
                self._exit(pos, "max_touches_total"); return "exited"
            why = self._fatigue_ceiling_hit(int(pos["cluster_id"]), tile["weapon_code"])
            if why:
                # ceiling, not a journey rule: hold until the window rolls, do not exit
                self.db.execute("UPDATE e41.journey_position SET state='waiting', wait_until=%s, wait_event='fatigue.window_rolled' WHERE position_id=%s",
                                (self.now + timedelta(hours=24), pos["position_id"]))
                self.db.execute("UPDATE e41.journey_position SET send_refs=%s WHERE position_id=%s",
                                (json.dumps({**refs, f"_fatigue:{pj.get('node_id')}": why}), pos["position_id"]))
                return "waiting"
            if not refs.get(held_key):
                hold = 0
                if weapon.get("addressable", True):
                    hold = self._quiet_hold_seconds(pol, int(pos["cluster_id"]))
                    if hold:   # 3c: telephony = TCPA hard block (R4_TIME_WINDOW guard group); email/mail/social = Smart-Send hold
                        refs[f"_quiet:{pj.get('node_id')}"] = ("tcpa_time_window_block" if tile["weapon_code"] in TELEPHONY_WEAPONS
                                                              else "smart_send_hold")
                    if self._touches(pos, today_only=True) >= int(pol.get("max_touches_per_day") or 10**6):
                        hold = max(hold, int((self.now.replace(hour=23, minute=59, second=59) - self.now).total_seconds()) + 1)
                if pos["smart_send_offset_seconds"]:
                    hold = max(hold, int(pos["smart_send_offset_seconds"]))
                if hold > 0:
                    refs[held_key] = True
                    self.db.execute(
                        "UPDATE e41.journey_position SET state='waiting', wait_until=%s, send_refs=%s WHERE position_id=%s",
                        (self.now + timedelta(seconds=hold), json.dumps(refs), pos["position_id"]))
                    return "waiting"
            res = engine.propose_step(self.db, str(pos["run_id"]), str(pos["journey_id"]), tile,
                                      int(pos["cluster_id"]), cand, pos.get("bgop_trace_id") or "")
            # stamp the proposal with the scheduler clock (fatigue/touch windows are counted on proposed_at)
            self.db.execute(
                "UPDATE e41.journey_step_log SET proposed_at=%s WHERE step_log_id = (SELECT MAX(step_log_id) FROM e41.journey_step_log "
                " WHERE run_id=%s AND cluster_id=%s AND tile_id=%s)", (self.now, pos["run_id"], pos["cluster_id"], tile["tile_id"]))
            refs[pj.get("node_id", str(tile["tile_id"]))] = {
                "tile_id": str(tile["tile_id"]), "weapon_code": tile["weapon_code"],
                "e20_weapon_id": res.get("weapon_id"), "proposed_at": self.now.isoformat()}
            self.db.execute("UPDATE e41.journey_position SET send_refs=%s WHERE position_id=%s",
                            (json.dumps(refs), pos["position_id"]))
            nxt = self._child(tile["tile_id"])
            return self._move(pos, nxt["tile_id"] if nxt else None)

        if kind == "wait":
            if pos["state"] == "active":
                until = self.now + timedelta(seconds=int(tile["wait_seconds"]))
                self.db.execute(
                    "UPDATE e41.journey_position SET state='waiting', wait_until=%s, wait_event=%s, last_advanced_at=%s WHERE position_id=%s",
                    (until, pj.get("resume_on_event"), self.now, pos["position_id"]))
                return "waiting"
            nxt = self._child(tile["tile_id"])            # wait expired (view only returns due rows)
            return self._move(pos, nxt["tile_id"] if nxt else None)

        if kind == "split":
            yes = self.pe.evaluate({**pj, "_run_id": pos["run_id"]}, int(pos["cluster_id"]), refs)
            nxt = self._child(tile["tile_id"], "yes" if yes else "no")
            return self._move(pos, nxt["tile_id"] if nxt else None)

        if kind == "filter":
            if self.pe.evaluate({**pj, "_run_id": pos["run_id"]}, int(pos["cluster_id"]), refs):
                nxt = self._child(tile["tile_id"])
                return self._move(pos, nxt["tile_id"] if nxt else None)
            self._exit(pos, f"filter_failed:{pj.get('predicate')}"); return "exited"

        if kind == "webhook":
            res = engine.propose_step(self.db, str(pos["run_id"]), str(pos["journey_id"]),
                                      {**tile, "weapon_code": "WEBHOOK"}, int(pos["cluster_id"]),
                                      journey.get("candidate_id"), pos.get("bgop_trace_id") or "")
            nxt = self._child(tile["tile_id"])
            return self._move(pos, nxt["tile_id"] if nxt else None)

        if kind == "exit":
            self._exit(pos, pj.get("reason", "exit"), "completed" if pj.get("reason") == "goal_met" else "exited")
            return "exited"
        raise ValueError(kind)

    # -- drain -----------------------------------------------------------------
    def advance(self, journey_id: Optional[str] = None, limit: int = 1000) -> Dict[str, int]:
        """Process every due position. Returns counts by resulting state."""
        engine.assert_canary(self.db)
        # same predicate as e41.v_journey_position_due, but against the scheduler's own clock
        # (injectable for rehearsal; the view uses NOW() for ops dashboards)
        sql = ("SELECT p.*, j.candidate_id FROM e41.journey_position p "
               "JOIN e41.journey_definition j ON j.journey_id = p.journey_id "
               "JOIN e41.control_state c ON c.journey_id = p.journey_id "
               "WHERE j.status='approved' AND j.wizard_approved AND c.mode <> 'off' "
               "  AND (p.state='active' OR (p.state='waiting' AND p.wait_until <= %s))")
        params: list = [self.now]
        if journey_id:
            sql += " AND p.journey_id=%s"; params.append(journey_id)
        sql += " ORDER BY p.last_advanced_at LIMIT %s"; params.append(limit)
        counts: Dict[str, int] = {}
        for pos in self.db.fetchall(sql, params):
            res = self.step(pos, {"candidate_id": pos.get("candidate_id")})
            counts[res] = counts.get(res, 0) + 1
        engine.assert_canary(self.db)
        return counts

    def resume_on_event(self, event_type: str, cluster_id: int) -> int:
        """WAIT_UNTIL_EVENT: an event arrives (e.g. email.opened) -> waiting rows listening for it become due now."""
        return self.db.execute(
            "UPDATE e41.journey_position SET wait_until=%s WHERE state='waiting' AND wait_event=%s AND cluster_id=%s",
            (self.now, event_type, cluster_id)) or 0


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION H — THE DIAGRAM FROM THE WIZARD MOCKUP, in BGOP terms
# ═══════════════════════════════════════════════════════════════════════════════
#  [START: w_wizard_workflow_published] -> Send EMAIL
#        -> Wait 48h -> Did contact open Email?
#               (No)  -> Send POSTCARD (direct mail)
#               (Yes) -> Send SOCIAL retargeting / PUSH
EXAMPLE_DSL = {
    "smart_send": True,
    "policy": {"goal_predicate": "DONATED", "unenroll_on_goal": True, "re_enrollment": "never",
               "quiet_hours_start": 21, "quiet_hours_end": 8, "max_touches_per_day": 1, "max_touches_total": 6},
    "nodes": [
        {"id": "start", "kind": "trigger", "event": PUBLISH_EVENT},
        {"id": "send_email", "kind": "send", "channel": "EMAIL", "variation_id": "EMAIL", "ask_tier": "T2"},
        {"id": "wait_48h", "kind": "wait", "seconds": 172800},
        {"id": "opened", "kind": "branch", "predicate": "EMAIL_OPENED", "ref": "send_email", "window_seconds": 172800},
        {"id": "send_postcard", "kind": "send", "channel": "POSTCARD", "variation_id": "POSTCARD"},
        {"id": "send_social", "kind": "send", "channel": "SOCIAL", "variation_id": "SOCIAL"},
        {"id": "done", "kind": "exit", "reason": "sequence_complete"},
    ],
    "edges": [["start", "send_email"], ["send_email", "wait_48h"], ["wait_48h", "opened"],
              ["opened", "send_postcard", "no"], ["opened", "send_social", "yes"],
              ["send_postcard", "done"], ["send_social", "done"]],
}

# OMNI-CHANNEL variant: the first touch goes out on whatever cannon the donor's group prefers
# (e59 crosswalk primary_channel), falls back through the candidates list; then a 72h wait,
# goal check (policy), and a second-touch on the next-best channel.
EXAMPLE_OMNI_DSL = {
    "smart_send": True,
    "policy": {"goal_predicate": "DONATED", "unenroll_on_goal": True, "unenroll_siblings": True,
               "re_enrollment": "after_days", "re_enrollment_days": 30, "max_touches_per_day": 1, "max_touches_total": 4,
               "preferred_candidates": ["EMAIL", "SMS", "POSTCARD", "RVM", "PHONE"], "preferred_fallback": "POSTCARD"},
    "nodes": [
        {"id": "start", "kind": "trigger", "event": "h_heat_gear2_up"},
        {"id": "touch1", "kind": "send", "channel": "PREFERRED", "ask_tier": "T2"},
        {"id": "wait72", "kind": "wait", "seconds": 259200},
        {"id": "gave", "kind": "branch", "predicate": "DONATED"},
        {"id": "touch2", "kind": "send", "channel": "PREFERRED", "candidates": ["SMS", "RVM", "POSTCARD"], "fallback": "POSTCARD"},
        {"id": "thanks", "kind": "send", "channel": "CANDIDATE_PERSONAL"},
        {"id": "done", "kind": "goal"},
    ],
    "edges": [["start", "touch1"], ["touch1", "wait72"], ["wait72", "gave"],
              ["gave", "thanks", "yes"], ["gave", "touch2", "no"], ["thanks", "done"], ["touch2", "done"]],
}

if __name__ == "__main__":
    print(__doc__)
    wf = WorkflowDSL.parse(EXAMPLE_DSL)
    print(f"EXAMPLE_DSL valid: {len(wf.nodes)} nodes, {len(wf.edges)} edges, smart_send={wf.smart_send}")
    print(f"PROPOSALS_ENABLED = {engine.PROPOSALS_ENABLED} (dark: scheduler walks, step_log fills, weapon_queue untouched)")
