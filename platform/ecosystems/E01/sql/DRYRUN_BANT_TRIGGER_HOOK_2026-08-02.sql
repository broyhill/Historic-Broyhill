-- DRYRUN_BANT_TRIGGER_HOOK_2026-08-02.sql
-- Extend ifttt.rules so a prospect-stage event CAN call BANT scoring.
-- Does NOT create a parallel trigger catalog.
-- Rule inserted DISABLED — enable only after BANT DDL applied + Ed authorize.
-- Canary: cluster 372171 = 147 / $332,631.30
-- Author: Cursor | 2026-08-02

BEGIN;

-- Requires ifttt.rules to exist (live platform). Additive row only.
-- Column names follow common BGOP ifttt.rules shape; adjust on apply if drifted.

INSERT INTO ifttt.rules (
    rule_id,
    rule_name,
    enabled,
    event_class,
    action_type,
    action_config,
    notes,
    created_at
)
SELECT
    'bant_score_on_prospect_enter',
    'BANT score when prospect enters silo pipeline',
    FALSE,
    'prospect.entered',
    'http_call',
    jsonb_build_object(
        'method', 'POST',
        'url', 'http://127.0.0.1:8491/v1/score',
        'body_template', jsonb_build_object(
            'silo_id', '{{silo_id}}',
            'cluster_id', '{{cluster_id}}',
            'jurisdiction_key', '{{jurisdiction_key}}',
            'persist', false
        ),
        'on_success', 'write_bant_tier_to_context',
        'never', jsonb_build_array('fire_gun', 'action_socket_fire')
    ),
    'BANT v0 hook — DISABLED. Scoring organ only; guns remain ActionSocket-gated.',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ifttt.rules WHERE rule_id = 'bant_score_on_prospect_enter'
);

-- If ifttt.rules column set differs, this INSERT will fail in dry-run — that is
-- acceptable; fix column mapping before authorize. Do not invent a second catalog.

COMMIT;
