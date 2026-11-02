#!/usr/bin/env python3
"""
============================================================================
BROYHILLGOP BRAIN WORKER DAEMON
E20 Intelligence Brain — Production Worker
============================================================================
Built from E20 Brain Canonical Reference §XV.
Service: broyhillgop-brain-worker.service
Host: 37.27.169.232 (Hetzner big server)
Author: Claude (E-architect) 2026-05-22
============================================================================
"""

import asyncio
import json
import logging
import os
import signal
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor

# Mountain 2 drain patch imports (dark — SENDS_ENABLED=False)
try:
    from outcome.outcome_writer import on_weapon_dispatched, extract_dispatch_fields
except ImportError:
    on_weapon_dispatched = None
    extract_dispatch_fields = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('brain_worker')


class BrainConfig:
    DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:password@37.27.169.232:5432/broyhillgop')
    RELAY_URL = os.environ.get('RELAY_URL', 'http://37.27.169.232:8080')
    RELAY_API_KEY = os.environ.get('RELAY_API_KEY', '')
    HEALTH_PORT = int(os.environ.get('BRAIN_HEALTH_PORT', '9090'))
    MAX_DAILY_CONTACTS = int(os.environ.get('BRAIN_MAX_DAILY_CONTACTS', '3'))
    GO_THRESHOLD = int(os.environ.get('BRAIN_GO_THRESHOLD', '70'))
    REVIEW_THRESHOLD = int(os.environ.get('BRAIN_REVIEW_THRESHOLD', '50'))
    HEARTBEAT_INTERVAL = int(os.environ.get('BRAIN_HEARTBEAT_INTERVAL', '15'))
    POLL_INTERVAL = float(os.environ.get('BRAIN_POLL_INTERVAL', '2.0'))
    DRY_RUN = os.environ.get('BRAIN_DRY_RUN', 'false').lower() == 'true'
    OBSERVE_ONLY = os.environ.get('BRAIN_OBSERVE_ONLY', 'true').lower() == 'true'
    TEST_MODE = os.environ.get('BRAIN_TEST_MODE', 'true').lower() == 'true'
    WEAPON_BATCH = int(os.environ.get('BRAIN_WEAPON_BATCH', '50'))


BRAIN_SCHEMA_DDL = """
CREATE SCHEMA IF NOT EXISTS brain;

CREATE TABLE IF NOT EXISTS brain.triggers (
    trigger_id TEXT PRIMARY KEY,
    trigger_class TEXT NOT NULL DEFAULT 'event',
    trigger_family TEXT NOT NULL DEFAULT 'general',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    condition_event_code TEXT,
    action_type TEXT NOT NULL DEFAULT 'log',
    action_params JSONB DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 50,
    cooldown_seconds INTEGER NOT NULL DEFAULT 0,
    phase_relevance INTEGER[] DEFAULT '{1,2,3,4}',
    affected_ecosystems TEXT[] DEFAULT '{}',
    constitutional_layer INTEGER NOT NULL DEFAULT 3,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    fire_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain.decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type TEXT NOT NULL,
    donor_id BIGINT,
    candidate_id BIGINT,
    event_type TEXT,
    event_data JSONB DEFAULT '{}',
    proposed_action JSONB DEFAULT '{}',
    actually_taken BOOLEAN NOT NULL DEFAULT TRUE,
    veto_reason TEXT,
    veto_level TEXT,
    decision_result TEXT NOT NULL DEFAULT 'go',
    score INTEGER,
    score_breakdown JSONB DEFAULT '{}',
    contributing_triggers TEXT[],
    rationale TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by TEXT NOT NULL DEFAULT 'brain',
    decided_phase INTEGER DEFAULT 1,
    days_to_election INTEGER,
    processing_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_decisions_recent ON brain.decisions(decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_donor ON brain.decisions(donor_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_candidate ON brain.decisions(candidate_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS brain.trigger_fire_history (
    fire_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id TEXT NOT NULL REFERENCES brain.triggers(trigger_id),
    fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    donor_id BIGINT,
    candidate_id BIGINT,
    event_data JSONB DEFAULT '{}',
    action_taken JSONB DEFAULT '{}',
    veto_applied BOOLEAN NOT NULL DEFAULT FALSE,
    veto_reason TEXT,
    cooldown_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fire_history_trigger ON brain.trigger_fire_history(trigger_id, fired_at DESC);

CREATE TABLE IF NOT EXISTS brain.veto_log (
    veto_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veto_level TEXT NOT NULL,
    rule_reference TEXT NOT NULL,
    proposed_action JSONB NOT NULL,
    donor_id BIGINT,
    candidate_id BIGINT,
    vetoed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain.event_queue (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_class TEXT NOT NULL DEFAULT 'general',
    event_data JSONB DEFAULT '{}',
    donor_id BIGINT,
    candidate_id BIGINT,
    priority INTEGER DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_queue_pending ON brain.event_queue(scheduled_for) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS brain.heartbeat (
    id INTEGER PRIMARY KEY DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    events_processed BIGINT DEFAULT 0,
    decisions_made BIGINT DEFAULT 0,
    pid INTEGER,
    version TEXT DEFAULT '1.0.0-infant'
);

INSERT INTO brain.heartbeat (id, started_at, pid) VALUES (1, NOW(), pg_backend_pid())
ON CONFLICT (id) DO UPDATE SET started_at = NOW(), last_heartbeat = NOW(), pid = pg_backend_pid();
"""

CORE_TRIGGERS_SEED = [
    {"trigger_id": "T-D-101", "trigger_class": "event", "trigger_family": "donation", "name": "First substantive donation", "priority": 80, "condition_event_code": "d_gift_completed_self", "action_type": "cultivation_workflow", "description": "First donation >=50 activates cultivation workflow."},
    {"trigger_id": "T-D-128", "trigger_class": "event", "trigger_family": "donation", "name": "Approaching FEC max-out", "priority": 95, "condition_event_code": "d_approaching_limit", "action_type": "jfc_redirect", "description": "Near FEC limit redirect to JFC/PAC."},
    {"trigger_id": "T-D-201", "trigger_class": "event", "trigger_family": "donation", "name": "Lapsed donor", "priority": 60, "condition_event_code": "d_lapsed_90d", "action_type": "reactivation_workflow", "description": "Lapsed 90d reactivation."},
    {"trigger_id": "T-E-201", "trigger_class": "event", "trigger_family": "engagement", "name": "Email opened", "priority": 50, "condition_event_code": "e_email_open", "action_type": "boost_receptivity", "description": "Email open boosts receptivity."},
    {"trigger_id": "T-E-228", "trigger_class": "event", "trigger_family": "engagement", "name": "Multi-open same-day", "priority": 65, "condition_event_code": "e_email_multi_open", "action_type": "schedule_send", "description": "2+ opens 24h schedule elevated send."},
    {"trigger_id": "T-E-301", "trigger_class": "event", "trigger_family": "engagement", "name": "Volunteer signup", "priority": 75, "condition_event_code": "e_volunteer_signup", "action_type": "volunteer_cultivation", "description": "New volunteer pipeline."},
    {"trigger_id": "T-I-601", "trigger_class": "event", "trigger_family": "news", "name": "Breaking issue", "priority": 70, "condition_event_code": "n_issue_breaking", "action_type": "priority_send", "description": "Breaking news in donor district."},
    {"trigger_id": "T-CR-1201", "trigger_class": "competitive", "trigger_family": "crisis", "name": "Opponent gaffe", "priority": 90, "condition_event_code": "n_opponent_gaffe", "action_type": "rapid_response", "description": "Opponent gaffe 12h rapid response."},
    {"trigger_id": "T-P-401", "trigger_class": "event", "trigger_family": "phase", "name": "Phase 3 entered", "priority": 85, "condition_event_code": "c_phase3_entered", "action_type": "rebalance_lp", "description": "Phase 3 T-60 rebalance LP."},
    {"trigger_id": "T-P-402", "trigger_class": "event", "trigger_family": "phase", "name": "Phase 4 final week", "priority": 95, "condition_event_code": "c_phase4_entered", "action_type": "gotv_activation", "description": "Phase 4 T-7 all-channel saturation."},
    {"trigger_id": "T-G-1501", "trigger_class": "event", "trigger_family": "gotv", "name": "Election day", "priority": 100, "condition_event_code": "c_election_day", "action_type": "gotv_final_push", "description": "Election day maximum GOTV."},
    {"trigger_id": "T-G-1502", "trigger_class": "event", "trigger_family": "gotv", "name": "Early voting starts", "priority": 90, "condition_event_code": "c_early_vote_start", "action_type": "early_vote_push", "description": "Early voting opens."},
    {"trigger_id": "T-C-901", "trigger_class": "event", "trigger_family": "compliance", "name": "Hard suppression", "priority": 100, "condition_event_code": "s_opt_out", "action_type": "global_suppress", "description": "Global suppress immediately."},
    {"trigger_id": "T-C-902", "trigger_class": "event", "trigger_family": "compliance", "name": "SMS STOP", "priority": 100, "condition_event_code": "s_sms_stop", "action_type": "sms_suppress", "description": "TCPA STOP received."},
    {"trigger_id": "T-PF-1101", "trigger_class": "performance", "trigger_family": "drift", "name": "Email open rate drop", "priority": 80, "condition_event_code": "pf_open_rate_drop", "action_type": "investigation_alert", "description": "Open rate dropped >10% WoW."},
    {"trigger_id": "T-T-1301", "trigger_class": "time", "trigger_family": "calendar", "name": "Hourly reconciliation", "priority": 99, "condition_event_code": "t_hourly", "action_type": "hourly_reconciliation", "description": "Every hour reconcile donations vs budget."},
]


class Database:
    def __init__(self, db_url):
        self.db_url = db_url
        self._conn = None

    def conn(self):
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.db_url)
            self._conn.autocommit = False
        return self._conn

    def execute(self, sql, params=None, commit=True):
        c = self.conn()
        cur = c.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(sql, params)
            if commit:
                c.commit()
            return cur
        except Exception:
            c.rollback()
            raise

    def fetchall(self, sql, params=None):
        cur = self.execute(sql, params, commit=False)
        return [dict(r) for r in cur.fetchall()]

    def fetchone(self, sql, params=None):
        cur = self.execute(sql, params, commit=False)
        row = cur.fetchone()
        return dict(row) if row else None

    def close(self):
        if self._conn and not self._conn.closed:
            self._conn.close()


class TriggerMatcher:
    def __init__(self, db):
        self.db = db
        self.triggers = {}
        self.triggers_by_event_code = {}

    def load(self):
        rows = self.db.fetchall("SELECT * FROM brain.triggers WHERE active = TRUE ORDER BY priority DESC")
        self.triggers = {r['trigger_id']: r for r in rows}
        self.triggers_by_event_code = {}
        for t in rows:
            code = t.get('condition_event_code')
            if code:
                self.triggers_by_event_code.setdefault(code, []).append(t)
        logger.info(f"Loaded {len(self.triggers)} triggers.")

    def match(self, event_code):
        return self.triggers_by_event_code.get(event_code, [])

    def in_cooldown(self, trigger, donor_id, candidate_id):
        if trigger['cooldown_seconds'] <= 0:
            return False
        row = self.db.fetchone("""
            SELECT MAX(fired_at) as last_fired FROM brain.trigger_fire_history
            WHERE trigger_id = %s AND (donor_id = %s OR %s IS NULL)
            AND fired_at > NOW() - (%s || ' seconds')::interval
        """, (trigger['trigger_id'], donor_id, donor_id, str(trigger['cooldown_seconds'])))
        return row is not None and row.get('last_fired') is not None

    def record_fire(self, trigger, donor_id, candidate_id, event_data, action_taken, veto=False, veto_reason=None):
        cooldown_until = None
        if trigger['cooldown_seconds'] > 0:
            cooldown_until = datetime.utcnow() + timedelta(seconds=trigger['cooldown_seconds'])
        self.db.execute("""
            INSERT INTO brain.trigger_fire_history
                (trigger_id, donor_id, candidate_id, event_data, action_taken, veto_applied, veto_reason, cooldown_until)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (trigger['trigger_id'], donor_id, candidate_id, json.dumps(event_data), json.dumps(action_taken), veto, veto_reason, cooldown_until))
        self.db.execute("UPDATE brain.triggers SET fire_count = fire_count + 1 WHERE trigger_id = %s", (trigger['trigger_id'],))


class ConstitutionalResolver:
    def __init__(self, db):
        self.db = db

    def check(self, action_type, donor_id, candidate_id):
        if donor_id is None:
            return None
        row = self.db.fetchone("""
            SELECT
                COALESCE(s_email_unsubscribed_flag, FALSE) AS email_unsub,
                COALESCE(s_sms_stop_flag, FALSE) AS sms_stop,
                COALESCE(s_phone_dnc_flag, FALSE) AS phone_dnc,
                COALESCE(s_global_optout_flag, FALSE) AS global_optout
            FROM core.donor_profile WHERE cluster_id = %s
        """, (donor_id,))
        if not row:
            return None
        if row.get('global_optout'):
            return 'platform: global_optout_flag'
        if action_type == 'email_send' and row.get('email_unsub'):
            return 'platform: s_email_unsubscribed_flag (CAN-SPAM)'
        if action_type == 'sms_send' and row.get('sms_stop'):
            return 'platform: s_sms_stop_flag (TCPA)'
        if action_type == 'phone_call' and row.get('phone_dnc'):
            return 'platform: s_phone_dnc_flag (TCPA)'
        contact_row = self.db.fetchone("""
            SELECT COUNT(*) AS n FROM brain.decisions
            WHERE donor_id = %s AND actually_taken = TRUE
            AND decided_at > CURRENT_DATE AND decision_result = 'go'
        """, (donor_id,))
        if contact_row and contact_row['n'] >= BrainConfig.MAX_DAILY_CONTACTS:
            return f'context: daily_contact_limit_{BrainConfig.MAX_DAILY_CONTACTS}'
        return None


class DecisionPolicy:
    def score(self, event_data, trigger, donor_id, candidate_id):
        breakdown = {}
        urgency = event_data.get('urgency', 5)
        breakdown['urgency'] = min(int(urgency * 2.5), 25)
        relevance = event_data.get('relevance', 7)
        breakdown['relevance'] = min(int(relevance * 2.5), 25)
        breakdown['priority'] = min(int(trigger['priority'] / 5), 20)
        breakdown['fatigue'] = 15
        breakdown['historical'] = 10
        return min(sum(breakdown.values()), 100), breakdown

    def decide(self, score):
        if score >= BrainConfig.GO_THRESHOLD:
            return 'go'
        elif score >= BrainConfig.REVIEW_THRESHOLD:
            return 'review'
        return 'no_go'


class BrainWorker:
    def __init__(self):
        self.db = Database(BrainConfig.DB_URL)
        self.trigger_matcher = TriggerMatcher(self.db)
        self.constitution = ConstitutionalResolver(self.db)
        self.policy = DecisionPolicy()
        self.running = True
        self.ready = False
        self.events_processed = 0
        self.decisions_made = 0
        self.started_at = datetime.utcnow()
        logger.info('Brain Worker initializing...')

    def bootstrap_schema(self):
        logger.info('Bootstrapping brain schema...')
        conn = psycopg2.connect(BrainConfig.DB_URL)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(BRAIN_SCHEMA_DDL)
        conn.close()
        logger.info('Brain schema ready.')

    def seed_triggers(self):
        count = self.db.fetchone('SELECT COUNT(*) AS n FROM brain.triggers')
        if count and count['n'] > 0:
            logger.info(f"Triggers already seeded ({count['n']} found).")
            return
        for t in CORE_TRIGGERS_SEED:
            self.db.execute("""
                INSERT INTO brain.triggers
                    (trigger_id, trigger_class, trigger_family, name, description,
                     condition_event_code, action_type, priority)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (trigger_id) DO NOTHING
            """, (t['trigger_id'], t['trigger_class'], t['trigger_family'], t['name'],
                  t['description'], t['condition_event_code'], t['action_type'], t['priority']))
        logger.info(f'Seeded {len(CORE_TRIGGERS_SEED)} core triggers.')

    def verify_canary(self):
        row = self.db.fetchone("""
            SELECT COUNT(*) AS txns, SUM(norm_amount) AS total
            FROM raw.ncboe_donations WHERE cluster_id = 372171
        """)
        if not row or row['txns'] != 147:
            logger.critical(f'CANARY FAIL: expected 147 txns, got {row}')
            return False
        logger.info(f"Canary verified: {row['txns']} txns / ${row['total']}")
        return True

    def process_event(self, event):
        start_ms = int(time.time() * 1000)
        event_type = event.get('event_type', '')
        event_data = event.get('event_data', {})
        donor_id = event.get('donor_id')
        candidate_id = event.get('candidate_id')
        decisions_count = 0
        matched = self.trigger_matcher.match(event_type)
        for trigger in matched:
            if self.trigger_matcher.in_cooldown(trigger, donor_id, candidate_id):
                continue
            action_type = trigger.get('action_type', 'log')
            veto_reason = self.constitution.check(action_type, donor_id, candidate_id)
            if veto_reason:
                self.trigger_matcher.record_fire(trigger, donor_id, candidate_id, event_data, {'action_type': action_type}, veto=True, veto_reason=veto_reason)
                self.db.execute("""
                    INSERT INTO brain.veto_log (veto_level, rule_reference, proposed_action, donor_id, candidate_id)
                    VALUES (%s,%s,%s,%s,%s)
                """, ('platform', veto_reason, json.dumps({'action_type': action_type}), donor_id, candidate_id))
                continue
            score, breakdown = self.policy.score(event_data, trigger, donor_id, candidate_id)
            result = self.policy.decide(score)
            processing_ms = int(time.time() * 1000) - start_ms
            if not BrainConfig.DRY_RUN:
                self.db.execute("""
                    INSERT INTO brain.decisions
                        (decision_type, donor_id, candidate_id, event_type, event_data,
                         proposed_action, actually_taken, decision_result, score,
                         score_breakdown, contributing_triggers, rationale, decided_by, processing_ms)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (action_type, donor_id, candidate_id, event_type, json.dumps(event_data),
                      json.dumps({'action_type': action_type, 'trigger': trigger['trigger_id']}),
                      result == 'go', result, score, json.dumps(breakdown),
                      [trigger['trigger_id']], f"Trigger {trigger['name']}. Score {score}/100.",
                      'brain', processing_ms))
                self.trigger_matcher.record_fire(trigger, donor_id, candidate_id, event_data, {'action_type': action_type, 'result': result})
            decisions_count += 1
            logger.info(f"Decision: {result.upper()} | {trigger['trigger_id']} | donor={donor_id} | score={score} | {processing_ms}ms")

            # Change A: enqueue weapon on every 'go' decision
            if result == 'go' and not BrainConfig.DRY_RUN:
                # Issue 3 fix: use RETURNING to get the decision_id we just inserted (race-safe)
                decision_cur = self.db.execute("""
                    SELECT decision_id FROM brain.decisions
                    WHERE donor_id=%s AND event_type=%s AND decision_result='go'
                    ORDER BY decided_at DESC LIMIT 1
                """, (donor_id, event_type), commit=False)
                decision_row = decision_cur.fetchone()
                if decision_row:
                    decision_id = decision_row['decision_id'] if hasattr(decision_row, '__getitem__') and not isinstance(decision_row, tuple) else decision_row[0]
                    self.db.execute("""
                        INSERT INTO brain.weapon_queue
                            (decision_id, trigger_id, donor_id, candidate_id, action_type, payload, status, test_mode)
                        VALUES (%s,%s,%s,%s,%s,%s,'queued',%s)
                    """, (decision_id, trigger['trigger_id'], donor_id, candidate_id,
                          action_type, json.dumps({'event_type': event_type, 'trigger_id': trigger['trigger_id'], **event_data}),
                          BrainConfig.TEST_MODE))

        return decisions_count


    def drain_weapon_queue(self):
        """
        Mountain 2 patch — drain queued weapons → dispatch → outcome measurement.
        
        SENDS_ENABLED = False (dark) until Ed rules R4 + issues I AUTHORIZE THIS ACTION.
        When dark: observe_log written, no HTTP dispatch, journey row written with
        journey_state='queued' (not 'dispatched').
        
        Live brain.weapon_queue columns (17, verified 2026-07-25):
          weapon_id (uuid), decision_id, trigger_id, donor_id (bigint NULL),
          candidate_id (integer NULL), action_type, payload (jsonb),
          status, executor_endpoint, http_response, attempts, max_attempts,
          queued_at, dispatched_at, delivered_at, error_message, test_mode
        
        NO weapon_code, cluster_id, bgop_trace_id on the row — source from payload JSONB.
        """
        from outcome.outcome_writer import on_weapon_dispatched, extract_dispatch_fields
        import requests as _requests

        # ── SENDS_ENABLED gate ────────────────────────────────────────────────
        # Change to True only after R4 ruled + Ed says I AUTHORIZE THIS ACTION for sends
        SENDS_ENABLED = False  # DARK

        weapons = self.db.fetchall(
            "SELECT * FROM brain.weapon_queue WHERE status='queued' ORDER BY queued_at LIMIT %s",
            (BrainConfig.WEAPON_BATCH,))

        drained = 0
        for w in weapons:
            try:
                # ── Extract payload JSONB fields ──────────────────────────────
                payload = w.get('payload') or {}
                if isinstance(payload, str):
                    import json as _json
                    payload = _json.loads(payload)

                # weapon_code: from payload or derive from action_type
                weapon_code = payload.get('weapon_code') or self._action_type_to_weapon_code(w.get('action_type', ''))
                bgop_trace_id = payload.get('bgop_trace_id')
                microsegment_key = payload.get('microsegment_key')
                issue_code = payload.get('issue_code')
                ask_tier = payload.get('ask_tier')

                # cluster_id: donor_id bigint == cluster_id integer (same identity)
                donor_id = w.get('donor_id')
                cluster_id = int(donor_id) if donor_id is not None else None

                # Resolve rnc_regid for observe_log (unchanged from original)
                rnc_regid = None
                if cluster_id:
                    donor_row = self.db.fetchone(
                        "SELECT rnc_regid FROM core.donor_profile WHERE cluster_id=%s",
                        (cluster_id,))
                    if donor_row:
                        rnc_regid = donor_row.get('rnc_regid')

                # ── Executor resolution (unchanged from original) ──────────────
                event_class = payload.get('event_type', '')
                ex = self.db.fetchone("""
                    SELECT executor_code, handler_endpoint, enabled
                    FROM brain.action_executors
                    WHERE weapon=%s AND event_class=%s
                      AND ecosystem_code NOT LIKE '%%TEST%%'
                    LIMIT 1""",
                    (w['action_type'], event_class))
                if not ex:
                    ex = self.db.fetchone("""
                        SELECT executor_code, handler_endpoint, enabled
                        FROM brain.action_executors
                        WHERE (weapon=%s OR event_class=%s)
                          AND ecosystem_code NOT LIKE '%%TEST%%'
                        ORDER BY enabled DESC LIMIT 1""",
                        (w['action_type'], event_class))

                executor_code = ex['executor_code'] if ex else 'EXEC_TEST_OBSERVE'
                handler_endpoint = (ex or {}).get('handler_endpoint')
                mode = 'observe' if (w.get('test_mode') or BrainConfig.OBSERVE_ONLY or not SENDS_ENABLED) else 'fire'

                # ── Write observe_log (unchanged behavior) ────────────────────
                import json as _json2
                self.db.execute("""
                    INSERT INTO brain.observe_log
                      (executor_code, event_queue_id, cluster_id, rnc_regid,
                       weapon, event_class, mode, actually_taken, observe_response, trace_id)
                    VALUES (%s, NULL, %s, %s, %s, %s, %s, false, %s, %s)
                """, (
                    executor_code,
                    cluster_id,
                    rnc_regid,
                    w['action_type'],
                    event_class,
                    mode,
                    _json2.dumps({'status': 'observed', 'weapon_id': str(w['weapon_id'])}),
                    f"AUTO_OBSERVE_{w['weapon_id']}",
                ))

                # ── FIRE path (only when SENDS_ENABLED = True) ────────────────
                provider_message_id = None
                provider_ack_raw = {}
                http_response_code = None

                if SENDS_ENABLED and mode == 'fire' and handler_endpoint:
                    # Build dispatch payload
                    dispatch_payload = {
                        **payload,
                        'weapon_id': str(w['weapon_id']),
                        'cluster_id': cluster_id,
                        'bgop_trace_id': bgop_trace_id,
                        'weapon_code': weapon_code,
                    }

                    try:
                        response = _requests.post(
                            handler_endpoint,
                            json=dispatch_payload,
                            timeout=30,
                            headers={'X-BGOP-Trace': bgop_trace_id or ''},
                        )
                        http_response_code = response.status_code
                        provider_ack_raw = response.json() if response.content else {}
                        provider_message_id = provider_ack_raw.get('provider_message_id')

                        if response.status_code != 200:
                            logger.error(
                                "Executor %s returned %s for weapon %s",
                                executor_code, response.status_code, w['weapon_id']
                            )
                            # Mark failed — do not write journey row
                            self.db.execute("""
                                UPDATE brain.weapon_queue
                                SET status='failed',
                                    error_message=%s,
                                    attempts=attempts+1
                                WHERE weapon_id=%s
                            """, (f"HTTP {response.status_code}", w['weapon_id']))
                            continue

                    except Exception as exc:
                        logger.error("HTTP dispatch failed for weapon %s: %s", w['weapon_id'], exc)
                        self.db.execute("""
                            UPDATE brain.weapon_queue
                            SET status='failed', error_message=%s, attempts=attempts+1
                            WHERE weapon_id=%s
                        """, (str(exc)[:500], w['weapon_id']))
                        continue

                    # ── Write journey row (FIRE mode only) ────────────────────
                    try:
                        on_weapon_dispatched(
                            db_url=self.db_url,
                            weapon_queue_id=w['weapon_id'],
                            weapon_code=weapon_code,
                            donor_id=donor_id,
                            candidate_id_int=w.get('candidate_id'),
                            microsegment_key=microsegment_key,
                            action_type=w.get('action_type', ''),
                            queued_at=w.get('queued_at'),
                            provider_message_id=provider_message_id,
                            provider_ack_raw=provider_ack_raw,
                            bgop_trace_id=bgop_trace_id,
                            issue_code=issue_code,
                            ask_tier=ask_tier,
                        )
                    except Exception as exc:
                        logger.error(
                            "on_weapon_dispatched failed for weapon %s: %s",
                            w['weapon_id'], exc
                        )
                        # Non-fatal: weapon fired, journey write failed
                        # Log and continue — do not leave weapon in 'queued'

                # ── Mark weapon delivered (fire + observe both mark delivered) ─
                self.db.execute("""
                    UPDATE brain.weapon_queue
                    SET status='delivered',
                        dispatched_at=NOW(),
                        delivered_at=NOW(),
                        attempts=attempts+1,
                        http_response=%s
                    WHERE weapon_id=%s
                """, (
                    _json2.dumps(provider_ack_raw) if provider_ack_raw else None,
                    w['weapon_id'],
                ))
                drained += 1

            except Exception as exc:
                logger.error("drain error for weapon %s: %s", w.get('weapon_id', '?'), exc)
                # Leave in 'queued' for retry — do not crash the daemon

        if drained > 0:
            logger.info(
                "Drained %d weapons (SENDS_ENABLED=%s mode=%s)",
                drained, SENDS_ENABLED, 'fire' if SENDS_ENABLED else 'observe'
            )
        return drained

    def _action_type_to_weapon_code(self, action_type: str) -> str:
        """
        Fallback weapon code from action_type when payload has no weapon_code.
        Verified from 314_brain_action_executors_seed.sql + DRYRUN_BRAIN_GEARBOX_EXECUTORS.
        """
        _MAP = {
            'EXEC_E30_EMAIL_SEND':    'email',
            'EXEC_E31_SMS_SEND':      'sms',
            'EXEC_E17_RVM_DROP':      'rvm',
            'EXEC_E18_PHONE_CALL':    'call',
            'EXEC_E16_DIRECT_MAIL':   'mail',
            'EXEC_E19_SOCIAL_POST':   'social',
            'EXEC_E30_EMAIL_BURST':   'email_burst',
        }
        code = _MAP.get(action_type, action_type.lower())
        return code

    def poll_event_queue(self):
        events = self.db.fetchall("""
            SELECT * FROM brain.event_queue
            WHERE status = 'pending' AND scheduled_for <= NOW()
            ORDER BY priority DESC, scheduled_for ASC LIMIT 100
        """)
        processed = 0
        for event in events:
            try:
                self.db.execute("UPDATE brain.event_queue SET status='processing', attempts=attempts+1 WHERE event_id=%s", (event['event_id'],))
                decisions = self.process_event(event)
                self.db.execute("UPDATE brain.event_queue SET status='completed', processed_at=NOW() WHERE event_id=%s", (event['event_id'],))
                processed += 1
                self.events_processed += 1
                self.decisions_made += decisions
            except Exception as e:
                logger.error(f"Event error {event['event_id']}: {e}")
                self.db.execute("UPDATE brain.event_queue SET status='failed', error_message=%s WHERE event_id=%s", (str(e), event['event_id']))
        return processed

    def run_hourly_reconciliation(self):
        logger.info('Running hourly reconciliation...')
        try:
            candidates = self.db.fetchall("SELECT candidate_id FROM core.candidate_profile WHERE active = TRUE LIMIT 100")
            logger.info(f'Hourly: {len(candidates)} active candidates.')
            self.db.execute("INSERT INTO brain.event_queue (event_type, event_class, event_data, priority) VALUES ('t_hourly','time','{\"source\": \"hourly_cron\"}',99)")
        except Exception as e:
            logger.warning(f'Hourly reconciliation skipped: {e}')

    def publish_heartbeat(self):
        try:
            self.db.execute("UPDATE brain.heartbeat SET last_heartbeat=NOW(), events_processed=%s, decisions_made=%s WHERE id=1", (self.events_processed, self.decisions_made))
        except Exception as e:
            logger.warning(f'Heartbeat failed: {e}')

    def shutdown(self, *args):
        logger.info('Shutdown signal received.')
        self.running = False
        self.ready = False

    def run(self):
        signal.signal(signal.SIGTERM, self.shutdown)
        signal.signal(signal.SIGINT, self.shutdown)
        self.bootstrap_schema()
        self.seed_triggers()
        if not self.verify_canary():
            logger.critical('CANARY FAILED. Brain will NOT start.')
            return
        self.trigger_matcher.load()
        if BrainConfig.DRY_RUN:
            logger.info('DRY RUN MODE.')
        self.ready = True
        logger.info(f'Brain Worker ONLINE | Triggers: {len(self.trigger_matcher.triggers)}')
        last_heartbeat = time.time()
        last_hourly = -1
        while self.running:
            try:
                self.poll_event_queue()
                self.drain_weapon_queue()  # Change C: drain weapons after polling events
                now = time.time()
                if now - last_heartbeat >= BrainConfig.HEARTBEAT_INTERVAL:
                    self.publish_heartbeat()
                    last_heartbeat = now
                current_hour = datetime.utcnow().hour
                if current_hour != last_hourly:
                    self.run_hourly_reconciliation()
                    last_hourly = current_hour
                if int(now) % 300 == 0:
                    self.trigger_matcher.load()
                time.sleep(BrainConfig.POLL_INTERVAL)
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f'Loop error: {e}')
                time.sleep(10)
        logger.info(f'Brain Worker shutdown. Events: {self.events_processed} | Decisions: {self.decisions_made}')
        self.db.close()


if __name__ == '__main__':
    import sys
    if '--self-test' in sys.argv:
        print('Brain Worker self-test...')
        db = Database(BrainConfig.DB_URL)
        try:
            db.fetchone('SELECT 1')
            print('✓ Postgres reachable')
            print('✓ Self-test complete. Daemon would start successfully.')
        except Exception as e:
            print(f'✗ Postgres unreachable: {e}')
            sys.exit(1)
        sys.exit(0)
    BrainWorker().run()
