#!/usr/bin/env python3
"""E30 send worker — wires brain.event_queue to the E30 enterprise email sender.

Consumes pending `email.send` events from brain.event_queue and dispatches them
through EnterpriseEmailSender's 4-gate compliance pipeline (match_tier,
suppression, consent, CAN-SPAM/FEC footer).

Safety layers (all default to the safe side):
  1. E30_WORKER_MODE=OBSERVE (default) — claims events, runs all gates, logs the
     verdict, marks the event 'observed'. No provider call. FIRE requires
     E30_WORKER_MODE=FIRE set explicitly by Ed.
  2. Provider itself defaults to stub (E30_PROVIDER_MODE=stub); live sends also
     require E30_PROVIDER_MODE=live + SENDGRID_API_KEY.
  3. Sacred canary verified every tick; aborts on mismatch.

Expected event_data payload (produced by E19/E26/wizard):
  {recipient_email, subject, body_html, body_text?, match_tier,
   donor_cluster_id, candidate_id, is_fundraising?, campaign_id?}

Env: HETZNER_DB_DSN (required) · E30_WORKER_MODE · E30_TICK_SECONDS (60)
     E30_BATCH_LIMIT (25)
"""

import os
import sys
import time
import json
import logging

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import psycopg2
import psycopg2.extras

from ecosystems.e30_enterprise_email_sender import (
    EnterpriseEmailSender, PersonalizedMessage,
)

logging.basicConfig(
    format='[%(asctime)s] [E30 Worker] %(levelname)s — %(message)s',
    level=logging.INFO, datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('e30.worker')

DB_DSN = os.environ.get('HETZNER_DB_DSN')
if not DB_DSN:
    sys.exit('[e30-send-worker] HETZNER_DB_DSN env var not set.')

MODE = os.environ.get('E30_WORKER_MODE', 'OBSERVE').upper()  # OBSERVE | FIRE
TICK_SECONDS = float(os.environ.get('E30_TICK_SECONDS', '60'))
BATCH_LIMIT = int(os.environ.get('E30_BATCH_LIMIT', '25'))

CANARY_SQL = ("SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2) "
              "FROM raw.ncboe_donations WHERE cluster_id=372171")


def check_canary(cur) -> bool:
    cur.execute(CANARY_SQL)
    count, total = cur.fetchone()
    ok = count == 147 and str(total) == '332631.30'
    if not ok:
        log.critical(f'CANARY FAIL: {count} / {total} — expected 147 / 332631.30')
    return ok


def claim_events(cur):
    cur.execute(
        """UPDATE brain.event_queue
           SET status='processing', attempts=attempts+1
           WHERE event_id IN (
             SELECT event_id FROM brain.event_queue
             WHERE event_type='email.send' AND status='pending'
               AND (scheduled_for IS NULL OR scheduled_for <= now())
             ORDER BY priority DESC, created_at
             LIMIT %s
             FOR UPDATE SKIP LOCKED)
           RETURNING event_id, event_data""",
        (BATCH_LIMIT,),
    )
    return cur.fetchall()


def finish_event(cur, event_id, status, error=None):
    cur.execute(
        """UPDATE brain.event_queue
           SET status=%s, processed_at=now(), error_message=%s
           WHERE event_id=%s""",
        (status, error, event_id),
    )


def main():
    log.info(f'E30 send worker starting — mode={MODE} tick={TICK_SECONDS}s '
             f'batch={BATCH_LIMIT} provider={os.environ.get("E30_PROVIDER_MODE", "stub")}')
    sender = EnterpriseEmailSender(db_url=DB_DSN)

    while True:
        try:
            conn = psycopg2.connect(DB_DSN)
            conn.autocommit = False
            with conn.cursor() as cur:
                if not check_canary(cur):
                    conn.close()
                    sys.exit(2)
                events = claim_events(cur)
                for event_id, data in events:
                    if isinstance(data, str):
                        data = json.loads(data)
                    try:
                        msg = PersonalizedMessage(
                            donor_cluster_id=int(data['donor_cluster_id']),
                            candidate_id=str(data.get('candidate_id', '')),
                            subject=data.get('subject', ''),
                            body_html=data.get('body_html', ''),
                            body_text=data.get('body_text', ''),
                            is_fundraising=bool(data.get('is_fundraising', False)),
                            campaign_id=data.get('campaign_id'),
                        )
                        if MODE != 'FIRE':
                            gate = (sender._check_match_tier(data.get('match_tier'))
                                    or sender._check_suppression(data['recipient_email'])
                                    or sender._check_consent(data['recipient_email']))
                            log.info(f'OBSERVE {event_id}: would_send='
                                     f'{gate is None} blocked_by={gate}')
                            finish_event(cur, event_id, 'observed')
                            continue
                        outcome = sender.send_personalized_message(
                            msg, recipient_email=data['recipient_email'],
                            match_tier=data.get('match_tier'),
                        )
                        if outcome.delivered:
                            finish_event(cur, event_id, 'completed')
                            log.info(f'SENT {event_id}: send_id={outcome.send_id} '
                                     f'provider_id={outcome.provider_message_id}')
                        else:
                            finish_event(cur, event_id, 'failed', outcome.blocked_by)
                            log.warning(f'BLOCKED {event_id}: {outcome.blocked_by}')
                    except Exception as e:
                        finish_event(cur, event_id, 'failed', str(e)[:500])
                        log.error(f'ERROR {event_id}: {e}')
                if not events:
                    log.info('idle tick — no pending email.send events')
            conn.commit()
            conn.close()
        except Exception as e:
            log.error(f'tick failed: {e}')
        time.sleep(TICK_SECONDS)


if __name__ == '__main__':
    main()
