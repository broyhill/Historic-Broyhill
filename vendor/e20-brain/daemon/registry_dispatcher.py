"""
backend/python/brain/registry_dispatcher.py

Ruling #5 — Registry-driven weapon dispatcher (DARK by default).

Replaces the observe-mode drain that marked brain.weapon_queue rows 'delivered'
without any provider send (the 2026-07-14 false-delivered batch, quarantined
2026-08-02, deploy_id 150). Contract:

  1. REGISTRY IS THE GATE. Every dispatch requires a brain.action_executors row
     whose executor_code matches the weapon's action_type exactly AND enabled=TRUE.
     No fuzzy fallback lookup, no EXEC_TEST_OBSERVE substitute. Disarmed weapon
     => row stays 'queued' untouched.
  2. E10 IN THE PATH. Before any fire, e10.check_clearance_batch() must return
     CLEAR or WARN for the (cluster, candidate, weapon). If the e10 schema or
     function does not exist, the verdict is DENY — fail closed, never open.
  3. NO STATE WITHOUT EVIDENCE. 'dispatched' requires an HTTP 200 from the
     executor endpoint. 'delivered' is NEVER written by this dispatcher —
     delivery is a provider-webhook fact, not a dispatch fact.
  4. DARK BY DEFAULT. BGOP_SENDS_ENABLED must be exactly 'FIRE' in the
     environment or the dispatcher claims nothing and consumes nothing.
     Flipping it live requires Ed's authorization per weapon (re-arm one at a
     time), recorded in ops.deploy_log.
  5. CANARY FIRST. cluster 372171 must equal 147 / 332631.30 at the top of
     every tick or the process exits.

Run modes:
  python3 registry_dispatcher.py --dry-run   # report what WOULD fire; touch nothing
  python3 registry_dispatcher.py             # daemon tick loop (dark unless FIRE)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass

import psycopg2
import psycopg2.extras
import requests

log = logging.getLogger("registry_dispatcher")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")

DB_DSN = os.environ.get("BGOP_DB_DSN", "dbname=broyhillgop")
TICK_SECONDS = int(os.environ.get("BGOP_DISPATCH_TICK", "30"))
BATCH_LIMIT = int(os.environ.get("BGOP_DISPATCH_BATCH", "25"))
HTTP_TIMEOUT = int(os.environ.get("BGOP_DISPATCH_HTTP_TIMEOUT", "30"))

CANARY_SQL = ("SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations "
              "WHERE cluster_id = 372171")


def sends_enabled() -> bool:
    """Master switch. Anything other than the exact string 'FIRE' is dark."""
    return os.environ.get("BGOP_SENDS_ENABLED", "") == "FIRE"


def check_canary(cur) -> bool:
    cur.execute(CANARY_SQL)
    row = cur.fetchone()
    count, total = (row["count"], row["sum"]) if isinstance(row, dict) else row
    ok = count == 147 and str(total) == "332631.30"
    if not ok:
        log.critical("CANARY FAIL: %s / %s — expected 147 / 332631.30", count, total)
    return ok


@dataclass
class GateResult:
    fire: bool
    reason: str


def executor_gate(cur, action_type: str) -> tuple[GateResult, dict | None]:
    """Exact-match registry lookup. Disabled or missing executor => no fire."""
    cur.execute(
        """SELECT executor_code, handler_endpoint, enabled
           FROM brain.action_executors
           WHERE executor_code = %s""",
        (action_type,),
    )
    ex = cur.fetchone()
    if ex is None:
        return GateResult(False, f"no_executor:{action_type}"), None
    if not ex["enabled"]:
        return GateResult(False, f"disarmed:{action_type}"), dict(ex)
    if not ex["handler_endpoint"]:
        return GateResult(False, f"no_endpoint:{action_type}"), dict(ex)
    return GateResult(True, "armed"), dict(ex)


def e10_gate(cur, cluster_id, candidate_id, weapon_code: str) -> GateResult:
    """Tier 2 legal floor. Absent schema/function or exception => DENY (fail closed)."""
    cur.execute(
        "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'e10' AND p.proname = 'check_clearance_batch'"
    )
    if cur.fetchone() is None:
        return GateResult(False, "e10_absent_fail_closed")
    try:
        cur.execute(
            "SELECT verdict, block_reasons FROM e10.check_clearance_batch("
            "p_cluster_ids := ARRAY[%s]::bigint[], p_candidate_id := %s, "
            "p_weapon_code := %s)",
            (cluster_id, candidate_id, weapon_code),
        )
        row = cur.fetchone()
        if row is None:
            return GateResult(False, "e10_no_verdict")
        verdict = row["verdict"]
        if verdict in ("CLEAR", "WARN"):
            return GateResult(True, f"e10_{verdict.lower()}")
        return GateResult(False, f"e10_{verdict.lower()}:{row['block_reasons']}")
    except psycopg2.Error as exc:
        return GateResult(False, f"e10_error_fail_closed:{str(exc)[:200]}")


ACTION_TO_WEAPON = {
    "EXEC_E30_EMAIL_SEND": "W01",
    "EXEC_E31_SMS_SEND": "W02",
    "EXEC_E17_RVM_DROP": "W04",
    "EXEC_E16_DIRECT_MAIL": "W05",
    "EXEC_E19_SOCIAL_POST": "W06",
    "EXEC_E18_PHONE_CALL": "W16",
}


def claim_weapons(cur, limit: int):
    cur.execute(
        """SELECT * FROM brain.weapon_queue
           WHERE status = 'queued' AND test_mode = FALSE
           ORDER BY queued_at
           LIMIT %s
           FOR UPDATE SKIP LOCKED""",
        (limit,),
    )
    return cur.fetchall()


def observe(cur, executor_code, cluster_id, weapon, mode, note, weapon_id):
    cur.execute(
        """INSERT INTO brain.observe_log
             (executor_code, event_queue_id, cluster_id, rnc_regid,
              weapon, event_class, mode, actually_taken, observe_response, trace_id)
           VALUES (%s, NULL, %s, NULL, %s, %s, %s, false, %s, %s)""",
        (executor_code, cluster_id, weapon, "dispatch", mode,
         json.dumps({"gate": note, "weapon_id": str(weapon_id)}),
         f"DISPATCH_{weapon_id}"),
    )


def dispatch_one(cur, w, dry_run: bool) -> str:
    """Returns the gate outcome string for reporting."""
    action_type = w["action_type"]
    cluster_id = int(w["donor_id"]) if w["donor_id"] is not None else None
    weapon_code = ACTION_TO_WEAPON.get(action_type, action_type)

    ex_gate, ex = executor_gate(cur, action_type)
    if not ex_gate.fire:
        return ex_gate.reason  # leave row queued, untouched

    legal = e10_gate(cur, cluster_id, w["candidate_id"], weapon_code)
    if not legal.fire:
        observe(cur, ex["executor_code"], cluster_id, action_type,
                "blocked", legal.reason, w["weapon_id"])
        return legal.reason  # leave row queued; clearance_log holds the verdict

    if dry_run or not sends_enabled():
        return f"would_fire:{ex['handler_endpoint']}"

    payload = w["payload"] or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    body = {**payload, "weapon_id": str(w["weapon_id"]), "cluster_id": cluster_id,
            "weapon_code": weapon_code}
    try:
        resp = requests.post(ex["handler_endpoint"], json=body, timeout=HTTP_TIMEOUT,
                             headers={"X-BGOP-Trace": f"DISPATCH_{w['weapon_id']}"})
    except requests.RequestException as exc:
        cur.execute(
            """UPDATE brain.weapon_queue
               SET status='failed', error_message=%s, attempts=attempts+1
               WHERE weapon_id=%s""",
            (f"dispatch_http_error: {str(exc)[:400]}", w["weapon_id"]),
        )
        return "http_error"

    if resp.status_code != 200:
        cur.execute(
            """UPDATE brain.weapon_queue
               SET status='failed', error_message=%s, attempts=attempts+1
               WHERE weapon_id=%s""",
            (f"HTTP {resp.status_code}", w["weapon_id"]),
        )
        return f"http_{resp.status_code}"

    ack = resp.json() if resp.content else {}
    cur.execute(
        """UPDATE brain.weapon_queue
           SET status='dispatched', dispatched_at=now(), attempts=attempts+1,
               http_response=%s
           WHERE weapon_id=%s""",
        (json.dumps(ack), w["weapon_id"]),
    )
    observe(cur, ex["executor_code"], cluster_id, action_type,
            "fire", "dispatched_http_200", w["weapon_id"])
    return "dispatched"


def tick(dry_run: bool) -> dict:
    outcomes: dict[str, int] = {}
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if not check_canary(cur):
                conn.close()
                sys.exit(2)
            if not dry_run and not sends_enabled():
                # Dark: claim nothing, consume nothing, mark nothing.
                return {"dark_idle": 1}
            for w in claim_weapons(cur, BATCH_LIMIT):
                outcome = dispatch_one(cur, w, dry_run)
                outcomes[outcome] = outcomes.get(outcome, 0) + 1
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    finally:
        conn.close()
    return outcomes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="report gate outcomes for queued weapons; write nothing")
    ap.add_argument("--once", action="store_true", help="single tick then exit")
    args = ap.parse_args()

    if args.dry_run:
        print(json.dumps(tick(dry_run=True), indent=2))
        return

    log.info("registry dispatcher starting — sends_enabled=%s tick=%ss batch=%s",
             sends_enabled(), TICK_SECONDS, BATCH_LIMIT)
    while True:
        try:
            outcomes = tick(dry_run=False)
            if outcomes and outcomes != {"dark_idle": 1}:
                log.info("tick outcomes: %s", outcomes)
        except Exception:
            log.exception("tick failed")
        if args.once:
            break
        time.sleep(TICK_SECONDS)


if __name__ == "__main__":
    main()
