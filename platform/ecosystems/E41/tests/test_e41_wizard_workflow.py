"""
ECO_CANONICAL/E41/tests/test_e41_wizard_workflow.py

Scratch-Postgres rehearsal of the HubSpot wizard parity build.
Fixture = synthetic canary (147 rows / 332,631.30) + minimal stand-ins for the
Hetzner tables the code reads (core.donor_profile, brain.*, journey.weapon_journey,
outcome.weapon_outcome, wizard.campaigns) + the REAL E41 v1 schema + the REAL
dry-run file with ROLLBACK flipped to COMMIT for the harness only.

Run:  pytest -q ECO_CANONICAL/E41/tests/test_e41_wizard_workflow.py   (from repo root)
Needs: pip install pgserver psycopg[binary] pytest   (works in Claude's sandbox)
"""
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
LANE = HERE.parent
sys.path.insert(0, str(LANE / "code"))

import e41_journey_engine as engine            # noqa: E402
import e41_wizard_workflow as wiz              # noqa: E402
import e41_studio_cannon_adapter as sca        # noqa: E402

V1 = os.environ.get("E41_V1_SCHEMA", str(LANE / "sql" / "E41_CAMPAIGN_BUILDER_SCHEMA_V1_2026-07-28.sql"))
REPO = LANE.parent.parent
DRYRUN = os.environ.get("E41_DRYRUN", str(REPO / "database" / "migrations" / "dryrun" / "DRYRUN_E41_WIZARD_WORKFLOW_SCHEDULER_2026-10-02.sql"))
DRYRUN2 = os.environ.get("E41_DRYRUN2", str(REPO / "database" / "migrations" / "dryrun" / "DRYRUN_E41_OMNICHANNEL_WEAPON_REGISTRY_AND_POLICY_2026-10-02.sql"))

STANDINS = """
CREATE SCHEMA raw; CREATE SCHEMA core; CREATE SCHEMA brain; CREATE SCHEMA journey;
CREATE SCHEMA outcome; CREATE SCHEMA wizard; CREATE SCHEMA ops;
CREATE TABLE raw.ncboe_donations (cluster_id INT, norm_amount NUMERIC);
INSERT INTO raw.ncboe_donations SELECT 372171, 2262.80 FROM generate_series(1,146);
INSERT INTO raw.ncboe_donations VALUES (372171, 332631.30 - 146*2262.80);
CREATE TABLE core.donor_profile (cluster_id INT PRIMARY KEY, grade TEXT, county_name TEXT,
  personal_email TEXT, cell_phone TEXT, street_line_1 TEXT, is_super_voter BOOL,
  s_email_unsubscribed_flag BOOL, s_sms_stop_flag BOOL, s_phone_dnc_flag BOOL, s_global_optout_flag BOOL,
  timezone_utc_offset NUMERIC, donor_grade_state TEXT, donor_grade_district TEXT, donor_grade_county TEXT,
  district_state_house TEXT, district_state_senate TEXT, district_us_house TEXT, primary_affinity_issue TEXT,
  secondary_affinity_issue TEXT, industry_sector TEXT, is_business_owner BOOL, is_ncgop_donor BOOL,
  is_trump_donor BOOL, religion_modeled_label TEXT, media_market TEXT, controlling_candidate_id INT);
CREATE TABLE brain.triggers (trigger_id TEXT PRIMARY KEY, trigger_class TEXT NOT NULL DEFAULT 'event',
  trigger_family TEXT NOT NULL DEFAULT 'general', name TEXT NOT NULL, description TEXT DEFAULT '',
  condition_event_code TEXT, action_type TEXT NOT NULL DEFAULT 'log', action_params JSONB DEFAULT '{}',
  priority INT NOT NULL DEFAULT 50, cooldown_seconds INT NOT NULL DEFAULT 0, phase_relevance INT[] DEFAULT '{1,2,3,4}',
  affected_ecosystems TEXT[] DEFAULT '{}', constitutional_layer INT NOT NULL DEFAULT 3, active BOOL NOT NULL DEFAULT TRUE,
  fire_count INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), condition VARCHAR);
CREATE TABLE brain.suppression_list (suppression_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cluster_id INT, candidate_id INT,
  email TEXT, phone TEXT, suppression_type TEXT, channel TEXT, source TEXT, effective_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE brain.event_queue (event_id UUID, event_type TEXT, source_universe TEXT, source_ecosystem TEXT,
  entity_type TEXT, entity_id TEXT, event_data JSONB, priority INT, status TEXT, attempts INT, max_attempts INT,
  scheduled_for TIMESTAMPTZ, processed_at TIMESTAMPTZ, error_message TEXT, created_at TIMESTAMPTZ, event_class TEXT, donor_id BIGINT);
CREATE TABLE brain.weapon_queue (weapon_id UUID PRIMARY KEY, trigger_id TEXT, donor_id BIGINT, candidate_id INT,
  action_type TEXT, payload JSONB, status TEXT, attempts INT, max_attempts INT, queued_at TIMESTAMPTZ, test_mode BOOL, error_message TEXT);
CREATE TABLE journey.weapon_journey (journey_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), weapon_queue_id UUID,
  weapon_code TEXT NOT NULL, ecosystem_code TEXT NOT NULL, cluster_id INT NOT NULL, journey_state TEXT NOT NULL DEFAULT 'queued',
  dispatched_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, engaged_at TIMESTAMPTZ, responded_at TIMESTAMPTZ, donated_at TIMESTAMPTZ);
CREATE TABLE brain.action_executors (executor_id UUID DEFAULT gen_random_uuid(), executor_code TEXT PRIMARY KEY, ecosystem_code TEXT, weapon TEXT, event_class TEXT,
  handler_kind TEXT, handler_endpoint TEXT, enabled BOOL, requires_observe_pass BOOL, requires_go_nogo BOOL,
  requires_compliance BOOL, is_vendor BOOL, de_identified_only BOOL, max_per_hour INT);
CREATE SCHEMA e59; CREATE SCHEMA e10;
CREATE TABLE e59.donor_segment_assignment (assignment_id BIGSERIAL PRIMARY KEY, cluster_id INT, microsegment_key TEXT,
  segment_match_score NUMERIC, candidate_id INT, do_not_contact BOOL DEFAULT FALSE);
CREATE TABLE e59.microsegment_faction_crosswalk (microsegment_key TEXT PRIMARY KEY, primary_channel TEXT, secondary_channel TEXT);
CREATE TABLE e59.wizard_launch_context (context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), microsegment_key TEXT, candidate_id INT,
  quadrant TEXT, recommended_funnel TEXT, recommended_message_frame TEXT, recommended_subject_line_a TEXT, recommended_subject_line_b TEXT,
  recommended_ask_amount NUMERIC, recommended_urgency_window_days INT, ask_a_plus_plus NUMERIC, ask_a_plus NUMERIC, ask_a NUMERIC,
  ask_b NUMERIC, ask_c NUMERIC, pre_loaded_cluster_ids INT[], donor_count INT, compliance_cleared BOOL, compliance_flags JSONB);
CREATE TABLE e10.fatigue_policy (scope TEXT, max_touches INT, window_hours INT, rationale TEXT);
INSERT INTO e10.fatigue_policy VALUES ('ALL_CHANNELS',3,168,'x'),('PER_CHANNEL',2,168,'y');
CREATE TABLE ops.gate_r4_studio_gate_state (studio_id TEXT PRIMARY KEY, execution_mode TEXT, guard TEXT, mode_set_by TEXT, mode_set_at TIMESTAMPTZ);
INSERT INTO ops.gate_r4_studio_gate_state SELECT 'W'||lpad(i::text,2,'0'),'OBSERVE','DIGITAL','test',now() FROM generate_series(1,16) i;
CREATE TABLE e10.blackout (blackout_id SERIAL PRIMARY KEY, scope_type TEXT, scope_value TEXT, reason TEXT, set_by TEXT,
  set_at TIMESTAMPTZ DEFAULT now(), review_at TIMESTAMPTZ, cleared_by TEXT, cleared_at TIMESTAMPTZ);
CREATE TABLE outcome.weapon_outcome (outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), weapon_queue_id UUID);
CREATE TABLE wizard.campaigns (id UUID PRIMARY KEY, candidate_id UUID NOT NULL, campaign_name TEXT NOT NULL,
  campaign_code TEXT, status TEXT NOT NULL DEFAULT 'draft', step_completed INT NOT NULL DEFAULT 0, campaign_type TEXT,
  weapons JSONB NOT NULL DEFAULT '[]', universe_size INT, wizard_session_id UUID, channel_waterfall_json JSONB);
"""


@pytest.fixture(scope="module")
def db():
    import pgserver
    import psycopg
    pg = pgserver.get_server(str(HERE / ".pgdata"))
    conn = psycopg.connect(pg.get_uri(), autocommit=True)
    with conn.cursor() as cur:
        cur.execute("DROP DATABASE IF EXISTS e41t"); cur.execute("CREATE DATABASE e41t")
    conn.close()
    conn = psycopg.connect(pg.get_uri("e41t"), autocommit=True)
    with conn.cursor() as cur:
        cur.execute(STANDINS)
        cur.execute(open(V1).read().replace("ROLLBACK;", "COMMIT;"))
        cur.execute(open(DRYRUN).read().replace("\nROLLBACK;", "\nCOMMIT;"))
        cur.execute(open(DRYRUN2).read().replace("\nROLLBACK;", "\nCOMMIT;"))
    yield wiz.PgDB(conn)
    conn.close()


def _seed_donors(db, n=6):
    if db.fetchone("SELECT 1 FROM core.donor_profile LIMIT 1"):
        return
    for i in range(1, n + 1):
        db.execute(
            "INSERT INTO core.donor_profile (cluster_id, grade, county_name, personal_email, cell_phone, street_line_1, "
            " is_super_voter, s_email_unsubscribed_flag, timezone_utc_offset) VALUES (%s,%s,'Forsyth',%s,%s,%s,TRUE,FALSE,-5)",
            (1000 + i, "A" if i % 2 else "B", f"d{i}@x.org" if i != 6 else None,
             f"336555000{i}" if i < 5 else None, f"{i} Main St"))


def _session(db, dsl=wiz.EXAMPLE_DSL, with_variations=True):
    sid = str(uuid.uuid4())
    strat = wiz.StrategyAdvisor.suggest(db, {"all": [{"col": "county_name", "op": "in", "values": ["Forsyth"]}]},
                                        {"text": "$50 to Protect the Farm Bill — code FARM50", "ask_tier": "T2"})
    db.execute("INSERT INTO wizard.wizard_session (session_id, candidate_id, candidate_uuid, strategy_qa, brief, workflow_dsl, state) "
               "VALUES (%s, 7, %s, %s, %s, %s, 'COMPOSING')",
               (sid, str(uuid.uuid4()), json.dumps(strat), json.dumps({"name": "Farm Bill Oct push"}), json.dumps(dsl)))
    if with_variations:
        for w, eco, payload in (("EMAIL", "E30", {"subject": "Ready to protect NC farms?", "body": "Hi {First_Name}..."}),
                                ("POSTCARD", "E33", {"dimensions": "4x6", "headline": "Your farm's future", "qr_coupon": True}),
                                ("SOCIAL", "E19", {"platforms": ["LinkedIn", "Instagram", "X"], "post_copy": "Stand with NC farmers"})):
            db.execute("INSERT INTO wizard.channel_variation (session_id, weapon_code, ecosystem_code, studio_status, payload, munition_ref) "
                       "VALUES (%s,%s,%s,'studio_ready',%s,%s)", (sid, w, eco, json.dumps(payload), f"E08:{w}:farm50"))
    return sid, strat


def test_strategy_step1_counts_and_mix(db):
    _seed_donors(db)
    sid, strat = _session(db)
    assert strat["target_group"]["size"] == 6 and strat["target_group"]["status"] == "verified"
    assert strat["primary_offer"]["status"] == "configured"
    mix = strat["optimal_mix"]["weapons"]
    assert mix[0] == "POSTCARD"            # 6 addresses > 5 emails > 4 cells
    assert "EMAIL" in mix and len(mix) == 3


def test_dsl_rejects_bad_graphs():
    bad = json.loads(json.dumps(wiz.EXAMPLE_DSL))
    bad["edges"] = [e for e in bad["edges"] if e[:2] != ["opened", "send_social"]]
    with pytest.raises(ValueError, match="yes"):
        wiz.WorkflowDSL.parse(bad)
    cyc = json.loads(json.dumps(wiz.EXAMPLE_DSL))
    cyc["edges"] = [e for e in cyc["edges"] if e[:2] != ["send_social", "done"]] + [["send_social", "send_email"]]
    with pytest.raises(ValueError, match="cycle"):
        wiz.WorkflowDSL.parse(cyc)


def test_compile_is_draft_not_live(db):
    sid, _ = _session(db)
    out = wiz.compile_session(db, sid, journey_code="T_FARM50_" + sid[:6])
    j = db.fetchone("SELECT status, wizard_approved FROM e41.journey_definition WHERE journey_id=%s", (out["journey_id"],))
    assert (j["status"], j["wizard_approved"]) == ("draft", False)
    assert db.fetchone("SELECT mode FROM e41.control_state WHERE journey_id=%s", (out["journey_id"],))["mode"] == "off"
    kinds = [r["tile_kind"] for r in db.fetchall(
        "SELECT tile_kind FROM e41.journey_tile WHERE journey_id=%s ORDER BY step_order", (out["journey_id"],))]
    assert kinds == ["weapon", "wait", "split", "weapon", "weapon", "exit", "exit"]   # 'done' expanded under both branches
    labels = {r["branch_label"] for r in db.fetchall(
        "SELECT branch_label FROM e41.journey_tile WHERE journey_id=%s AND tile_kind='weapon'", (out["journey_id"],))}
    assert labels == {"default", "yes", "no"}
    assert db.fetchone("SELECT state FROM wizard.wizard_session WHERE session_id=%s", (sid,))["state"] == "DRY_RUN_READY"
    assert db.fetchone("SELECT count(*) c FROM wizard.campaigns WHERE wizard_session_id=%s", (sid,))["c"] == 1
    # authorization gate
    assert wiz.authorize(db, sid, "ok go")["status"] == "refused"
    assert wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")["status"] == "authorized"
    assert db.fetchone("SELECT mode FROM e41.control_state WHERE journey_id=%s", (out["journey_id"],))["mode"] == "off"  # still not live


def _run(db, journey_id):
    run_id = str(uuid.uuid4())
    db.execute("INSERT INTO e41.journey_run (run_id, journey_id, triggered_by, bgop_trace_id) VALUES (%s,%s,'manual','T')", (run_id, journey_id))
    return run_id


def test_scheduler_routes_opened_vs_not_opened(db):
    sid, _ = _session(db)
    out = wiz.compile_session(db, sid, journey_code="T_ROUTE_" + sid[:6])
    jid = out["journey_id"]
    wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")
    db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (jid,))
    run_id = _run(db, jid)
    t0 = datetime(2026, 10, 2, 15, 0, tzinfo=timezone.utc)   # 10:00 local for UTC-5 donors
    assert wiz.enroll(db, jid, run_id, [1001, 1002], "T", smart_send=False) == 2

    # hop 1: both get the EMAIL proposal (dark: step_log only, weapon_queue empty)
    s = wiz.Scheduler(db, now=t0)
    assert s.advance(jid) == {"active": 2}
    assert db.fetchone("SELECT count(*) c FROM e41.journey_step_log WHERE run_id=%s", (run_id,))["c"] == 2
    assert db.fetchone("SELECT count(*) c FROM brain.weapon_queue")["c"] == 0
    # hop 2: both enter the 48h wait
    assert wiz.Scheduler(db, now=t0).advance(jid) == {"waiting": 2}
    assert wiz.Scheduler(db, now=t0 + timedelta(hours=47)).advance(jid) == {}

    # simulate E20 having dispatched 1001's email and the donor opening it
    wq = str(uuid.uuid4())
    db.execute("UPDATE e41.journey_step_log SET e20_weapon_id=%s WHERE run_id=%s AND cluster_id=1001", (wq, run_id))
    db.execute("UPDATE e41.journey_position SET send_refs = jsonb_set(send_refs, '{send_email,e20_weapon_id}', to_jsonb(%s::text)) "
               "WHERE run_id=%s AND cluster_id=1001", (wq, run_id))
    db.execute("INSERT INTO journey.weapon_journey (weapon_queue_id, weapon_code, ecosystem_code, cluster_id, journey_state, engaged_at) "
               "VALUES (%s,'EMAIL','E30',1001,'engaged',%s)", (wq, t0 + timedelta(hours=5)))

    # hop 3 (after 48h): wait expires -> both land on the split tile
    t1 = t0 + timedelta(hours=48, minutes=1)
    assert wiz.Scheduler(db, now=t1).advance(jid) == {"active": 2}
    assert {r["tile_kind"] for r in db.fetchall(
        "SELECT t.tile_kind FROM e41.journey_position p JOIN e41.journey_tile t ON t.tile_id=p.current_tile_id WHERE p.run_id=%s", (run_id,))} == {"split"}
    # hop 4: split -> yes (SOCIAL) for 1001, no (POSTCARD) for 1002
    assert wiz.Scheduler(db, now=t1).advance(jid) == {"active": 2}
    nxt = {r["cluster_id"]: r["weapon_code"] for r in db.fetchall(
        "SELECT p.cluster_id, t.weapon_code FROM e41.journey_position p JOIN e41.journey_tile t ON t.tile_id=p.current_tile_id WHERE p.run_id=%s", (run_id,))}
    assert nxt == {1001: "SOCIAL", 1002: "POSTCARD"}
    # hop 5: the sends; hop 6: exit tile
    assert wiz.Scheduler(db, now=t1).advance(jid) == {"active": 2}
    assert wiz.Scheduler(db, now=t1).advance(jid) == {"exited": 2}
    states = {r["cluster_id"]: (r["state"], r["exit_reason"]) for r in db.fetchall(
        "SELECT cluster_id, state, exit_reason FROM e41.journey_position WHERE run_id=%s", (run_id,))}
    assert states == {1001: ("exited", "sequence_complete"), 1002: ("exited", "sequence_complete")}
    assert db.fetchone("SELECT count(*) c FROM e41.journey_step_log WHERE run_id=%s", (run_id,))["c"] == 4
    assert db.fetchone("SELECT count(*) c FROM brain.event_queue WHERE event_type='w_journey_exited'")["c"] == 2
    # re-enrollment blocked (HubSpot default) + control panel dark
    assert wiz.enroll(db, jid, run_id, [1001], "T") == 0


def test_smart_send_holds_until_local_peak(db):
    sid, _ = _session(db)
    out = wiz.compile_session(db, sid, journey_code="T_SMART_" + sid[:6])
    jid = out["journey_id"]
    wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")
    db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (jid,))
    run_id = _run(db, jid)
    assert wiz.enroll(db, jid, run_id, [1003], "T", smart_send=True) == 1
    off = db.fetchone("SELECT smart_send_offset_seconds o FROM e41.journey_position WHERE run_id=%s", (run_id,))["o"]
    assert 0 < off < 86400
    t0 = datetime.now(timezone.utc).replace(hour=15, minute=0, second=0, microsecond=0)
    assert wiz.Scheduler(db, now=t0).advance(jid) == {"waiting": 1}
    assert wiz.Scheduler(db, now=t0 + timedelta(seconds=off + 1)).advance(jid) == {"active": 1}
    assert db.fetchone("SELECT count(*) c FROM e41.journey_step_log WHERE run_id=%s", (run_id,))["c"] == 1


def test_canary_intact(db):
    engine.assert_canary(db)


T_DAY = datetime(2026, 10, 5, 15, 0, tzinfo=timezone.utc)     # Monday 10:00 local (UTC-5)
T_GOAL = T_DAY + timedelta(days=30)                            # own e10 fatigue window (168h)


def test_sixteen_weapons_registered_dark(db):
    assert db.fetchone("SELECT count(*) c FROM e41.weapon_registry")["c"] == 16
    assert {r["w_code"] for r in db.fetchall("SELECT w_code FROM e41.weapon_registry")} == {f"W{i:02d}" for i in range(1, 17)}
    ex = db.fetchall("SELECT executor_code, enabled FROM brain.action_executors WHERE executor_code LIKE 'EXEC_E%'")
    assert all(not r["enabled"] for r in ex) and len(ex) >= 13          # v1 E41 row + 12 cannons, all dark
    reg = wiz.load_weapon_registry(db)
    assert len(reg) == 16 and reg["PHONE"]["executor_code"] == "EXEC_E32_PHONE_CALL"
    assert db.fetchone("SELECT count(*) c FROM e41.action_catalog WHERE tile_kind='weapon'")["c"] >= 17   # 16 + SEND_PREFERRED


def _omni_fixture(db):
    db.execute("INSERT INTO e59.microsegment_faction_crosswalk VALUES ('bankers_finance','sms','mail') ON CONFLICT DO NOTHING")
    db.execute("INSERT INTO e59.microsegment_faction_crosswalk VALUES ('auto_dealers','email','phone') ON CONFLICT DO NOTHING")
    for cid, key in ((1001, 'bankers_finance'), (1002, 'bankers_finance'), (1005, 'bankers_finance'), (1003, 'auto_dealers')):
        db.execute("INSERT INTO e59.donor_segment_assignment (cluster_id, microsegment_key, segment_match_score, candidate_id) VALUES (%s,%s,0.9,7)", (cid, key))
    # 1002: SMS suppressed via brain.suppression_list (channel-scoped)
    db.execute("INSERT INTO brain.suppression_list (suppression_id, cluster_id, channel, suppression_type) VALUES (gen_random_uuid(), 1002, 'sms', 'SMS_STOP') ON CONFLICT DO NOTHING")


def test_omni_channel_resolves_per_donor(db):
    _seed_donors(db)          # idempotent? no — guard
    _omni_fixture(db)
    sid, strat = _session(db, dsl=wiz.EXAMPLE_OMNI_DSL)
    out = wiz.compile_session(db, sid, journey_code="T_OMNI_" + sid[:6])
    jid = out["journey_id"]
    pol = db.fetchone("SELECT * FROM e41.journey_policy WHERE journey_id=%s", (jid,))
    assert pol["unenroll_siblings"] is True and pol["re_enrollment"] == "after_days" and pol["max_touches_total"] == 4
    wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")
    db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (jid,))
    run_id = _run(db, jid)
    # donor-group entry (list-based enrollment); 1005 has no cell, 1002 is SMS-suppressed
    n = wiz.enroll_from_donor_groups(db, jid, run_id, ["bankers_finance"], "T", candidate_id=7)
    assert n == 3
    assert wiz.Scheduler(db, now=T_DAY).advance(jid) == {"active": 3}
    got = {r["cluster_id"]: r["send_refs"]["touch1"]["weapon_code"] for r in db.fetchall(
        "SELECT cluster_id, send_refs FROM e41.journey_position WHERE run_id=%s", (run_id,))}
    assert got == {1001: "SMS",          # group primary channel, reachable, not suppressed
                   1002: "POSTCARD",     # SMS suppressed -> group secondary 'mail'
                   1005: "POSTCARD"}     # no cell -> secondary 'mail'
    eco = {r["ecosystem_code"] for r in db.fetchall("SELECT t.ecosystem_code FROM e41.journey_step_log sl JOIN e41.journey_tile t ON t.tile_id=sl.tile_id WHERE sl.run_id=%s", (run_id,))}
    assert eco == {"E41"}                # tile is the PREFERRED tile; resolved cannon rides in the proposal payload


def test_goal_unenrolls_this_and_sibling_journeys(db):
    _omni_fixture(db)
    sid, _ = _session(db, dsl=wiz.EXAMPLE_OMNI_DSL)
    out = wiz.compile_session(db, sid, journey_code="T_GOAL_" + sid[:6]); jid = out["journey_id"]
    sid2, _ = _session(db)                                              # a sibling journey, same candidate 7
    out2 = wiz.compile_session(db, sid2, journey_code="T_SIB_" + sid2[:6]); jid2 = out2["journey_id"]
    for s_, j_ in ((sid, jid), (sid2, jid2)):
        wiz.authorize(db, s_, "I AUTHORIZE THIS ACTION")
        db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (j_,))
    r1, r2 = _run(db, jid), _run(db, jid2)
    assert wiz.enroll(db, jid, r1, [1001], "T") == 1 and wiz.enroll(db, jid2, r2, [1001], "T") == 1
    assert wiz.Scheduler(db, now=T_GOAL).advance(jid) == {"active": 1}          # touch1 proposed
    wq = str(uuid.uuid4())
    db.execute("UPDATE e41.journey_step_log SET e20_weapon_id=%s WHERE run_id=%s", (wq, r1))
    db.execute("INSERT INTO journey.weapon_journey (weapon_queue_id, weapon_code, ecosystem_code, cluster_id, journey_state, donated_at) "
               "VALUES (%s,'SMS','E31',1001,'donated',%s)", (wq, T_GOAL + timedelta(hours=2)))
    assert wiz.Scheduler(db, now=T_GOAL + timedelta(hours=3)).advance(jid) == {"exited": 1}
    me = db.fetchone("SELECT state, exit_reason FROM e41.journey_position WHERE run_id=%s", (r1,))
    sib = db.fetchone("SELECT state, exit_reason FROM e41.journey_position WHERE run_id=%s", (r2,))
    assert (me["state"], me["exit_reason"]) == ("completed", "goal_met")
    assert (sib["state"], sib["exit_reason"]) == ("exited", "goal_met_elsewhere")
    assert db.fetchone("SELECT goal_met FROM e41.v_journey_performance WHERE journey_id=%s", (jid,))["goal_met"] == 1


def test_quiet_hours_and_blackout_hold_the_send(db):
    _omni_fixture(db)
    sid, _ = _session(db)
    out = wiz.compile_session(db, sid, journey_code="T_QUIET_" + sid[:6]); jid = out["journey_id"]
    wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")
    db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (jid,))
    run_id = _run(db, jid)
    assert wiz.enroll(db, jid, run_id, [1003], "T") == 1
    night = datetime(2026, 10, 5, 3, 30, tzinfo=timezone.utc)                 # 22:30 local -> quiet
    assert wiz.Scheduler(db, now=night).advance(jid) == {"waiting": 1}
    wu = db.fetchone("SELECT wait_until FROM e41.journey_position WHERE run_id=%s", (run_id,))["wait_until"]
    assert wu == datetime(2026, 10, 5, 13, 0, tzinfo=timezone.utc)            # 08:00 local
    # blackout on the candidate holds even in daytime
    db.execute("INSERT INTO e10.blackout (scope_type, scope_value, reason, set_by) VALUES ('candidate','7','FEC window','test')")
    assert wiz.Scheduler(db, now=wu + timedelta(minutes=1)).advance(jid) == {"waiting": 1}
    assert db.fetchone("SELECT wait_event FROM e41.journey_position WHERE run_id=%s", (run_id,))["wait_event"] == "blackout.cleared"
    db.execute("UPDATE e10.blackout SET cleared_at=now()")
    assert wiz.Scheduler(db, now=wu + timedelta(hours=7)).advance(jid) == {"active": 1}
    assert db.fetchone("SELECT count(*) c FROM e41.journey_step_log WHERE run_id=%s", (run_id,))["c"] == 1


def test_launch_context_import(db):
    sid, _ = _session(db, with_variations=False)
    cid = db.fetchone("INSERT INTO e59.wizard_launch_context (microsegment_key, candidate_id, quadrant, recommended_funnel, "
                      " recommended_message_frame, recommended_subject_line_a, recommended_ask_amount, ask_a, ask_b, pre_loaded_cluster_ids, donor_count, compliance_cleared) "
                      "VALUES ('bankers_finance',7,'hot_high','3-touch','Protect NC community banks','Your bank, their rules',250,500,100,ARRAY[1001,1002],2,TRUE) RETURNING context_id")["context_id"]
    strat = wiz.import_launch_context(db, sid, str(cid))
    assert strat["target_group"]["size"] == 2 and strat["primary_offer"]["asks"]["ask_a"] == 500
    assert db.fetchone("SELECT state FROM wizard.wizard_session WHERE session_id=%s", (sid,))["state"] == "AUDIENCE_SELECTED"
    assert wiz.donor_group_size(db, ["bankers_finance"], 7) == 3


def test_fatigue_ceiling_holds_across_journeys(db):
    """e10.fatigue_policy ALL_CHANNELS 3/168h is the ceiling: a donor with 3 touches from OTHER journeys waits."""
    _omni_fixture(db)
    sids, jids, runs = [], [], []
    for i in range(4):
        sid, _ = _session(db); out = wiz.compile_session(db, sid, journey_code=f"T_FAT{i}_" + sid[:6])
        wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION")
        db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (out["journey_id"],))
        sids.append(sid); jids.append(out["journey_id"]); runs.append(_run(db, out["journey_id"]))
        assert wiz.enroll(db, out["journey_id"], runs[-1], [1004], "T") == 1
    t = T_DAY + timedelta(days=60)                                         # own fatigue window
    for j in jids[:2]:
        assert wiz.Scheduler(db, now=t).advance(j) == {"active": 1}      # 2 email proposals across 2 journeys
    assert wiz.Scheduler(db, now=t).advance(jids[2]) == {"waiting": 1}   # 3rd EMAIL: PER_CHANNEL 2/168h ceiling -> hold
    p = db.fetchone("SELECT wait_event, send_refs FROM e41.journey_position WHERE run_id=%s", (runs[2],))
    assert p["wait_event"] == "fatigue.window_rolled" and "PER_CHANNEL" in json.dumps(p["send_refs"])
    assert wiz.Scheduler(db, now=t).advance(jids[3]) == {"waiting": 1}   # 4th too
    assert wiz.Scheduler(db, now=t + timedelta(days=8)).advance(jids[2]) == {"active": 1}   # window rolled


def test_no_eligible_channel_terminal(db):
    _omni_fixture(db)
    db.execute("INSERT INTO core.donor_profile (cluster_id, county_name, timezone_utc_offset) VALUES (1099,'Forsyth',-5) ON CONFLICT DO NOTHING")
    db.execute("INSERT INTO e59.donor_segment_assignment (cluster_id, microsegment_key, segment_match_score, candidate_id) VALUES (1099,'bankers_finance',0.5,7)")
    sid, _ = _session(db, dsl=wiz.EXAMPLE_OMNI_DSL)
    out = wiz.compile_session(db, sid, journey_code="T_NOCH_" + sid[:6]); jid = out["journey_id"]
    wiz.authorize(db, sid, "I AUTHORIZE THIS ACTION"); db.execute("UPDATE e41.control_state SET mode='on' WHERE journey_id=%s", (jid,))
    run_id = _run(db, jid); assert wiz.enroll(db, jid, run_id, [1099], "T") == 1
    assert wiz.Scheduler(db, now=T_DAY).advance(jid) == {"active": 1}     # no email/cell/address -> tile skipped + logged, journey continues
    assert wiz.Scheduler(db, now=T_DAY).advance(jid) == {"waiting": 1}    # enters wait72
    lg = db.fetchone("SELECT e20_decision, e20_reason FROM e41.journey_step_log WHERE run_id=%s", (run_id,))
    assert (lg["e20_decision"], lg["e20_reason"]) == ("suppressed", "no_eligible_channel")
    # walk to the end: wait72 -> gave(no) -> touch2 (PREFERRED again, skipped) -> done(goal) ...
    for _ in range(6):
        wiz.Scheduler(db, now=T_DAY + timedelta(days=4)).advance(jid)
    p = db.fetchone("SELECT state, exit_reason, send_refs FROM e41.journey_position WHERE run_id=%s", (run_id,))
    assert p["send_refs"].get("touch2") == {"skipped": "no_eligible_channel"}, p
    assert p["state"] in ("completed", "exited")
    assert db.fetchone("SELECT count(*) c FROM e41.journey_step_log WHERE run_id=%s AND e20_reason='no_eligible_channel'", (run_id,))["c"] == 2


def test_studio_adapter_interface(db):
    a = sca.adapter_for(db, "EMAIL")
    assert a.w_code == "W01" and a.execution_mode == "OBSERVE"
    m = a.compose({"ask_tier": "T2"}, {"payload": {"subject": "Hi", "body": "give. unsubscribe here"}, "munition_ref": "E08:x"}, {"safe_greeting": "Ed"})
    assert a.validate(m) == []
    req = a.request(m, {"bgop_trace_id": "T", "e41_tile_id": "t"}, decision_id="d1")
    assert req.path == "/api/v2/actions/execute" and req.body["executor_code"] == "EXEC_E30_EMAIL_SEND" and req.body["mode"] == "OBSERVE"
    assert req.body["decision_id"] == "d1" and len(req.body["content_hash"]) == 64
    assert a.preview(m).body["mode"] == "PREVIEW"
    # FIRE refused unless gate=FIRE, executor enabled, and Ed's hash matches
    db.execute("UPDATE ops.gate_r4_studio_gate_state SET execution_mode='FIRE' WHERE studio_id='W01'")
    a2 = sca.adapter_for(db, "EMAIL")
    assert a2.request(m, {}).execution_mode == "OBSERVE"                               # executor disabled
    db.execute("INSERT INTO brain.action_executors (executor_code, ecosystem_code, weapon, event_class, enabled) VALUES ('EXEC_E30_EMAIL_SEND','E30','email','outreach.email_ready',TRUE) "
               "ON CONFLICT (executor_code) DO UPDATE SET enabled=TRUE")
    assert a2.request(m, {}).execution_mode == "OBSERVE"                               # no Ed hash
    assert a2.request(m, {}, ed_authorized_hash=a2.content_hash(m)).execution_mode == "FIRE"     # all three agree
    db.execute("UPDATE brain.action_executors SET enabled=FALSE WHERE executor_code='EXEC_E30_EMAIL_SEND'")
    db.execute("UPDATE ops.gate_r4_studio_gate_state SET execution_mode='OBSERVE' WHERE studio_id='W01'")
    sms = sca.adapter_for(db, "SMS")
    assert "10DLC STOP language required" in sms.validate(sms.compose({}, {"payload": {"body": "give now"}}, {}))
    assert sca.adapter_for(db, "CANDIDATE_PERSONAL").request(
        sca.Munition("W14", "CANDIDATE_PERSONAL", {"script": "hi"}), {}).body["cc_campaign_manager"] is True
    with pytest.raises(KeyError):
        sca.adapter_for(db, "FAX")
