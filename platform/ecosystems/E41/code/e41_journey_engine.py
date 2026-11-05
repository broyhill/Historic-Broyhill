"""
backend/python/ecosystems/e41/journey_engine.py

E41 — Campaign Builder / Journey Engine

WHAT THIS DOES
  Walks approved journeys, resolves entry sets, advances donors through tiles,
  and writes a PROPOSAL for every weapon step. It does not fire anything.

WHAT THIS DOES NOT DO
  - Does not POST to any executor endpoint. E20's drain owns dispatch.
  - Does not write ml.donor_fingerprint. Ed Ruling Option A (2026-07-25, ABSOLUTE):
    outcome signals stay in outcome.* only.
  - Does not select donors on its own judgment. Entry sets come from E59
    microsegments or E20 triggers. E41 sequences; it does not target.
  - Does not decide budget, capacity, or fatigue. That is the LP inside E20.

THE HANDOFF
    E41 writes brain.weapon_queue rows with status='queued'
      -> E20 brain_worker.drain_weapon_queue() resolves executor + compliance
      -> E20 dispatches (or suppresses)
      -> E41 reads back the disposition into e41.journey_step_log.e20_decision

DARK BY DEFAULT
    PROPOSALS_ENABLED = False. When dark the engine walks every journey, resolves
    every entry set, logs every step it WOULD propose, and writes zero rows to
    brain.weapon_queue. Same shape as Devin's brain_drain_patch.

BLOCKERS before PROPOSALS_ENABLED = True
  - Ed rules R4 (opponent-donor suppression gate)
  - Ed says "I AUTHORIZE THIS ACTION"
  - e41 schema applied on Hetzner (currently dry-run only)
  - At least one executor with enabled=TRUE and a live handler_endpoint

Sacred canary: cluster 372171 -> 147 txns / $332,631.30
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("e41.journey_engine")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — THE DARK FLAG
# ═══════════════════════════════════════════════════════════════════════════════
#
# FALSE = walk journeys, log intent, write NOTHING to brain.weapon_queue
# TRUE  = write real proposals for E20 to dispatch
#
# Flip only after: R4 ruled, Ed's exact phrase, e41 schema live, one enabled executor.
#
PROPOSALS_ENABLED: bool = False


class E41Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "")          # never hardcode — env only
    EXECUTOR_CODE = "EXEC_E41_JOURNEY_STEP"
    ECOSYSTEM_CODE = "E41"
    CANARY_CLUSTER = 372171
    CANARY_TXNS = 147
    CANARY_TOTAL = 332631.30
    MAX_TILES_PER_WALK = 50          # DAG cycle guard
    DEFAULT_BATCH = 500


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — CANARY
# ═══════════════════════════════════════════════════════════════════════════════

def assert_canary(db) -> None:
    """Raise if the sacred canary has moved. Called before and after any write batch."""
    row = db.fetchone(
        "SELECT COUNT(*) AS txns, ROUND(SUM(norm_amount)::numeric, 2) AS total "
        "FROM raw.ncboe_donations WHERE cluster_id = %s",
        (E41Config.CANARY_CLUSTER,),
    )
    if int(row["txns"]) != E41Config.CANARY_TXNS or float(row["total"]) != E41Config.CANARY_TOTAL:
        raise RuntimeError(
            f"CANARY FAIL: {row['txns']} / {row['total']} "
            f"(expected {E41Config.CANARY_TXNS} / {E41Config.CANARY_TOTAL}) — HALT"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — CONTROL STATE  (off / on / timer)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ControlState:
    journey_id: str
    mode: str                      # 'off' | 'on' | 'timer'
    timer_cron: Optional[str]
    next_run_at: Optional[datetime]
    max_entries_per_run: int
    max_runs_per_day: int


def load_control(db, journey_id: str) -> Optional[ControlState]:
    r = db.fetchone(
        "SELECT journey_id, mode, timer_cron, next_run_at, "
        "       max_entries_per_run, max_runs_per_day "
        "FROM e41.control_state WHERE journey_id = %s",
        (journey_id,),
    )
    if not r:
        return None
    return ControlState(
        journey_id=str(r["journey_id"]),
        mode=r["mode"],
        timer_cron=r.get("timer_cron"),
        next_run_at=r.get("next_run_at"),
        max_entries_per_run=int(r.get("max_entries_per_run") or E41Config.DEFAULT_BATCH),
        max_runs_per_day=int(r.get("max_runs_per_day") or 4),
    )


def set_control_mode(
    db,
    journey_id: str,
    to_mode: str,
    changed_by: str,
    reason: Optional[str] = None,
    timer_cron: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Flip a journey's toggle and REPORT TO E20.

    Ed requirement 2026-07-28: every mode change reports back to E20.
    That is done by writing brain.event_queue, not by a side channel, so the
    Brain sees journey state through the same path it sees everything else.
    """
    if to_mode not in ("off", "on", "timer"):
        raise ValueError(f"mode must be off|on|timer, got {to_mode!r}")
    if to_mode == "timer" and not timer_cron:
        raise ValueError("timer mode requires timer_cron")

    prior = db.fetchone(
        "SELECT mode FROM e41.control_state WHERE journey_id = %s", (journey_id,)
    )
    from_mode = prior["mode"] if prior else None
    trace_id = f"E41_CTRL_{uuid.uuid4().hex[:12]}"

    db.execute(
        """
        INSERT INTO e41.control_state
            (journey_id, mode, timer_cron, changed_by, change_reason, changed_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (journey_id) DO UPDATE SET
            mode          = EXCLUDED.mode,
            timer_cron    = COALESCE(EXCLUDED.timer_cron, e41.control_state.timer_cron),
            changed_by    = EXCLUDED.changed_by,
            change_reason = EXCLUDED.change_reason,
            changed_at    = NOW()
        """,
        (journey_id, to_mode, timer_cron, changed_by, reason),
    )

    # ── REPORT TO E20 ────────────────────────────────────────────────────────
    e20_notified = False
    try:
        db.execute(
            """
            INSERT INTO brain.event_queue (event_type, payload, source_ecosystem, created_at)
            VALUES (%s, %s, %s, NOW())
            """,
            (
                "e41.control_mode_changed",
                json.dumps(
                    {
                        "journey_id": journey_id,
                        "from_mode": from_mode,
                        "to_mode": to_mode,
                        "timer_cron": timer_cron,
                        "changed_by": changed_by,
                        "reason": reason,
                        "bgop_trace_id": trace_id,
                    }
                ),
                E41Config.ECOSYSTEM_CODE,
            ),
        )
        e20_notified = True
        db.execute(
            "UPDATE e41.control_state SET e20_last_reported_mode=%s, "
            "e20_last_reported_at=NOW(), e20_ack_trace_id=%s WHERE journey_id=%s",
            (to_mode, trace_id, journey_id),
        )
    except Exception as exc:
        # Non-fatal: the toggle stands, E20 just was not told. Audit records the miss.
        logger.error("E20 notify failed for journey %s: %s", journey_id, exc)

    db.execute(
        """
        INSERT INTO e41.control_audit
            (journey_id, from_mode, to_mode, changed_by, change_reason, e20_notified, e20_trace_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (journey_id, from_mode, to_mode, changed_by, reason, e20_notified, trace_id),
    )

    logger.info(
        "control: journey %s %s -> %s by %s (e20_notified=%s)",
        journey_id, from_mode, to_mode, changed_by, e20_notified,
    )
    return {
        "journey_id": journey_id,
        "from_mode": from_mode,
        "to_mode": to_mode,
        "e20_notified": e20_notified,
        "bgop_trace_id": trace_id,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — ENTRY RESOLUTION  (E41 sequences; it does not target)
# ═══════════════════════════════════════════════════════════════════════════════

def resolve_entry_set(db, journey_id: str, limit: int) -> List[int]:
    """
    Return cluster_ids entering this journey.

    Sources, in the order they are evaluated:
      segment_membership -> e59.donor_segment_assignment   (E41 IS CHILD OF E59)
      brain_trigger      -> brain.event_queue rows          (E41 IS CHILD OF E20)
      manual_list        -> explicit list in filter_json
      api_call           -> supplied by caller, not resolved here

    E41 never invents a donor set. If the upstream source is empty, the journey
    runs on nothing — that is correct behavior, not a failure.
    """
    entries = db.fetchall(
        "SELECT entry_id, entry_kind, brain_trigger_id, microsegment_key, filter_json "
        "FROM e41.entry_source WHERE journey_id = %s AND enabled = TRUE",
        (journey_id,),
    )
    clusters: List[int] = []
    seen = set()

    for e in entries:
        kind = e["entry_kind"]
        rows = []

        if kind == "segment_membership" and e.get("microsegment_key"):
            rows = db.fetchall(
                "SELECT cluster_id FROM e59.donor_segment_assignment "
                "WHERE microsegment_key = %s LIMIT %s",
                (e["microsegment_key"], limit),
            )
        elif kind == "brain_trigger" and e.get("brain_trigger_id"):
            rows = db.fetchall(
                "SELECT DISTINCT (payload->>'cluster_id')::int AS cluster_id "
                "FROM brain.event_queue "
                "WHERE payload->>'trigger_id' = %s "
                "  AND payload->>'cluster_id' IS NOT NULL "
                "  AND created_at > NOW() - INTERVAL '24 hours' LIMIT %s",
                (e["brain_trigger_id"], limit),
            )
        elif kind == "manual_list":
            fj = e.get("filter_json") or {}
            if isinstance(fj, str):
                fj = json.loads(fj)
            rows = [{"cluster_id": c} for c in fj.get("cluster_ids", [])[:limit]]

        for r in rows:
            cid = r.get("cluster_id")
            if cid is not None and cid not in seen:
                seen.add(cid)
                clusters.append(int(cid))
        if len(clusters) >= limit:
            break

    return clusters[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — TILE WALK
# ═══════════════════════════════════════════════════════════════════════════════

def load_tiles(db, journey_id: str) -> Dict[Optional[str], List[Dict[str, Any]]]:
    """Load tiles as a parent -> children map. Entry tiles have parent_tile_id NULL."""
    rows = db.fetchall(
        "SELECT tile_id, parent_tile_id, branch_label, step_order, tile_kind, "
        "       weapon_code, ecosystem_code, executor_code, wait_seconds, "
        "       predicate_json, munition_ref, ask_tier, enabled "
        "FROM e41.journey_tile WHERE journey_id = %s AND enabled = TRUE "
        "ORDER BY step_order",
        (journey_id,),
    )
    tree: Dict[Optional[str], List[Dict[str, Any]]] = {}
    for r in rows:
        parent = str(r["parent_tile_id"]) if r.get("parent_tile_id") else None
        tree.setdefault(parent, []).append(dict(r))
    return tree


def walk(tree, parent=None, depth=0):
    """Depth-first tile walk with a cycle guard."""
    if depth > E41Config.MAX_TILES_PER_WALK:
        logger.error("tile walk exceeded %s levels — cycle suspected", E41Config.MAX_TILES_PER_WALK)
        return
    for tile in tree.get(parent, []):
        yield tile, depth
        yield from walk(tree, str(tile["tile_id"]), depth + 1)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION F — PROPOSE  (the handoff to E20)
# ═══════════════════════════════════════════════════════════════════════════════

def propose_step(
    db, run_id: str, journey_id: str, tile: Dict[str, Any],
    cluster_id: int, candidate_id: Optional[int], trace_id: str,
) -> Dict[str, Any]:
    """
    Write ONE proposal.

    When PROPOSALS_ENABLED is False: writes the step log with
    e20_decision='proposed' and nothing to brain.weapon_queue.

    When True: writes brain.weapon_queue (status='queued') and records weapon_id.
    E20's drain then resolves executor, runs ConstitutionalResolver, and either
    dispatches or suppresses. E41 reads that disposition back later.

    brain.weapon_queue shape (17 cols, live-verified 2026-07-25):
      donor_id is BIGINT and carries cluster_id. candidate_id is INTEGER.
      weapon_code / bgop_trace_id / microsegment_key live in payload JSONB —
      they are NOT columns on the row.
    """
    payload = {
        "weapon_code": tile.get("weapon_code"),
        "ecosystem_code": tile.get("ecosystem_code"),
        "munition_ref": tile.get("munition_ref"),
        "ask_tier": tile.get("ask_tier"),
        "bgop_trace_id": trace_id,
        "e41_journey_id": journey_id,
        "e41_tile_id": str(tile["tile_id"]),
        "e41_run_id": run_id,
        "event_type": f"outreach.{tile.get('weapon_code')}_ready",
    }

    weapon_id = None
    decision = "proposed"

    if PROPOSALS_ENABLED:
        weapon_id = str(uuid.uuid4())
        db.execute(
            """
            INSERT INTO brain.weapon_queue
                (weapon_id, trigger_id, donor_id, candidate_id, action_type,
                 payload, status, attempts, max_attempts, queued_at, test_mode)
            VALUES (%s, %s, %s, %s, %s, %s, 'queued', 0, 3, NOW(), %s)
            """,
            (
                weapon_id,
                f"E41_{journey_id[:8]}",
                cluster_id,                       # donor_id BIGINT == cluster_id
                candidate_id,                     # INTEGER
                tile.get("executor_code") or f"EXEC_{tile.get('ecosystem_code')}_SEND",
                json.dumps(payload),
                not PROPOSALS_ENABLED,            # test_mode TRUE while dark
            ),
        )

    db.execute(
        """
        INSERT INTO e41.journey_step_log
            (run_id, journey_id, tile_id, cluster_id, e20_weapon_id,
             e20_decision, bgop_trace_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (run_id, journey_id, tile["tile_id"], cluster_id, weapon_id, decision, trace_id),
    )
    return {"weapon_id": weapon_id, "decision": decision}


def read_back_dispositions(db, run_id: str) -> int:
    """
    Read E20's verdict back into the step log.

    E41 proposes; E20 disposes. This closes the loop so the control panel can show
    accepted vs suppressed without querying brain.* directly.
    """
    updated = db.execute(
        """
        UPDATE e41.journey_step_log sl
        SET e20_decision = CASE
                WHEN wq.status = 'delivered' THEN 'accepted'
                WHEN wq.status = 'failed'    THEN 'rejected'
                ELSE sl.e20_decision
            END,
            e20_reason = wq.error_message
        FROM brain.weapon_queue wq
        WHERE sl.e20_weapon_id = wq.weapon_id
          AND sl.run_id = %s
          AND sl.e20_decision = 'proposed'
        """,
        (run_id,),
    )
    return updated or 0


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION G — ML FEEDBACK  (outcome.* ONLY — never ml.donor_fingerprint)
# ═══════════════════════════════════════════════════════════════════════════════

def emit_outcome_link(db, run_id: str) -> int:
    """
    Link accepted steps to their outcome rows.

    Ed Ruling Option A (2026-07-25, ABSOLUTE):
      outcome signals live in outcome.* only. This function NEVER writes
      ml.donor_fingerprint. The fingerprint updates through a derived view.
    """
    n = db.execute(
        """
        UPDATE e41.journey_step_log sl
        SET outcome_id = wo.outcome_id,
            outcome_written = TRUE
        FROM outcome.weapon_outcome wo
        WHERE wo.weapon_queue_id = sl.e20_weapon_id
          AND sl.run_id = %s
          AND sl.outcome_written = FALSE
        """,
        (run_id,),
    )
    return n or 0


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION H — RUN
# ═══════════════════════════════════════════════════════════════════════════════

def run_journey(db, journey_id: str, triggered_by: str = "entry_source") -> Dict[str, Any]:
    """Execute one journey pass. Returns a summary the control panel can render."""
    assert_canary(db)

    j = db.fetchone(
        "SELECT journey_id, journey_code, candidate_id, status, wizard_approved "
        "FROM e41.journey_definition WHERE journey_id = %s",
        (journey_id,),
    )
    if not j:
        raise ValueError(f"journey {journey_id} not found")

    # ── TIER 1 GATE: E68 Wizard authority. Nothing runs without it. ──────────
    if not j["wizard_approved"]:
        return {"status": "halted", "reason": "wizard_not_approved", "journey_id": journey_id}
    if j["status"] != "approved":
        return {"status": "halted", "reason": f"journey status={j['status']}", "journey_id": journey_id}

    ctrl = load_control(db, journey_id)
    if not ctrl or ctrl.mode == "off":
        return {"status": "halted", "reason": "control_mode_off", "journey_id": journey_id}

    run_id = str(uuid.uuid4())
    trace_id = f"E41_RUN_{uuid.uuid4().hex[:12]}"
    db.execute(
        "INSERT INTO e41.journey_run (run_id, journey_id, triggered_by, bgop_trace_id, status) "
        "VALUES (%s, %s, %s, %s, 'running')",
        (run_id, journey_id, triggered_by, trace_id),
    )

    clusters = resolve_entry_set(db, journey_id, ctrl.max_entries_per_run)
    tree = load_tiles(db, journey_id)

    proposals = 0
    try:
        for cluster_id in clusters:
            for tile, _depth in walk(tree):
                if tile["tile_kind"] != "weapon":
                    continue          # wait/split/filter handled by the scheduler, not here
                propose_step(db, run_id, journey_id, tile, cluster_id, j.get("candidate_id"), trace_id)
                proposals += 1

        accepted = read_back_dispositions(db, run_id)
        emit_outcome_link(db, run_id)

        db.execute(
            "UPDATE e41.journey_run SET status='completed', finished_at=NOW(), "
            "entries_count=%s, proposals_sent=%s, proposals_accepted=%s WHERE run_id=%s",
            (len(clusters), proposals, accepted, run_id),
        )
    except Exception as exc:
        db.execute(
            "UPDATE e41.journey_run SET status='failed', finished_at=NOW(), error_message=%s "
            "WHERE run_id=%s",
            (str(exc)[:500], run_id),
        )
        raise
    finally:
        assert_canary(db)

    logger.info(
        "journey %s run %s: %d entries, %d proposals (PROPOSALS_ENABLED=%s)",
        j["journey_code"], run_id[:8], len(clusters), proposals, PROPOSALS_ENABLED,
    )
    return {
        "status": "completed",
        "run_id": run_id,
        "journey_id": journey_id,
        "entries": len(clusters),
        "proposals": proposals,
        "proposals_enabled": PROPOSALS_ENABLED,
        "bgop_trace_id": trace_id,
    }


def tick(db) -> List[Dict[str, Any]]:
    """
    Scheduler tick. Runs journeys whose control mode says they should run now.

    mode='on'    -> runs when its entry source has fresh members
    mode='timer' -> runs when next_run_at has passed
    mode='off'   -> never
    """
    due = db.fetchall(
        """
        SELECT c.journey_id, c.mode
        FROM e41.control_state c
        JOIN e41.journey_definition j ON j.journey_id = c.journey_id
        WHERE c.mode <> 'off'
          AND j.status = 'approved'
          AND j.wizard_approved = TRUE
          AND (c.mode = 'on' OR (c.mode = 'timer' AND c.next_run_at <= NOW()))
        """
    )
    results = []
    for d in due:
        try:
            results.append(
                run_journey(db, str(d["journey_id"]),
                            triggered_by="timer" if d["mode"] == "timer" else "entry_source")
            )
        except Exception as exc:
            logger.error("journey %s failed: %s", d["journey_id"], exc)
            results.append({"status": "failed", "journey_id": str(d["journey_id"]), "error": str(exc)})
    return results


if __name__ == "__main__":
    print(__doc__)
    print(f"\nPROPOSALS_ENABLED = {PROPOSALS_ENABLED}")
    print("Dark mode: journeys walk, steps log, brain.weapon_queue untouched.")
