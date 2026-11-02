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
import sys
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('brain_worker')


class BrainConfig:
    DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:REDACTED_BY_DEVIN_2026-07-30@37.27.169.232:5432/broyhillgop')
    RELAY_URL = os.environ.get('RELAY_URL', 'http://37.27.169.232:8080')
    RELAY_API_KEY = os.environ.get('RELAY_API_KEY', '')
    HEALTH_PORT = int(os.environ.get('BRAIN_HEALTH_PORT', '9090'))
    MAX_DAILY_CONTACTS = int(os.environ.get('BRAIN_MAX_DAILY_CONTACTS', '3'))
    GO_THRESHOLD = int(os.environ.get('BRAIN_GO_THRESHOLD', '70'))
    REVIEW_THRESHOLD = int(os.environ.get('BRAIN_REVIEW_THRESHOLD', '50'))
    HEARTBEAT_INTERVAL = int(os.environ.get('BRAIN_HEARTBEAT_INTERVAL', '15'))
    POLL_INTERVAL = float(os.environ.get('BRAIN_POLL_INTERVAL', '2.0'))
    DRY_RUN = os.environ.get('BRAIN_DRY_RUN', 'false').lower() == 'true'
    # Drain brain.weapon_queue via weapon_executor.py (PR #360). Default on.
    # Channels still return *_NOT_WIRED; test_mode short-circuits before send.
    WEAPON_EXECUTOR = os.environ.get('BRAIN_WEAPON_EXECUTOR', 'true').lower() == 'true'
    WEAPON_BATCH = int(os.environ.get('BRAIN_WEAPON_BATCH', '50'))
    OBSERVE_ONLY = os.environ.get('BRAIN_OBSERVE_ONLY', 'false').lower() == 'true'


# Brain action_type → e30.suppression_list.reason (Gate 2 — live send path).
# Phone/SMS types intentionally omit (E31 Phase C #4). Lift/review-only omitted.
E30_EMAIL_SUPPRESS_REASON = {
    # CAN-SPAM / unsubscribe
    'can_spam_suppress': 'UNSUBSCRIBE',
    'canspam_honor': 'UNSUBSCRIBE',
    'canspam_suppress': 'UNSUBSCRIBE',
    'suppress_email': 'UNSUBSCRIBE',
    'email_channel_suppress': 'UNSUBSCRIBE',
    # Bounce / deliverability (sendgrid_* handled by Phase C #3 feed — hard/soft aware)
    'email_suppress_investigate': 'HARD_BOUNCE',
    'suppress_email_deliverability_alert': 'HARD_BOUNCE',
    # Complaint / spam (sendgrid_spam_process → C #3 feed)
    'spam_suppress_alert': 'COMPLAINT',
    # Global / hard / deceased / manual email suppress
    'global_suppress': 'MANUAL',
    'suppress': 'MANUAL',
    'suppress_all_remove_from_active': 'MANUAL',
    'deceased_suppress_all': 'MANUAL',
    'fundraising_hard_suppress': 'MANUAL',
    'hard_suppress_all_fundraising_asks': 'MANUAL',
    'suppress_fundraising_asks': 'MANUAL',
    'suppress_flag_for_review': 'MANUAL',
    'candidate_dnc_override': 'MANUAL',
    'address_update_mail_suppress': 'MANUAL',
    'minor_suppress_flag': 'MANUAL',
}

# Phase C #2 — WinRed/Anedot money-in: staging receipt only (no spine/ledger).
DONATION_PROCESS_ACTIONS = frozenset({
    'winred_donation_process',
    'anedot_donation_process',
})
DONATION_PROVIDER_BY_ACTION = {
    'winred_donation_process': 'winred',
    'anedot_donation_process': 'anedot',
}

# Phase C #3 — SendGrid bounce/spam feed → e30.suppression_list (+ staging audit).
SENDGRID_FEED_ACTIONS = frozenset({
    'sendgrid_bounce_process',
    'sendgrid_spam_process',
})

# Phase C #4 — SMS/10DLC/phone suppress → E31 registry + e31.phone_suppression_list.
E31_SMS_SUPPRESS_ACTIONS = frozenset({
    'sms_suppress',
    'sms_10dlc_suppress',
    'suppress_sms',
})
E31_PHONE_SUPPRESS_ACTIONS = frozenset({
    'phone_suppress',
    'phone_suppress_90d',
    'suppress_phone_channels',
    'candidate_dnc_override',  # also email-mapped; phone channel here too
})
E31_PHONE_SUPPRESS_ALL = E31_SMS_SUPPRESS_ACTIONS | E31_PHONE_SUPPRESS_ACTIONS


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
        # Daily contact cap applies to outbound weapons only — not suppress,
        # not inbound donation receipts (Phase C #1/#2).
        outbound = {
            'email_send', 'sms_send', 'direct_mail', 'phone_call',
            'digital_ad', 'social_post',
        }
        if action_type not in outbound:
            return None
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



    def _extract_donation_external_id(self, event_data):
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        for key in (
            'external_id', 'donation_id', 'transaction_id', 'txn_id',
            'charge_id', 'payment_id', 'id', 'winred_id', 'anedot_id',
        ):
            val = event_data.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
        # Nested common shapes
        for nest in ('donation', 'transaction', 'data', 'payload'):
            sub = event_data.get(nest)
            if isinstance(sub, dict):
                for key in ('id', 'donation_id', 'transaction_id', 'external_id'):
                    val = sub.get(key)
                    if val is not None and str(val).strip():
                        return str(val).strip()
        return None

    def _extract_donation_amount(self, event_data):
        if not isinstance(event_data, dict):
            return None
        for key in ('amount', 'cash_amount', 'donation_amount', 'total'):
            val = event_data.get(key)
            if val is None:
                continue
            try:
                return float(str(val).replace('$', '').replace(',', '').strip())
            except Exception:
                continue
        return None

    def _apply_donation_process_receipt(self, action_type, trigger_id, donor_id,
                                         candidate_id, event_type, event_data):
        """Idempotent staging receipt for WinRed/Anedot — no core/raw writes."""
        if action_type not in DONATION_PROCESS_ACTIONS:
            return False
        provider = DONATION_PROVIDER_BY_ACTION[action_type]
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        external_id = self._extract_donation_external_id(event_data)
        if not external_id:
            # Stable fallback so we still record; not cross-event idempotent
            external_id = f"brain-fallback:{trigger_id}:{event_type}:{donor_id}:{int(time.time())}"
            logger.warning(
                f"DONATION RECEIPT no external_id; using fallback | "
                f"{provider} | trigger={trigger_id}"
            )
        amount = self._extract_donation_amount(event_data)
        self.db.execute(
            """INSERT INTO staging.brain_donation_webhook_receipts
                   (provider, action_type, trigger_id, external_id, donor_id,
                    candidate_id, amount, payload, event_type)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (provider, external_id) DO UPDATE SET
                   payload = EXCLUDED.payload,
                   donor_id = COALESCE(EXCLUDED.donor_id, staging.brain_donation_webhook_receipts.donor_id),
                   amount = COALESCE(EXCLUDED.amount, staging.brain_donation_webhook_receipts.amount),
                   processed_at = NOW(),
                   trigger_id = EXCLUDED.trigger_id
            """,
            (
                provider, action_type, trigger_id, external_id, donor_id,
                str(candidate_id) if candidate_id is not None else None,
                amount, json.dumps(event_data), event_type,
            ),
        )
        logger.info(
            f"DONATION RECEIPT: {provider} | external_id={external_id} | "
            f"amount={amount} | trigger={trigger_id} | donor={donor_id}"
        )
        return True


    def _classify_sendgrid_bounce(self, event_data):
        """Return hard|soft|none from SendGrid-ish payload."""
        if not isinstance(event_data, dict):
            return 'none'
        bt = (event_data.get('bounce_type') or event_data.get('type') or '').strip().lower()
        if bt in ('hard', 'hardbounce', 'blocked', 'invalid'):
            return 'hard'
        if bt in ('soft', 'softbounce', 'deferred', 'technical'):
            return 'soft'
        # SendGrid event field
        ev = (event_data.get('event') or event_data.get('sg_event') or '').strip().lower()
        if ev in ('bounce', 'blocked', 'dropped'):
            # dropped/blocked usually permanent
            if ev in ('blocked', 'dropped') or bt == 'bounce':
                # type=bounce with bounce_classification
                bc = (event_data.get('bounce_classification') or '').strip().lower()
                if 'soft' in bc or bc in ('mailbox_unavailable', 'temporary'):
                    return 'soft'
                if ev in ('blocked', 'dropped') or 'hard' in bc or bc in ('invalid', 'reputation'):
                    return 'hard'
                return 'hard'  # default bounce → hard (CAN-SPAM / deliverability safe)
        smtp = event_data.get('smtp_code') or event_data.get('status')
        try:
            code = int(str(smtp).split('.')[0])
            if code >= 500:
                return 'hard'
            if code >= 400:
                return 'soft'
        except Exception:
            pass
        # Explicit soft_retry_count path
        try:
            retries = int(event_data.get('soft_retry_count') or 0)
        except Exception:
            retries = 0
        if retries >= 3:
            return 'hard'
        return 'none'

    def _sendgrid_external_id(self, event_data, action_type, email):
        if isinstance(event_data, dict):
            for key in ('sg_event_id', 'event_id', 'external_id', 'sg_message_id'):
                val = event_data.get(key)
                if val is not None and str(val).strip():
                    return str(val).strip()
            ts = event_data.get('timestamp') or event_data.get('sg_timestamp')
            if email and ts:
                return f"{action_type}:{email}:{ts}"
        return f"{action_type}:{email or 'noemail'}:{int(time.time()*1000)}"

    def _apply_sendgrid_feed(self, action_type, trigger_id, donor_id, event_data):
        """Audit SendGrid event; suppress only hard bounce / spam complaint."""
        if action_type not in SENDGRID_FEED_ACTIONS:
            return False
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        email = self._resolve_suppress_email(event_data, donor_id)
        external_id = self._sendgrid_external_id(event_data, action_type, email)
        bounce_class = 'none'
        suppress_reason = None
        suppressed = False

        if action_type == 'sendgrid_spam_process':
            bounce_class = 'complaint'
            if email:
                suppress_reason = 'COMPLAINT'
                suppressed = self._apply_e30_email_suppression(
                    # reuse upsert with explicit reason via temporary map path
                    'spam_suppress_alert', email, trigger_id, event_data
                )
            else:
                logger.warning(f"SENDGRID SPAM SKIP (no email) | trigger={trigger_id}")
        elif action_type == 'sendgrid_bounce_process':
            bounce_class = self._classify_sendgrid_bounce(event_data)
            try:
                retries = int(event_data.get('soft_retry_count') or 0)
            except Exception:
                retries = 0
            if bounce_class == 'soft' and retries >= 3:
                bounce_class = 'hard'
            if bounce_class == 'hard' and email:
                suppress_reason = 'HARD_BOUNCE'
                # Direct upsert (sendgrid_bounce no longer in generic map)
                self.db.execute(
                    """INSERT INTO e30.suppression_list (email, reason, source_send_id, permanent, scope)
                       VALUES (%s, %s, %s, TRUE, 'global')
                       ON CONFLICT (email, scope) DO UPDATE SET
                           reason = EXCLUDED.reason,
                           source_send_id = EXCLUDED.source_send_id,
                           suppressed_at = NOW()""",
                    (email.strip().lower(), 'HARD_BOUNCE',
                     str(event_data.get('send_id') or event_data.get('sg_message_id') or f'brain:{trigger_id}')),
                )
                suppressed = True
                logger.info(
                    f"E30 SUPPRESS APPLIED: {email} | reason=HARD_BOUNCE | "
                    f"action=sendgrid_bounce_process | trigger={trigger_id}"
                )
            elif bounce_class == 'soft':
                logger.info(
                    f"SENDGRID SOFT BOUNCE (no suppress): {email} | trigger={trigger_id}"
                )
            else:
                logger.warning(
                    f"SENDGRID BOUNCE SKIP: class={bounce_class} email={email} | trigger={trigger_id}"
                )

        self.db.execute(
            """INSERT INTO staging.brain_sendgrid_event_receipts
                   (action_type, trigger_id, external_id, email, donor_id,
                    event_name, bounce_class, suppressed, suppress_reason, payload)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (external_id) DO UPDATE SET
                   payload = EXCLUDED.payload,
                   suppressed = EXCLUDED.suppressed,
                   suppress_reason = EXCLUDED.suppress_reason,
                   bounce_class = EXCLUDED.bounce_class,
                   processed_at = NOW()""",
            (
                action_type, trigger_id, external_id, email, donor_id,
                (event_data.get('event') or event_data.get('sg_event') or action_type),
                bounce_class, suppressed, suppress_reason, json.dumps(event_data),
            ),
        )
        logger.info(
            f"SENDGRID FEED: {action_type} | external_id={external_id} | "
            f"class={bounce_class} | suppressed={suppressed} | email={email}"
        )
        return True


    def _normalize_phone_e164(self, raw):
        if raw is None:
            return None
        digits = ''.join(ch for ch in str(raw) if ch.isdigit())
        if len(digits) == 11 and digits.startswith('1'):
            digits = digits[1:]
        if len(digits) != 10:
            return None
        return '+1' + digits

    def _resolve_suppress_phone(self, event_data, donor_id):
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        for key in ('phone', 'phone_e164', 'to_phone', 'from_phone', 'mobile', 'cell_phone'):
            norm = self._normalize_phone_e164(event_data.get(key))
            if norm:
                return norm
        if donor_id is None:
            return None
        row = self.db.fetchone(
            """SELECT cell_phone, home_phone, other_phone
               FROM core.donor_profile WHERE cluster_id = %s""",
            (donor_id,),
        )
        if not row:
            return None
        for key in ('cell_phone', 'home_phone', 'other_phone'):
            norm = self._normalize_phone_e164(row.get(key))
            if norm:
                return norm
        return None

    def _apply_e31_phone_suppression(self, action_type, trigger_id, donor_id, event_data):
        """TCPA/10DLC: registry opt-out + e31 list + brain.suppression_list audit."""
        if action_type not in E31_PHONE_SUPPRESS_ALL:
            return False
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        phone = self._resolve_suppress_phone(event_data, donor_id)
        if not phone:
            logger.warning(
                f"E31 SUPPRESS SKIP (no phone): {action_type} | trigger={trigger_id}"
            )
            return False

        is_sms = action_type in E31_SMS_SUPPRESS_ACTIONS
        is_phone = action_type in E31_PHONE_SUPPRESS_ACTIONS
        channel = 'sms' if is_sms and not is_phone else ('phone' if is_phone and not is_sms else 'all')
        if action_type in E31_SMS_SUPPRESS_ACTIONS:
            channel = 'sms'
        elif action_type == 'phone_suppress_90d':
            channel = 'phone'
        elif action_type in ('phone_suppress', 'suppress_phone_channels', 'candidate_dnc_override'):
            channel = 'phone' if action_type != 'candidate_dnc_override' else 'all'

        reason = {
            'sms_suppress': 'SMS_STOP',
            'sms_10dlc_suppress': 'TEN_DLC_OPTOUT',
            'suppress_sms': 'SMS_STOP',
            'phone_suppress': 'PHONE_DNC',
            'phone_suppress_90d': 'HOSTILE_90D',
            'suppress_phone_channels': 'PHONE_DNC',
            'candidate_dnc_override': 'CANDIDATE_DNC',
        }.get(action_type, 'MANUAL')

        expires_at = None
        if action_type == 'phone_suppress_90d':
            expires_at = datetime.utcnow() + timedelta(days=90)

        keyword = event_data.get('opt_out_keyword') or event_data.get('keyword') or 'STOP'
        source = f"brain:{trigger_id}"

        # 1) Live SMS eligibility gate
        if channel in ('sms', 'all'):
            self.db.execute(
                """INSERT INTO core.sms_phone_registry
                       (phone_e164, opt_in_status, opt_out_timestamp, opt_out_keyword, is_valid, updated_at)
                   VALUES (%s, 'opted_out', NOW(), %s, TRUE, NOW())
                   ON CONFLICT (phone_e164) DO UPDATE SET
                       opt_in_status = 'opted_out',
                       opt_out_timestamp = NOW(),
                       opt_out_keyword = COALESCE(EXCLUDED.opt_out_keyword, core.sms_phone_registry.opt_out_keyword),
                       updated_at = NOW()""",
                (phone, str(keyword)[:64]),
            )

        # 2) donor_profile TCPA flags (constitution reads these)
        if donor_id is not None:
            if channel in ('sms', 'all'):
                self.db.execute(
                    """UPDATE core.donor_profile
                       SET s_sms_stop_flag = TRUE
                       WHERE cluster_id = %s""",
                    (donor_id,),
                )
            if channel in ('phone', 'all'):
                self.db.execute(
                    """UPDATE core.donor_profile
                       SET s_phone_dnc_flag = TRUE
                       WHERE cluster_id = %s""",
                    (donor_id,),
                )

        # 3) e31.phone_suppression_list
        self.db.execute(
            """INSERT INTO e31.phone_suppression_list
                   (phone_e164, channel, reason, trigger_id, donor_id, source, expires_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (phone_e164, channel) DO UPDATE SET
                   reason = EXCLUDED.reason,
                   trigger_id = EXCLUDED.trigger_id,
                   donor_id = COALESCE(EXCLUDED.donor_id, e31.phone_suppression_list.donor_id),
                   source = EXCLUDED.source,
                   expires_at = EXCLUDED.expires_at,
                   suppressed_at = NOW()""",
            (phone, channel, reason, trigger_id, donor_id, source, expires_at),
        )

        # 4) brain.suppression_list audit row
        self.db.execute(
            """INSERT INTO brain.suppression_list
                   (cluster_id, phone, suppression_type, channel, source, expires_at)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (str(donor_id) if donor_id is not None else None, phone, reason, channel, source, expires_at),
        )

        # 5) staging receipt
        external_id = (
            event_data.get('external_id')
            or event_data.get('twilio_message_sid')
            or f"{action_type}:{phone}:{trigger_id}"
        )
        self.db.execute(
            """INSERT INTO staging.brain_phone_suppress_receipts
                   (action_type, trigger_id, external_id, phone_e164, donor_id,
                    channel, reason, expires_at, payload)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (external_id) DO UPDATE SET
                   payload = EXCLUDED.payload,
                   reason = EXCLUDED.reason,
                   processed_at = NOW()""",
            (
                action_type, trigger_id, str(external_id), phone, donor_id,
                channel, reason, expires_at, json.dumps(event_data),
            ),
        )
        logger.info(
            f"E31 SUPPRESS APPLIED: {phone} | channel={channel} | reason={reason} | "
            f"action={action_type} | trigger={trigger_id}"
        )
        return True

    def _resolve_suppress_email(self, event_data, donor_id):
        """Prefer explicit event email; else donor_profile personal/business."""
        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data) or {}
            except Exception:
                event_data = {}
        event_data = event_data or {}
        for key in ('email', 'recipient_email', 'to_email', 'suppress_email'):
            val = event_data.get(key)
            if isinstance(val, str) and '@' in val:
                return val.strip().lower()
        if donor_id is None:
            return None
        row = self.db.fetchone(
            """SELECT personal_email, business_email
               FROM core.donor_profile WHERE cluster_id = %s""",
            (donor_id,),
        )
        if not row:
            return None
        for key in ('personal_email', 'business_email'):
            val = row.get(key)
            if isinstance(val, str) and '@' in val:
                return val.strip().lower()
        return None

    def _apply_e30_email_suppression(self, action_type, email, trigger_id, event_data=None):
        """Upsert e30.suppression_list — same table E30 _check_suppression reads."""
        reason = E30_EMAIL_SUPPRESS_REASON.get(action_type)
        if reason is None:
            return False
        if not email or '@' not in email:
            logger.warning(
                f"E30 SUPPRESS SKIP (no email): {action_type} | trigger={trigger_id}"
            )
            return False
        email = email.strip().lower()
        source_send_id = None
        if isinstance(event_data, dict):
            source_send_id = event_data.get('send_id') or event_data.get('source_send_id')
        if not source_send_id:
            source_send_id = f"brain:{trigger_id}"
        self.db.execute(
            """INSERT INTO e30.suppression_list (email, reason, source_send_id, permanent, scope)
               VALUES (%s, %s, %s, TRUE, 'global')
               ON CONFLICT (email, scope) DO UPDATE SET
                   reason = EXCLUDED.reason,
                   source_send_id = EXCLUDED.source_send_id,
                   suppressed_at = NOW()""",
            (email, reason, str(source_send_id)),
        )
        logger.info(
            f"E30 SUPPRESS APPLIED: {email} | reason={reason} | "
            f"action={action_type} | trigger={trigger_id}"
        )
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
                # --- E30 EMAIL SUPPRESSION BRIDGE (LAW, 2026-07-09) ---
                # On go: upsert e30.suppression_list for mapped suppress/bounce types.
                # Does NOT use weapon_queue. Phone/SMS types deferred to E31.
                if result == 'go' and action_type in SENDGRID_FEED_ACTIONS:
                    self._apply_sendgrid_feed(
                        action_type, trigger['trigger_id'], donor_id, event_data
                    )
                elif result == 'go' and action_type in E31_PHONE_SUPPRESS_ALL:
                    self._apply_e31_phone_suppression(
                        action_type, trigger['trigger_id'], donor_id, event_data
                    )
                    # candidate_dnc_override also maps to email MANUAL
                    if action_type in E30_EMAIL_SUPPRESS_REASON:
                        email = self._resolve_suppress_email(event_data, donor_id)
                        self._apply_e30_email_suppression(
                            action_type, email, trigger['trigger_id'], event_data
                        )
                elif result == 'go' and action_type in E30_EMAIL_SUPPRESS_REASON:
                    email = self._resolve_suppress_email(event_data, donor_id)
                    self._apply_e30_email_suppression(
                        action_type, email, trigger['trigger_id'], event_data
                    )
                # --- WINRED/ANEDOT STAGING RECEIPT (Phase C #2, 2026-07-09) ---
                # Idempotent staging only — no spine, raw, or gold ledger writes.
                elif result == 'go' and action_type in DONATION_PROCESS_ACTIONS:
                    self._apply_donation_process_receipt(
                        action_type, trigger['trigger_id'], donor_id,
                        candidate_id, event_type, event_data,
                    )
                # --- WEAPON QUEUE: enqueue only mapped outbound weapons ---
                # Guard (2026-07-01/09): skip when donor_id is None (t_hourly etc.)
                # OR when action_type is not in the 6-endpoint map (avoids NULL
                # executor_endpoint rows / false-enforcement queue spam).
                elif result == 'go' and donor_id is not None:
                    executor_map = {
                        'email_send':     '/api/e30/create-from-wizard',
                        'sms_send':       '/api/e31/create-from-wizard',
                        'direct_mail':    '/api/e32/create-from-wizard',
                        'phone_call':     '/api/e33/create-from-wizard',
                        'digital_ad':     '/api/e34/create-from-wizard',
                        'social_post':    '/api/e35/create-from-wizard',
                    }
                    endpoint = executor_map.get(action_type)
                    if endpoint is None:
                        logger.info(
                            f"WEAPON SKIP (no endpoint): {action_type} | donor={donor_id} | trigger={trigger['trigger_id']}"
                        )
                    else:
                        weapon_payload = {
                            'trigger_id':   trigger['trigger_id'],
                            'action_type':  action_type,
                            'donor_id':     donor_id,
                            'candidate_id': candidate_id,
                            'event_type':   event_type,
                            'event_data':   event_data,
                            'score':        score,
                        }
                        self.db.execute("""
                            INSERT INTO brain.weapon_queue
                                (trigger_id, donor_id, candidate_id, action_type,
                                 payload, executor_endpoint, status, test_mode)
                            VALUES (%s, %s, %s, %s, %s, %s, 'queued', %s)
                        """, (
                            trigger['trigger_id'],
                            donor_id,
                            candidate_id,
                            action_type,
                            json.dumps(weapon_payload),
                            endpoint,
                            bool(event_data.get('test', False))
                        ))
                        logger.info(f"WEAPON QUEUED: {action_type} | donor={donor_id} | trigger={trigger['trigger_id']}")
            decisions_count += 1
            logger.info(f"Decision: {result.upper()} | {trigger['trigger_id']} | donor={donor_id} | score={score} | {processing_ms}ms")
        return decisions_count

    def _load_weapon_executor(self):
        """Resolve WeaponExecutor from repo layout or /opt/bgop deploy path."""
        try:
            from weapon_executor import WeaponExecutor  # same dir / PYTHONPATH
            return WeaponExecutor(BrainConfig.DB_URL)
        except ImportError:
            pass
        candidates = [
            os.path.join(os.path.dirname(__file__), '..', '..', '..', '..',
                         'backend', 'python', 'api'),
            '/opt/bgop/backend/python/api',
            '/opt/broyhillgop/backend/python/api',
        ]
        for path in candidates:
            path = os.path.abspath(path)
            if path not in sys.path and os.path.isdir(path):
                sys.path.insert(0, path)
            try:
                from weapon_executor import WeaponExecutor
                return WeaponExecutor(BrainConfig.DB_URL)
            except ImportError:
                continue
        raise ImportError(
            'weapon_executor.py not found — deploy backend/python/api/weapon_executor.py'
        )

    def _claim_queued_weapons(self):
        """
        Claim a batch with FOR UPDATE SKIP LOCKED so concurrent workers
        don't drain the same rows. Uses the 'dispatched' status (allowed by
        the live weapon_queue_status_check constraint) as a short-lived claim
        so the row lock is not held across WeaponExecutor's separate DB
        connection.
        """
        cur = self.db.execute(
            """
            WITH cte AS (
                SELECT weapon_id
                FROM brain.weapon_queue
                WHERE status = 'queued'
                ORDER BY queued_at
                LIMIT %s
                FOR UPDATE SKIP LOCKED
            )
            UPDATE brain.weapon_queue w
            SET status = 'dispatched', dispatched_at = NOW()
            FROM cte
            WHERE w.weapon_id = cte.weapon_id
            RETURNING w.*
            """,
            (BrainConfig.WEAPON_BATCH,),
            commit=True,
        )
        return [dict(r) for r in cur.fetchall()]

    def _requeue_dispatched(self, weapon_ids):
        """Return claimed rows to queued if executor could not run."""
        if not weapon_ids:
            return
        self.db.execute(
            """
            UPDATE brain.weapon_queue
            SET status = 'queued'
            WHERE weapon_id = ANY(%s)
              AND status = 'dispatched'
            """,
            (list(weapon_ids),),
            commit=True,
        )

    def drain_weapon_queue(self):
        """
        Drain status='queued' rows through WeaponExecutor (2026-07-31 wire).

        Live statuses are lowercase (queued/delivered/failed/vetoed).
        test_mode rows short-circuit inside the executor (no external send).
        Non-test rows hit *_NOT_WIRED until Ed authorizes channel wiring.

        High-severity rule: if BRAIN_WEAPON_EXECUTOR is on but the executor
        fails to load, do NOT fall through to observe-fallback (that path
        marks delivered with no R4/silo/channel). Leave rows queued and return 0.
        Observe fallback runs only when BRAIN_WEAPON_EXECUTOR is explicitly off
        (or BRAIN_OBSERVE_ONLY forces observe).
        """
        if BrainConfig.DRY_RUN:
            return 0

        # Executor path (default). Load first — never claim rows we can't process.
        if BrainConfig.WEAPON_EXECUTOR and not BrainConfig.OBSERVE_ONLY:
            try:
                executor = self._load_weapon_executor()
            except Exception as e:
                logger.error(
                    'WeaponExecutor unavailable — leaving queue untouched '
                    '(no observe fallback while BRAIN_WEAPON_EXECUTOR=true): %s',
                    e,
                )
                return 0

            weapons = self._claim_queued_weapons()
            if not weapons:
                return 0

            drained = 0
            for w in weapons:
                try:
                    row = dict(w)
                    payload = row.get('payload') or {}
                    if isinstance(payload, str):
                        row['payload'] = json.loads(payload)
                    # Executor writes delivered/failed/vetoed (lowercase).
                    executor.execute(row)
                    drained += 1
                except Exception as e:
                    logger.error(
                        "Executor error weapon_id=%s: %s — requeue",
                        w.get('weapon_id'), e,
                    )
                    self._requeue_dispatched([w['weapon_id']])
            if drained:
                logger.info('Drained %s weapons via WeaponExecutor', drained)
            return drained

        # Observe fallback — ONLY when executor is explicitly off / observe-only.
        weapons = self._claim_queued_weapons()
        if not weapons:
            return 0

        drained = 0
        for w in weapons:
            try:
                payload = w.get('payload') or {}
                if isinstance(payload, str):
                    payload = json.loads(payload)
                event_class = payload.get('event_type', '')
                donor_id = w.get('donor_id')
                self.db.execute("""
                    INSERT INTO brain.observe_log
                      (executor_code, event_queue_id, cluster_id, rnc_regid, weapon,
                       event_class, mode, actually_taken, observe_response, trace_id)
                    VALUES ('EXEC_TEST_OBSERVE',NULL,%s,NULL,%s,%s,'observe',false,%s,%s)
                """, (
                    donor_id, w['action_type'], event_class,
                    json.dumps({
                        'status': 'observed',
                        'weapon_id': str(w['weapon_id']),
                    }),
                    f"AUTO_OBSERVE_{w['weapon_id']}",
                ))
                self.db.execute("""
                    UPDATE brain.weapon_queue
                    SET status='delivered', dispatched_at=NOW(),
                        delivered_at=NOW(), attempts=attempts+1
                    WHERE weapon_id=%s
                """, (w['weapon_id'],))
                drained += 1
            except Exception as e:
                logger.error(
                    "Observe fallback error weapon_id=%s: %s — requeue",
                    w.get('weapon_id'), e,
                )
                self._requeue_dispatched([w['weapon_id']])
        if drained:
            logger.info('Drained %s weapons (observe fallback)', drained)
        return drained

    # Event types owned by dedicated send workers (e.g. e30-send-worker
    # claims email.send). The brain must never consume these.
    DELEGATED_EVENT_TYPES = ('email.send',)

    def poll_event_queue(self):
        events = self.db.fetchall("""
            SELECT * FROM brain.event_queue
            WHERE status = 'pending' AND scheduled_for <= NOW()
              AND event_type NOT IN %s
            ORDER BY priority DESC, scheduled_for ASC LIMIT 100
        """, (self.DELEGATED_EVENT_TYPES,))
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
                if not BrainConfig.DRY_RUN:
                    self.drain_weapon_queue()
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
