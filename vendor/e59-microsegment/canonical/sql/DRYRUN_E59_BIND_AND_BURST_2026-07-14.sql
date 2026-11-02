-- DRYRUN_E59_BIND_AND_BURST_2026-07-14.sql
-- Source: AGENT_BOOT/Cursor ToDo/CURSOR_DISPATCH_E59_BIND_AND_BURST_2026-07-10.md (verbatim steps 1-7)
-- trigger_id resolved live: T-S-910 (email action class, brain.triggers)
-- Dry-run: ROLLBACK at end. Live run replaces ROLLBACK with COMMIT.

BEGIN;

-- Canary pre
DO $$ DECLARE v_txns INT; v_total NUMERIC;
BEGIN
  SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2) INTO v_txns, v_total
  FROM raw.ncboe_donations WHERE cluster_id = 372171;
  IF v_txns != 147 OR v_total != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL PRE: %/%', v_txns, v_total;
  END IF;
END $$;

-- STEP 1 — Promote Boliek to active
UPDATE core.candidates SET
  status        = 'active',
  office_title  = 'NC State Auditor',
  office_level  = 'state',
  office_type   = 'statewide',
  office_state  = 'NC',
  updated_at    = NOW()
WHERE candidate_id = '05ef6975-cba1-5710-8f54-3664dd894a68';

-- STEP 2 — Bind segment assignments
UPDATE e59.donor_segment_assignment
SET candidate_id = '05ef6975-cba1-5710-8f54-3664dd894a68'
WHERE candidate_id IS NULL;

-- STEP 3 — First campaign
INSERT INTO wizard.campaigns (
  id, candidate_id, campaign_name, campaign_code,
  status, step_completed, campaign_type,
  weapons, microsegment_ids, microsegment_cats,
  universe_size, grade_filter, county_filter,
  issue_tag, issue_display, rendering_mode,
  per_grade_asks, created_at, updated_at
) VALUES (
  'b0011e00-0000-0000-0000-000000000001'::uuid,
  '05ef6975-cba1-5710-8f54-3664dd894a68',
  'Dave Boliek — Pro-Life Ring 1 Burst',
  'BOLIEK-PROLIFE-R1-001',
  'active', 3, 'issue_burst',
  '["email_burst"]'::jsonb,
  '["pro_life_single_issue"]'::jsonb,
  '[1]'::jsonb,
  4887, 'A,B,C', '{}'::jsonb,
  'pro_life', 'Pro-Life / Right to Life', 'personalized',
  '{"A":250,"B":100,"C":50}'::jsonb,
  NOW(), NOW()
);

-- STEP 4 — Issue activation log
INSERT INTO e59.issue_activation_log (
  candidate_id, issue_domain, issue_label,
  forecast_state, mandate_score, mandate_tier,
  trail_selected, gear_launched, ring_scope,
  donor_count_targeted, activated_at
) VALUES (
  '05ef6975-cba1-5710-8f54-3664dd894a68',
  'pro_life', 'Pro-Life / Right to Life',
  'active', 91, 'tier1_strong',
  'AI_ASSIST', 1, 'RING_1_ONLY',
  4887, NOW()
);

-- STEP 5 — Campaign performance record
INSERT INTO wizard.campaign_performance (
  candidate_id, campaign_id, weapon, issue_tag, microsegment_cat,
  rendering_mode, donor_grade_filter, records_sent,
  ring_scope, burst_date, office_class,
  predicted_affinity, forecast_state, forecast_confidence,
  forecast_sample_n, heat_score_at_launch, calibration_routed, created_at
) VALUES (
  '05ef6975-cba1-5710-8f54-3664dd894a68',
  'b0011e00-0000-0000-0000-000000000001'::uuid,
  'email_burst', 'pro_life', 1, 'personalized', 'A,B,C',
  4887, 'RING_1_ONLY', CURRENT_DATE, 'statewide',
  91, 'active', 'high', 500, 91, false, NOW()
);

-- STEP 6 — Queue weapons
INSERT INTO brain.weapon_queue (
  weapon_id, trigger_id, donor_id, candidate_id,
  action_type, payload, status,
  queued_at, attempts, max_attempts, test_mode
)
SELECT
  gen_random_uuid(),
  'T-S-910',
  dsa.cluster_id,
  1,
  'email_burst',
  jsonb_build_object(
    'microsegment', dsa.microsegment_key,
    'score', dsa.segment_match_score,
    'confidence', dsa.assignment_confidence,
    'campaign_id', 'b0011e00-0000-0000-0000-000000000001',
    'issue_tag', 'pro_life',
    'ring_scope', 'RING_1_ONLY'
  ),
  'queued', NOW(), 0, 3, false
FROM e59.donor_segment_assignment dsa
WHERE dsa.microsegment_key = 'pro_life_single_issue'
  AND dsa.candidate_id = '05ef6975-cba1-5710-8f54-3664dd894a68'
  AND dsa.do_not_contact = false;

-- STEP 7 — Verify
SELECT 'boliek_status',   status FROM core.candidates WHERE candidate_id='05ef6975-cba1-5710-8f54-3664dd894a68'
UNION ALL SELECT 'bound_donors', COUNT(DISTINCT cluster_id)::text FROM e59.donor_segment_assignment WHERE candidate_id IS NOT NULL
UNION ALL SELECT 'bound_segments', COUNT(DISTINCT microsegment_key)::text FROM e59.donor_segment_assignment WHERE candidate_id IS NOT NULL
UNION ALL SELECT 'campaign', campaign_name FROM wizard.campaigns WHERE id='b0011e00-0000-0000-0000-000000000001'::uuid
UNION ALL SELECT 'activation_log', COUNT(*)::text FROM e59.issue_activation_log
UNION ALL SELECT 'campaign_performance', COUNT(*)::text FROM wizard.campaign_performance
UNION ALL SELECT 'weapons_queued', COUNT(*)::text FROM brain.weapon_queue WHERE action_type='email_burst' AND status='queued';

-- Canary post
DO $$ DECLARE v_txns INT; v_total NUMERIC;
BEGIN
  SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2) INTO v_txns, v_total
  FROM raw.ncboe_donations WHERE cluster_id = 372171;
  IF v_txns != 147 OR v_total != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL POST: %/%', v_txns, v_total;
  END IF;
  RAISE NOTICE 'CANARY PASS POST — E59 bind+burst complete';
END $$;

ROLLBACK;
