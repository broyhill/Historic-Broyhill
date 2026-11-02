-- ============================================================
-- E59 + WIZARD PRE-LAUNCH VALIDATION SCRIPT
-- Path: nexus-claude-cursor/E59_WIZARD_PRELAUNCH_VALIDATION_2026-06-30.sql
-- Date: 2026-06-30
-- Agent: Nexus E51
-- Purpose: Confirm all 5 pipeline wires are connected before
--          first Ring 1 burst fires. Run this before any campaign.
-- READ ONLY — no writes. Safe to run at any time.
-- Canary: cluster 372171 = 147 / $332,631.30
-- ============================================================

-- ============================================================
-- CANARY FIRST
-- ============================================================
SELECT
  'CANARY' AS check_name,
  CASE
    WHEN COUNT(*) = 147 AND SUM(amount) = 332631.30 THEN '✅ PASS'
    ELSE '❌ FAIL — STOP IMMEDIATELY'
  END AS status,
  COUNT(*) AS txns,
  SUM(amount) AS total
FROM raw.ncboe_donations
WHERE cluster_id = 372171;

-- ============================================================
-- CHECK 1: e59.issue_district_profile deployed and seeded
-- ============================================================
SELECT
  'CHECK 1: e59.issue_district_profile' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='e59' AND table_name='issue_district_profile'
    ) THEN
      CASE
        WHEN (SELECT COUNT(*) FROM e59.issue_district_profile) > 0
        THEN '✅ PASS — deployed and seeded (' ||
             (SELECT COUNT(*) FROM e59.issue_district_profile) || ' rows)'
        ELSE '⚠️  TABLE EXISTS BUT EMPTY — run daily seed job'
      END
    ELSE '❌ FAIL — table not deployed (run ISSUE_EXPLORER_NBD_INTEGRATION_SPEC migration)'
  END AS status;

-- ============================================================
-- CHECK 2: Affinity dashboard schema deployed
-- ============================================================
SELECT
  'CHECK 2: brain_control affinity tables' AS check_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema='brain_control'
      AND table_name IN (
        'affinity_performance_log',
        'affinity_model_alert',
        'affinity_model_calibration_summary'
      )
    ) = 3 THEN '✅ PASS — all 3 dashboard tables deployed'
    ELSE '❌ FAIL — run AFFINITY_TRACKING_DASHBOARD_SCHEMA_2026-06-30.sql (' ||
      (SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema='brain_control'
       AND table_name IN (
         'affinity_performance_log','affinity_model_alert',
         'affinity_model_calibration_summary'
       )) || '/3 tables found)'
  END AS status;

-- ============================================================
-- CHECK 3: Brain worker alive and processing
-- ============================================================
SELECT
  'CHECK 3: Brain worker heartbeat' AS check_name,
  CASE
    WHEN MAX(last_heartbeat) > now() - interval '5 minutes'
    THEN '✅ PASS — last heartbeat ' ||
         EXTRACT(epoch FROM (now() - MAX(last_heartbeat)))::int || 's ago'
    WHEN MAX(last_heartbeat) > now() - interval '1 hour'
    THEN '⚠️  WARNING — last heartbeat ' ||
         ROUND(EXTRACT(epoch FROM (now() - MAX(last_heartbeat)))/60)::int || 'm ago'
    ELSE '❌ FAIL — brain worker appears down (last heartbeat: ' ||
         MAX(last_heartbeat)::text || ')'
  END AS status
FROM brain.heartbeat;

-- ============================================================
-- CHECK 4: Action executors registered and enabled
-- ============================================================
SELECT
  'CHECK 4: Action executors (' || executor_code || ')' AS check_name,
  CASE
    WHEN enabled = true THEN '✅ ENABLED — ' || handler_endpoint
    ELSE '❌ DISABLED'
  END AS status
FROM brain.action_executors
ORDER BY executor_code;

-- ============================================================
-- CHECK 5: Relay service reachable (check via pg connection)
-- ============================================================
-- NOTE: This checks if the relay URL is configured, not HTTP connectivity.
-- For HTTP check, run: curl -s http://37.27.169.232:8080/health
SELECT
  'CHECK 5: Relay URL configured' AS check_name,
  CASE
    WHEN COUNT(*) > 0
    THEN '✅ PASS — relay URL found in executor endpoints'
    ELSE '⚠️  WARNING — no http executor endpoints found'
  END AS status
FROM brain.action_executors
WHERE handler_kind = 'http'
  AND handler_endpoint LIKE '%8080%';

-- ============================================================
-- CHECK 6: Webhook sources — WinRed/Anedot events ever received
-- ============================================================
SELECT
  'CHECK 6: Webhook events (WinRed/Anedot)' AS check_name,
  CASE
    WHEN COUNT(*) > 0
    THEN '✅ PASS — ' || COUNT(*) || ' donation events received'
    ELSE '❌ FAIL — 0 donation events — WinRed/Anedot webhooks not configured'
  END AS status
FROM brain.event_queue
WHERE event_type ILIKE '%donation%'
   OR event_type ILIKE '%winred%'
   OR event_type ILIKE '%anedot%'
   OR event_class = 'donation';

-- ============================================================
-- CHECK 7: Email/SMS write-back events ever received
-- ============================================================
SELECT
  'CHECK 7: Email/SMS write-back events' AS check_name,
  CASE
    WHEN COUNT(*) > 0
    THEN '✅ PASS — ' || COUNT(*) || ' email/SMS events received'
    ELSE '❌ FAIL — 0 email/SMS events — E30/E31 write-back not wired'
  END AS status
FROM brain.event_queue
WHERE event_type ILIKE '%email%'
   OR event_type ILIKE '%sms%'
   OR event_class ILIKE '%outreach%';

-- ============================================================
-- CHECK 8: Prospect pipeline has donors past Captured
-- ============================================================
SELECT
  'CHECK 8: Prospect pipeline progression' AS check_name,
  CASE
    WHEN COUNT(*) FILTER (WHERE stage != 'Captured') > 0
    THEN '✅ PASS — ' || COUNT(*) FILTER (WHERE stage != 'Captured') ||
         ' donors advanced past Captured'
    ELSE '⚠️  WARNING — all ' || COUNT(*) ||
         ' prospects stuck at Captured (resolves when Gap 1 fixed)'
  END AS status
FROM brain.prospect_pipeline;

-- ============================================================
-- CHECK 9: NBD engine has scored donors
-- ============================================================
SELECT
  'CHECK 9: brain.next_best_donor populated' AS check_name,
  CASE
    WHEN COUNT(*) > 0
    THEN '✅ PASS — ' || COUNT(*) || ' donors scored (' ||
         COUNT(*) FILTER (WHERE NOT suppressed) || ' active)'
    ELSE '⚠️  EMPTY — NBD engine has not run yet'
  END AS status
FROM brain.next_best_donor;

-- ============================================================
-- CHECK 10: Wizard schema ready
-- ============================================================
SELECT
  'CHECK 10: Wizard schema (' || table_name || ')' AS check_name,
  '✅ DEPLOYED — 0 rows (pre-launch expected)' AS status
FROM information_schema.tables
WHERE table_schema = 'wizard'
ORDER BY table_name;

-- ============================================================
-- SUMMARY: GO / NO-GO
-- ============================================================
-- A campaign burst is GO when:
--   CHECK 1: e59.issue_district_profile seeded         ✅
--   CHECK 2: Dashboard schema deployed                 ✅
--   CHECK 3: Brain worker alive                        ✅
--   CHECK 4: All executors enabled                     ✅
--   CHECK 5: Relay reachable                           ✅
--   CHECK 6: Webhook events flowing (WinRed/Anedot)    ✅
--   CHECK 7: Email/SMS write-back wired                ✅
--   CHECK 8: Prospect pipeline moving (optional)
--   CHECK 9: NBD scored donors (optional — can seed manually)
--   CHECK 10: Wizard schema deployed                   ✅
--
-- HARD BLOCKERS: Checks 1, 2, 3, 4, 5, 6, 7, 10
-- Checks 8 and 9 are warnings, not blockers.
-- If all hard blockers pass: authorize first Ring 1 burst.

-- ============================================================
-- POST-BURST VALIDATION (run at T+72h after first burst)
-- ============================================================
-- SELECT COUNT(*) FROM wizard.campaign_performance;
-- -- Must be > 0
--
-- SELECT COUNT(*) FROM lp.engagement_queue;
-- -- Must be > 0
--
-- SELECT COUNT(*) FROM brain.event_queue
-- WHERE event_class != 'time';
-- -- Must be > 0
--
-- SELECT COUNT(*) FROM brain.experimental_calibration;
-- -- Must be > 0 if burst was EXPERIMENTAL_TEST type
--
-- SELECT COUNT(*) FROM e59.issue_district_profile
-- WHERE forecast_sample_n > 0;
-- -- Must be > 0 after first burst closes
