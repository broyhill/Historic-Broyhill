-- =============================================================================
-- DRYRUN_E26_NURTURE_ROUTING_RULES_2026-06-20.sql
-- E26 waterfall routing rules as ifttt.rules extension (NOT nurture_routing_matrix)
-- =============================================================================
-- DRY-RUN ONLY. Codex applies after Ed `I AUTHORIZE THIS ACTION`.
-- Companion: docs/handoffs/E26_NURTURE_ROUTING_MATRIX_SPEC_2026-06-20.md
-- Prerequisite: DRYRUN_NC_FIRST_PIPELINE_BUILD_SPEC (BPF enum + engagement_score)
-- Prerequisite: DRYRUN_MULTICHANNEL_FATIGUE_CAPS (check_fatigue_gate)
-- Sacred canary before AND after apply.
-- =============================================================================
BEGIN;

-- ── PRE-FLIGHT CANARY ──
DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL: % / % — ABORT', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS: % / $%', v_txns, v_total;
END $$;

-- ── Optional: waterfall step cursor on prospect_pipeline ──
-- (May already be in DRYRUN_NC_FIRST_PIPELINE_BUILD_SPEC — idempotent ADD)
ALTER TABLE brain.prospect_pipeline
    ADD COLUMN IF NOT EXISTS waterfall_step_index SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS campaign_id UUID;

COMMENT ON COLUMN brain.prospect_pipeline.waterfall_step_index IS
    'E26 waterfall cursor into wizard.campaigns.channel_waterfall_json steps[].';

CREATE INDEX IF NOT EXISTS idx_pp_campaign_waterfall
    ON brain.prospect_pipeline (campaign_id, waterfall_step_index)
    WHERE campaign_id IS NOT NULL;

-- ── E26 routing rules (extend ifttt.rules — no parallel catalog) ──
INSERT INTO ifttt.rules (
    rule_code, rule_name, rule_category,
    trigger_type, trigger_config, directives, active
) VALUES
(
    'E26-R-001-ENGAGEMENT-ADVANCE',
    'E26: LP engagement signal → advance waterfall + propose next gun',
    'pipeline',
    'event_class',
    '{"event_class":"pr_engagement_signal","min_engagement_score":15}'::jsonb,
    '[{
        "action":"advance_waterfall",
        "stage_map":{"Captured":"Warmed","Warmed":"Engaged"},
        "emit_event":"pr_engagement_signal",
        "socket_mode":"OBSERVE",
        "change_source":"brain"
    }]'::jsonb,
    false  -- enable after OBSERVE proof
),
(
    'E26-R-002-GIFT-MID-SEQUENCE',
    'E26: donation.received mid-waterfall → skip ask steps → Converted',
    'pipeline',
    'event_class',
    '{"event_class":"donation.received"}'::jsonb,
    '[{
        "action":"set_stage",
        "stage":"Converted",
        "trigger_ref":"T-PR-003",
        "reset_waterfall":true,
        "change_source":"brain"
    }]'::jsonb,
    false
),
(
    'E26-R-003-SMS-OPT-OUT',
    'E26: sms_opt_out (T-C-902) → suppress waterfall + global opt-out',
    'compliance',
    'event_class',
    '{"event_class":"sms_opt_out","payload_trigger":"T-C-902"}'::jsonb,
    '[{
        "action":"suppress",
        "loss_reason":"opt_out",
        "waterfall_step":"suppress",
        "nbd_suppressed":true
    }]'::jsonb,
    true   -- compliance block — safe inactive until worker wired
),
(
    'E26-R-004-FATIGUE-WEEKLY',
    'E26: weekly fatigue cap → defer waterfall 7d',
    'compliance',
    'fatigue_gate',
    '{"check":"brain.check_fatigue_gate","allowed":false,"reason":"fatigue_cap_weekly"}'::jsonb,
    '[{
        "action":"defer",
        "loss_reason":"fatigue_cap",
        "retry_days":7,
        "socket_mode":"OBSERVE"
    }]'::jsonb,
    false
),
(
    'E26-R-005-HIGH-ENGAGE-CULTIVATED',
    'E26: Engaged + score≥70 → Cultivated; queue E75 if GO≥85',
    'pipeline',
    'sql_predicate',
    '{"query":"SELECT 1 FROM brain.prospect_pipeline WHERE stage=''Engaged'' AND engagement_score >= 70"}'::jsonb,
    '[{
        "action":"set_stage",
        "stage":"Cultivated",
        "propose_executor":"EXEC_E75_CANDIDATE_CALL",
        "go_threshold":85,
        "socket_mode":"OBSERVE"
    }]'::jsonb,
    false
),
(
    'E26-R-006-INTENSITY-SMS-LANE',
    'E26: intensity≥40 + TCPA consent → propose E31 after email step',
    'pipeline',
    'event_class',
    '{"event_class":"pr_engagement_signal","min_intensity":0.40,"requires_tcpa":true}'::jsonb,
    '[{
        "action":"propose_executor",
        "executor_code":"EXEC_E31_SMS_SEND",
        "waterfall_channel":"sms",
        "socket_mode":"OBSERVE"
    }]'::jsonb,
    false
)
ON CONFLICT (rule_code) DO UPDATE SET
    rule_name      = EXCLUDED.rule_name,
    trigger_config = EXCLUDED.trigger_config,
    directives     = EXCLUDED.directives;

COMMENT ON TABLE ifttt.rules IS
    'E26 waterfall rules use prefix E26-R-*. Do NOT create brain.nurture_routing_matrix.';

-- ── Reference: fatigue dry-run (apply separately) ──
-- See: database/migrations/dryrun/DRYRUN_MULTICHANNEL_FATIGUE_CAPS_2026-06-20.sql
-- brain.channel_fatigue_ledger + brain.check_fatigue_gate()

-- ── POST-FLIGHT CANARY ──
DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL after DDL: % / % — ROLLBACK', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Post-apply canary PASS: % / $%', v_txns, v_total;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICATION SELECTS (read-only — run after apply on Hetzner)
-- =============================================================================
-- SELECT rule_code, rule_name, active FROM ifttt.rules WHERE rule_code LIKE 'E26-R-%';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='brain' AND table_name='prospect_pipeline'
--     AND column_name IN ('waterfall_step_index','campaign_id','stage','engagement_score');
-- SELECT to_regclass('brain.nurture_routing_matrix');  -- Expect NULL
-- SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id = 372171;
--   -- PASS: 147 / 332631.30

-- ROLLBACK (manual):
-- DELETE FROM ifttt.rules WHERE rule_code LIKE 'E26-R-%';
-- ALTER TABLE brain.prospect_pipeline DROP COLUMN IF EXISTS waterfall_step_index;
-- ALTER TABLE brain.prospect_pipeline DROP COLUMN IF EXISTS campaign_id;
