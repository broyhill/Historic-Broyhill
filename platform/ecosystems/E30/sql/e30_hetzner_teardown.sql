-- =============================================================================
-- E30 Marketo Clone Teardown Script — Hetzner
-- Removes the partial e30 schema deployment and e71 deployment_queue artifacts
-- that were created by DEPLOY_MARKETO_CLONE.py rogue runs.
--
-- Authority: Ed Broyhill — authorize with "Authorized" before running
-- Run via:
--   ssh root@37.27.169.232 "sudo -u postgres psql -d postgres -f /tmp/e30_teardown.sql"
--
-- SAFE: Canary cluster 372171 is unaffected (read-only forever).
-- CANARY CHECK runs first — script aborts if canary fails.
-- =============================================================================

-- STEP 0 — Canary check
DO $$
DECLARE
  txn_count INT;
  total_amount NUMERIC;
BEGIN
  SELECT COUNT(*), SUM(norm_amount)
  INTO txn_count, total_amount
  FROM raw.ncboe_donations
  WHERE cluster_id = 372171;

  IF txn_count != 147 OR ROUND(total_amount, 2) != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAILED: expected 147/$332,631.30, got %/$%. ABORTING.', txn_count, total_amount;
  END IF;
  RAISE NOTICE 'CANARY PASS: cluster 372171 = % txns / $%', txn_count, total_amount;
END $$;

-- =============================================================================
-- WHAT ROGUE MARKETO DEPLOYMENT CREATED:
--
-- e30 schema:
--   e30.sequences         — 1 row (test sequence)
--   e30.sequence_steps    — 6 rows (test steps)
--   e30.sender_identities — 0 rows
--   e30.templates         — 0 rows
--   e30.sends             — 0 rows
--   e30.events            — 0 rows
--   e30.unsubscribes      — 0 rows
--
-- e71 schema:
--   e71.deployment_queue  — 0 rows (but schema was created)
--
-- VERDICT: e30 schema is a skeleton from a partial DEPLOY_MARKETO_CLONE.py run.
--   It conflicts with BroyhillGOP doctrine — E30 is not a Marketo clone.
--   E30 is a weapon that fires via brain.action_executors → EXEC_E30_EMAIL_SEND.
--   The e30 schema must be dropped and replaced by the canonical E30 executor model.
--
-- e71 deployment_queue is an orphan from a never-completed ecosystem deployment.
--   E71 has no canonical spec and no authorized build. Table stays but queue is empty.
-- =============================================================================

-- STEP 1 — Backup the sequence data before dropping
CREATE TABLE IF NOT EXISTS public._marketo_teardown_backup_sequences AS
  SELECT *, NOW() AS backed_up_at FROM e30.sequences;

CREATE TABLE IF NOT EXISTS public._marketo_teardown_backup_sequence_steps AS
  SELECT *, NOW() AS backed_up_at FROM e30.sequence_steps;

-- STEP 2 — Drop the rogue e30 schema
DROP SCHEMA IF EXISTS e30 CASCADE;

-- Confirm
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'e30') THEN
    RAISE NOTICE 'e30 schema DROPPED successfully';
  ELSE
    RAISE EXCEPTION 'e30 schema still exists after DROP — manual investigation required';
  END IF;
END $$;

-- STEP 3 — Canary re-check after drop
DO $$
DECLARE
  txn_count INT;
  total_amount NUMERIC;
BEGIN
  SELECT COUNT(*), SUM(norm_amount)
  INTO txn_count, total_amount
  FROM raw.ncboe_donations
  WHERE cluster_id = 372171;

  IF txn_count != 147 OR ROUND(total_amount, 2) != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAILED POST-DROP: % / $%', txn_count, total_amount;
  END IF;
  RAISE NOTICE 'CANARY PASS POST-DROP: % txns / $%', txn_count, total_amount;
END $$;

-- STEP 4 — Verify E30 executor registration is intact
SELECT executor_code, weapon, handler_endpoint, enabled, fire_count
FROM brain.action_executors
WHERE executor_code = 'EXEC_E30_EMAIL_SEND';

-- Expected: EXEC_E30_EMAIL_SEND | email | /api/e30/create-from-wizard | t | 0
-- This is the CANONICAL E30 — unaffected by teardown above.

-- STEP 5 — Report
SELECT
  'e30 schema' AS artifact,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name='e30')
    THEN 'STILL EXISTS' ELSE 'DROPPED' END AS status
UNION ALL SELECT
  'backup tables in public',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='_marketo_teardown_backup_sequences')
    THEN 'CREATED' ELSE 'MISSING' END
UNION ALL SELECT
  'e71.deployment_queue',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='e71' AND table_name='deployment_queue')
    THEN 'EXISTS (empty - retained)' ELSE 'MISSING' END
UNION ALL SELECT
  'EXEC_E30_EMAIL_SEND executor',
  CASE WHEN EXISTS (SELECT 1 FROM brain.action_executors WHERE executor_code='EXEC_E30_EMAIL_SEND')
    THEN 'INTACT' ELSE 'MISSING - PROBLEM' END;

-- =============================================================================
-- END OF TEARDOWN
-- Summary:
--   DROPPED: e30 schema (7 tables, 7 total rows)
--   RETAINED: backup tables in public._marketo_teardown_backup_*
--   RETAINED: e71.deployment_queue (empty, different purpose)
--   INTACT: brain.action_executors EXEC_E30_EMAIL_SEND (canonical E30)
--   CANARY: PASS before and after
-- =============================================================================
