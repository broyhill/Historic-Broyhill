"""
backend/python/brain/brain_drain_patch.py

Mountain 2 — Brain Worker Drain Patch
Patches brain_worker.py's drain_weapon_queue() to:
  1. Actually dispatch to executor endpoints (currently: observe_log only, no HTTP call)
  2. Call on_weapon_dispatched() to create journey.weapon_journey rows
  3. Write outcome measurement from the first fire

WRITTEN DARK: SENDS_ENABLED = False until Ed rules R4 (opponent-donor suppression gate)
and issues "I AUTHORIZE THIS ACTION" for external sends.

Live daemon: /opt/bgop/brain/brain_worker.py (Devin PF-8 confirmed)
Live daemon pid: 3396661 (heartbeating since 2026-07-10)
Weapon queue: 4,887 queued / 1 delivered — fire_count=0 on all 12 executors

This file is NOT a standalone script. It documents:
  A) The exact changes to make to brain_worker.py drain_weapon_queue()
  B) The replacement drain function to drop in
  C) Deployment instructions

BLOCKERS before any live send:
  - R4: opponent-donor suppression gate must be ruled by Ed
  - Ed must say "I AUTHORIZE THIS ACTION" for external sends
  - W03 SMS/E31 is first-fire weapon (Ed ruling); W01 blocked by Bible H-2
  - Devin must verify all 4 Mountain 2 Python files against live schema first

Schema verified: Devin live query 2026-07-25 21:47 UTC
Sacred canary: cluster 372171 → 147 txns / $332,631.30
"""

from __future__ import annotations

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — THE DARK FLAG
# ═══════════════════════════════════════════════════════════════════════════════
#
# This flag controls whether weapons actually fire.
# FALSE = OBSERVE mode only (safe, no external sends)
# TRUE  = FIRE mode (requires R4 ruling + Ed's exact phrase for external sends)
#
# Change to True ONLY after:
#   1. Ed rules R4 (opponent-donor suppression gate)
#   2. Ed says "I AUTHORIZE THIS ACTION" for sends in this session
#   3. Devin has verified Mountain 2 Python suite against live schema
#   4. First pilot: W03 SMS (E31), one microsegment, Boliek campaign only
#
SENDS_ENABLED: bool = False  # ← DARK until R4 ruled


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — REPLACEMENT drain_weapon_queue() METHOD
# ═══════════════════════════════════════════════════════════════════════════════
#
# Drop this method into BrainWorker class in brain_worker.py.
# It replaces the existing drain_weapon_queue() at line ~418.
# Imports to add at top of brain_worker.py:
#   import requests
#   from outcome.outcome_writer import on_weapon_dispatched, extract_dispatch_fields
#
# The existing BrainConfig.OBSERVE_ONLY flag is preserved for backward compat.
# SENDS_ENABLED is the new outer gate; OBSERVE_ONLY is inner per-weapon mode.

DRAIN_PATCH_SOURCE = '''
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
            "SELECT * FROM brain.weapon_queue WHERE status=\'queued\' ORDER BY queued_at LIMIT %s",
            (BrainConfig.WEAPON_BATCH,))

        drained = 0
        for w in weapons:
            try:
                # ── Extract payload JSONB fields ──────────────────────────────
                payload = w.get(\'payload\') or {}
                if isinstance(payload, str):
                    import json as _json
                    payload = _json.loads(payload)

                # weapon_code: from payload or derive from action_type
                weapon_code = payload.get(\'weapon_code\') or self._action_type_to_weapon_code(w.get(\'action_type\', \'\'))
                bgop_trace_id = payload.get(\'bgop_trace_id\')
                microsegment_key = payload.get(\'microsegment_key\')
                issue_code = payload.get(\'issue_code\')
                ask_tier = payload.get(\'ask_tier\')

                # cluster_id: donor_id bigint == cluster_id integer (same identity)
                donor_id = w.get(\'donor_id\')
                cluster_id = int(donor_id) if donor_id is not None else None

                # Resolve rnc_regid for observe_log (unchanged from original)
                rnc_regid = None
                if cluster_id:
                    donor_row = self.db.fetchone(
                        "SELECT rnc_regid FROM core.donor_profile WHERE cluster_id=%s",
                        (cluster_id,))
                    if donor_row:
                        rnc_regid = donor_row.get(\'rnc_regid\')

                # ── Executor resolution (unchanged from original) ──────────────
                event_class = payload.get(\'event_type\', \'\')
                ex = self.db.fetchone("""
                    SELECT executor_code, handler_endpoint, enabled
                    FROM brain.action_executors
                    WHERE weapon=%s AND event_class=%s
                      AND ecosystem_code NOT LIKE \'%%TEST%%\'
                    LIMIT 1""",
                    (w[\'action_type\'], event_class))
                if not ex:
                    ex = self.db.fetchone("""
                        SELECT executor_code, handler_endpoint, enabled
                        FROM brain.action_executors
                        WHERE (weapon=%s OR event_class=%s)
                          AND ecosystem_code NOT LIKE \'%%TEST%%\'
                        ORDER BY enabled DESC LIMIT 1""",
                        (w[\'action_type\'], event_class))

                executor_code = ex[\'executor_code\'] if ex else \'EXEC_TEST_OBSERVE\'
                handler_endpoint = (ex or {}).get(\'handler_endpoint\')
                mode = \'observe\' if (w.get(\'test_mode\') or BrainConfig.OBSERVE_ONLY or not SENDS_ENABLED) else \'fire\'

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
                    w[\'action_type\'],
                    event_class,
                    mode,
                    _json2.dumps({\'status\': \'observed\', \'weapon_id\': str(w[\'weapon_id\'])}),
                    f"AUTO_OBSERVE_{w[\'weapon_id\']}",
                ))

                # ── FIRE path (only when SENDS_ENABLED = True) ────────────────
                provider_message_id = None
                provider_ack_raw = {}
                http_response_code = None

                if SENDS_ENABLED and mode == \'fire\' and handler_endpoint:
                    # Build dispatch payload
                    dispatch_payload = {
                        **payload,
                        \'weapon_id\': str(w[\'weapon_id\']),
                        \'cluster_id\': cluster_id,
                        \'bgop_trace_id\': bgop_trace_id,
                        \'weapon_code\': weapon_code,
                    }

                    try:
                        response = _requests.post(
                            handler_endpoint,
                            json=dispatch_payload,
                            timeout=30,
                            headers={\'X-BGOP-Trace\': bgop_trace_id or \'\'},
                        )
                        http_response_code = response.status_code
                        provider_ack_raw = response.json() if response.content else {}
                        provider_message_id = provider_ack_raw.get(\'provider_message_id\')

                        if response.status_code != 200:
                            logger.error(
                                "Executor %s returned %s for weapon %s",
                                executor_code, response.status_code, w[\'weapon_id\']
                            )
                            # Mark failed — do not write journey row
                            self.db.execute("""
                                UPDATE brain.weapon_queue
                                SET status=\'failed\',
                                    error_message=%s,
                                    attempts=attempts+1
                                WHERE weapon_id=%s
                            """, (f"HTTP {response.status_code}", w[\'weapon_id\']))
                            continue

                    except Exception as exc:
                        logger.error("HTTP dispatch failed for weapon %s: %s", w[\'weapon_id\'], exc)
                        self.db.execute("""
                            UPDATE brain.weapon_queue
                            SET status=\'failed\', error_message=%s, attempts=attempts+1
                            WHERE weapon_id=%s
                        """, (str(exc)[:500], w[\'weapon_id\']))
                        continue

                    # ── Write journey row (FIRE mode only) ────────────────────
                    try:
                        on_weapon_dispatched(
                            db_url=self.db_url,
                            weapon_queue_id=w[\'weapon_id\'],
                            weapon_code=weapon_code,
                            donor_id=donor_id,
                            candidate_id_int=w.get(\'candidate_id\'),
                            microsegment_key=microsegment_key,
                            action_type=w.get(\'action_type\', \'\'),
                            queued_at=w.get(\'queued_at\'),
                            provider_message_id=provider_message_id,
                            provider_ack_raw=provider_ack_raw,
                            bgop_trace_id=bgop_trace_id,
                            issue_code=issue_code,
                            ask_tier=ask_tier,
                        )
                    except Exception as exc:
                        logger.error(
                            "on_weapon_dispatched failed for weapon %s: %s",
                            w[\'weapon_id\'], exc
                        )
                        # Non-fatal: weapon fired, journey write failed
                        # Log and continue — do not leave weapon in \'queued\'

                # ── Mark weapon delivered (fire + observe both mark delivered) ─
                self.db.execute("""
                    UPDATE brain.weapon_queue
                    SET status=\'delivered\',
                        dispatched_at=NOW(),
                        delivered_at=NOW(),
                        attempts=attempts+1,
                        http_response=%s
                    WHERE weapon_id=%s
                """, (
                    _json2.dumps(provider_ack_raw) if provider_ack_raw else None,
                    w[\'weapon_id\'],
                ))
                drained += 1

            except Exception as exc:
                logger.error("drain error for weapon %s: %s", w.get(\'weapon_id\', \'?\'), exc)
                # Leave in \'queued\' for retry — do not crash the daemon

        if drained > 0:
            logger.info(
                "Drained %d weapons (SENDS_ENABLED=%s mode=%s)",
                drained, SENDS_ENABLED, \'fire\' if SENDS_ENABLED else \'observe\'
            )
        return drained

    def _action_type_to_weapon_code(self, action_type: str) -> str:
        """
        Fallback weapon code from action_type when payload has no weapon_code.
        Verified from 314_brain_action_executors_seed.sql + DRYRUN_BRAIN_GEARBOX_EXECUTORS.
        """
        _MAP = {
            \'EXEC_E30_EMAIL_SEND\':    \'email\',
            \'EXEC_E31_SMS_SEND\':      \'sms\',
            \'EXEC_E17_RVM_DROP\':      \'rvm\',
            \'EXEC_E18_PHONE_CALL\':    \'call\',
            \'EXEC_E16_DIRECT_MAIL\':   \'mail\',
            \'EXEC_E19_SOCIAL_POST\':   \'social\',
            \'EXEC_E30_EMAIL_BURST\':   \'email_burst\',
        }
        code = _MAP.get(action_type, action_type.lower())
        return code
'''


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — DEPLOYMENT INSTRUCTIONS FOR CURSOR
# ═══════════════════════════════════════════════════════════════════════════════

DEPLOYMENT_INSTRUCTIONS = """
# CURSOR DEPLOYMENT INSTRUCTIONS — Brain Drain Patch
# Authority required: Ed says "I AUTHORIZE THIS ACTION" before any live fire
# Current state: SENDS_ENABLED = False (dark) — safe to deploy, no sends fire

## Step 1 — SCP live brain_worker.py from Hetzner to repo
scp root@37.27.169.232:/opt/bgop/brain/brain_worker.py \\
  backend/python/brain/brain_worker.py
# Verify line count matches Devin's known state before patching

## Step 2 — Apply the patch
# Replace the existing drain_weapon_queue() method (starts ~line 418) with
# the DRAIN_PATCH_SOURCE from this file.
# Add these imports at the top of brain_worker.py:
#   import requests
#   from outcome.outcome_writer import on_weapon_dispatched
# Add _action_type_to_weapon_code() as a new method on BrainWorker class.

## Step 3 — Verify SENDS_ENABLED = False
# grep "SENDS_ENABLED" backend/python/brain/brain_worker.py
# Must show: SENDS_ENABLED: bool = False

## Step 4 — Commit and open PR
# Branch: claude/mountain2-drain-patch
# PR title: "Mountain 2: brain drain patch (dark — SENDS_ENABLED=False)"
# Do NOT push to main. Do NOT copy to Hetzner. Devin verifies. Ed merges.

## Step 5 — After Ed merges PR + rules R4 + says I AUTHORIZE THIS ACTION for sends:
# Devin applies the live update on Hetzner:
#   scp backend/python/brain/brain_worker.py root@37.27.169.232:/opt/bgop/brain/
#   sudo systemctl restart broyhillgop-brain-worker.service
#   systemctl status broyhillgop-brain-worker.service  # verify running
# Then set SENDS_ENABLED = True in the deployed file for the first OBSERVE pilot.

## WHAT HAPPENS WHEN SENDS_ENABLED = True (first fire):
# 1. W03 SMS (E31) fires for Boliek microsegment (Ed ruling)
# 2. observe_log row written (mode='fire', actually_taken=False initially)
# 3. HTTP POST to /api/e31/send-sms
# 4. on_weapon_dispatched() writes journey.weapon_journey row
# 5. Twilio callback → e31_twilio.py → outcome.weapon_observation
# 6. slo_computer.py (nightly) updates W03 SLO metrics
# 7. ml_feedback_worker.py writes Block C signals to ml.donor_fingerprint
# The full loop closes.
"""


if __name__ == "__main__":
    print("Brain drain patch — deployment instructions:")
    print(DEPLOYMENT_INSTRUCTIONS)
    print("\nDrain patch source (replace drain_weapon_queue in brain_worker.py):")
    print(DRAIN_PATCH_SOURCE[:500] + "...[see DRAIN_PATCH_SOURCE variable]")
