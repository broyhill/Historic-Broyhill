-- DEPLOYED 2026-08-19
-- deploy_id: 305
-- canary_before: 147 / 332631.30
-- canary_after: 147 / 332631.30
-- rows_written: 0 (log-only; objects already live)
-- applied_at: 2026-08-19T00:49:24Z
-- collision: unlogged census; skip re-apply
--
-- ============================================================================
-- DRYRUN: ifttt.rules Marketo-mechanics upgrade + agent proposal surface
-- Date: 2026-07-08 | Agent: Devin
-- Canon: docs/canonical/MARKETO_TRIGGER_LIBRARY_BGOP_MAPPING_2026-07-07.md §3
--        (Recs #1 constraint/filter split, #2 qualification rules,
--         #4 campaign.request composability, #5 attention.moment)
--        + MONDAY_TRIGGER_LIBRARY_ADDENDUM_2026-07-07.md (agent propose/read API)
--
-- EXECUTION GATE: requires Ed's exact phrase "I AUTHORIZE THIS ACTION".
-- STATUS: EXECUTED on Hetzner 2026-07-08 04:05 UTC (authorized by Ed).
--   Canary before/after: 147 | 332631.30 PASS.
--   As-executed fix: brain.triggers.name is NOT NULL — added name column to INSERT.
-- Canary check (before AND after):
--   SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2)
--   FROM raw.ncboe_donations WHERE cluster_id=372171;  -- expect 147 | 332631.30
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Constraint-on-event vs predicate-on-person split (Marketo Rec #1)
--    event_constraints narrows the EVENT (which link, which form, min delta);
--    person_predicate_sql qualifies the PERSON at evaluation time.
--    Existing trigger_config stays as-is; these are additive, nullable.
-- ---------------------------------------------------------------------------
ALTER TABLE ifttt.rules
  ADD COLUMN IF NOT EXISTS event_constraints    jsonb,
  ADD COLUMN IF NOT EXISTS person_predicate_sql text;

-- ---------------------------------------------------------------------------
-- 2. Qualification / reentry policy (Marketo Rec #2)
--    once (default, per-person lifetime) | every_time | per_interval
--    cooldown_seconds remains the coarse fallback; this is the declared policy.
-- ---------------------------------------------------------------------------
ALTER TABLE ifttt.rules
  ADD COLUMN IF NOT EXISTS qualification_policy   text NOT NULL DEFAULT 'every_time',
  ADD COLUMN IF NOT EXISTS qualification_interval interval;

ALTER TABLE ifttt.rules
  DROP CONSTRAINT IF EXISTS rules_qualification_policy_check;
ALTER TABLE ifttt.rules
  ADD CONSTRAINT rules_qualification_policy_check
  CHECK (qualification_policy IN ('once','every_time','per_interval'));

-- ---------------------------------------------------------------------------
-- 3. New trigger event types (Marketo Recs #4/#5), inactive pending activation
-- ---------------------------------------------------------------------------
INSERT INTO brain.triggers (trigger_id, trigger_class, trigger_family, name, description, active)
VALUES
  ('W-CR-001','workflow','campaign_request','campaign.request',
   'campaign.request — a play/volley formally requests another play (Marketo Request Campaign composability; P-601 cascade branches)', FALSE),
  ('A-IM-001','attention','attention_moment','attention.moment',
   'attention.moment — curated milestone worth human attention, feeds Wizard daily CTA cards (Marketo Interesting Moments)', FALSE)
ON CONFLICT (trigger_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Agent proposal surface (Monday MCP manage_automations pattern)
--    Agents (Claude/Devin/Cursor/Nexus) INSERT proposals; only Ed's approval
--    pass materializes them into ifttt.rules. No agent writes ifttt.rules
--    directly. Read surface = plain SELECT (already granted via devin_ro).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ifttt.rule_proposals (
  proposal_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by     text NOT NULL,             -- agent name: claude|devin|cursor|codex|nexus
  proposal_kind   text NOT NULL DEFAULT 'create'
                  CHECK (proposal_kind IN ('create','update','deactivate')),
  target_rule_id  uuid REFERENCES ifttt.rules(rule_id),  -- for update/deactivate
  rule_payload    jsonb NOT NULL,            -- full proposed rule row (create/update)
  rationale       text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','materialized')),
  reviewed_by     text,                      -- 'ED' on approval/rejection
  reviewed_at     timestamptz,
  materialized_rule_id uuid REFERENCES ifttt.rules(rule_id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ifttt_rule_proposals_pending
  ON ifttt.rule_proposals (status, created_at) WHERE status = 'pending';

COMMIT;

-- Post-checks:
--   \d ifttt.rules                       -- 4 new columns + check constraint
--   \d ifttt.rule_proposals              -- new table
--   SELECT trigger_id, active FROM brain.triggers
--     WHERE trigger_id IN ('W-CR-001','A-IM-001');   -- 2 rows, active=FALSE
--   Canary: 147 | 332631.30
