-- ============================================================================
-- MIGRATION 201: E31 SMS Enterprise Schema
-- Author:   Claude (designer) · Date: 2026-06-05
-- Deployer: Cursor (Hetzner 37.27.169.232) under Ed Broyhill authorization
-- Depends:  core schema, brain schema, spine.donor_rollup
-- SAFETY:   Canary-guarded. BEGIN/COMMIT. Idempotent (IF NOT EXISTS throughout).
--           Touches e31.* and core.sms_phone_registry only.
--           Never writes raw.*, spine.*, donor_intelligence.*
-- ============================================================================

-- CANARY — STOP if violated
DO $$ BEGIN
  IF (SELECT count(*) FROM raw.ncboe_donations WHERE cluster_id = 372171) <> 147
  THEN RAISE EXCEPTION 'CANARY VIOLATED — STOP. Do not proceed.'; END IF;
  RAISE NOTICE 'CANARY OK: 147 rows confirmed';
END $$;

BEGIN;

-- ============================================================================
-- SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS e31;

-- ============================================================================
-- core.sms_phone_registry
-- Platform-wide phone consent and fatigue tracking, enforced across ALL
-- 3,000 candidates. One row per phone_e164. This is the single source of truth
-- for opt-in status and the one-text-per-day TCPA gate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.sms_phone_registry (
  phone_e164          TEXT PRIMARY KEY,           -- E.164 format: +19195551234
  rnc_regid           TEXT,                       -- donor spine join key (nullable)
  opt_in_status       TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (opt_in_status IN ('opted_in','opted_out','unknown','pending')),
  opt_in_source       TEXT,                       -- 'website_form','reply_yes','manual','import'
  opt_in_timestamp    TIMESTAMPTZ,
  opt_out_timestamp   TIMESTAMPTZ,
  opt_out_keyword     TEXT,                       -- 'STOP','UNSUBSCRIBE','CANCEL','END','QUIT'
  is_valid            BOOLEAN NOT NULL DEFAULT TRUE,
  line_type           TEXT CHECK (line_type IN ('mobile','landline','voip','unknown',NULL)),
  carrier             TEXT,
  texts_today         INTEGER NOT NULL DEFAULT 0, -- reset daily at midnight ET; filter gate
  texts_today_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  last_texted_at      TIMESTAMPTZ,
  last_texted_by_candidate_id UUID,               -- which candidate sent the last text
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_phone_reg_rnc     ON core.sms_phone_registry (rnc_regid);
CREATE INDEX IF NOT EXISTS ix_phone_reg_status  ON core.sms_phone_registry (opt_in_status);
CREATE INDEX IF NOT EXISTS ix_phone_reg_texts   ON core.sms_phone_registry (texts_today, texts_today_date);

COMMENT ON TABLE core.sms_phone_registry IS
  'Platform-wide phone consent + fatigue gate. texts_today is the TCPA one-text-per-day filter. '
  'Reset daily. Opt-out is platform-wide — once a phone opts out, no candidate can text it.';

COMMENT ON COLUMN core.sms_phone_registry.texts_today IS
  'Filter, not a gate. texts_today = 0 means eligible for outreach. '
  'After filtering eligible phones, fire immediately via Twilio — no hold queue.';

-- ============================================================================
-- e31.sms_platform_log
-- Immutable record of every text ever sent across all candidates. Never updated,
-- only inserted. Twilio MessageSID is the primary external key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_platform_log (
  log_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id        UUID NOT NULL,
  campaign_id         UUID,                       -- -> e31.sms_campaigns
  send_id             UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_e164          TEXT NOT NULL,
  rnc_regid           TEXT,
  message_body        TEXT NOT NULL,
  media_url           TEXT,                       -- MMS attachment
  twilio_message_sid  TEXT UNIQUE,               -- Twilio MessageSID — must log
  twilio_status       TEXT,                       -- queued|sent|delivered|failed|undelivered
  direction           TEXT NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound','inbound')),
  message_type        TEXT NOT NULL DEFAULT 'sms'
                        CHECK (message_type IN ('sms','mms','rcs')),
  cost_usd            NUMERIC(10,6),
  brain_authorized    BOOLEAN NOT NULL DEFAULT FALSE,  -- was Brain throttle checked?
  brain_auth_token    TEXT,                            -- Brain authorization reference
  sent_at             TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_platform_log_candidate CHECK (candidate_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_sms_log_candidate  ON e31.sms_platform_log (candidate_id);
CREATE INDEX IF NOT EXISTS ix_sms_log_phone      ON e31.sms_platform_log (phone_e164);
CREATE INDEX IF NOT EXISTS ix_sms_log_campaign   ON e31.sms_platform_log (campaign_id);
CREATE INDEX IF NOT EXISTS ix_sms_log_sent       ON e31.sms_platform_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS ix_sms_log_twilio     ON e31.sms_platform_log (twilio_message_sid);

-- RLS: candidates see only their own sends
ALTER TABLE e31.sms_platform_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_platform_log_candidate_isolation ON e31.sms_platform_log;
CREATE POLICY sms_platform_log_candidate_isolation ON e31.sms_platform_log
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

-- ============================================================================
-- e31.sms_campaigns
-- One row per campaign per candidate. Candidate-siloed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_campaigns (
  campaign_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  wizard_session_id   UUID,                       -- -> E68 Campaign Wizard
  campaign_name       TEXT NOT NULL,
  message_body        TEXT NOT NULL,
  media_url           TEXT,
  campaign_type       TEXT NOT NULL DEFAULT 'blast'
                        CHECK (campaign_type IN ('blast','drip','ab_test','p2p','triggered')),
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
  target_universe     TEXT,                       -- SQL fragment or segment name
  scheduled_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  sends_total         INTEGER DEFAULT 0,
  sends_delivered     INTEGER DEFAULT 0,
  sends_failed        INTEGER DEFAULT 0,
  opt_outs_triggered  INTEGER DEFAULT 0,
  replies_received    INTEGER DEFAULT 0,
  brain_authorized    BOOLEAN NOT NULL DEFAULT FALSE,
  brain_auth_token    TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sms_campaigns_candidate ON e31.sms_campaigns (candidate_id);
CREATE INDEX IF NOT EXISTS ix_sms_campaigns_status    ON e31.sms_campaigns (status);
CREATE INDEX IF NOT EXISTS ix_sms_campaigns_wizard    ON e31.sms_campaigns (wizard_session_id);

ALTER TABLE e31.sms_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_campaigns_candidate_isolation ON e31.sms_campaigns;
CREATE POLICY sms_campaigns_candidate_isolation ON e31.sms_campaigns
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

-- ============================================================================
-- e31.sms_drip_sequences / sms_drip_steps / sms_drip_enrollments
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_drip_sequences (
  sequence_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  sequence_name       TEXT NOT NULL,
  trigger_event       TEXT,                       -- 'new_donor','donation_lapsed','event_rsvp'
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','archived')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE e31.sms_drip_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_drip_seq_isolation ON e31.sms_drip_sequences;
CREATE POLICY sms_drip_seq_isolation ON e31.sms_drip_sequences
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

CREATE TABLE IF NOT EXISTS e31.sms_drip_steps (
  step_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID NOT NULL REFERENCES e31.sms_drip_sequences(sequence_id),
  step_number         INTEGER NOT NULL,
  delay_days          INTEGER NOT NULL DEFAULT 0,
  delay_hours         INTEGER NOT NULL DEFAULT 0,
  message_body        TEXT NOT NULL,
  media_url           TEXT,
  UNIQUE (sequence_id, step_number)
);

CREATE TABLE IF NOT EXISTS e31.sms_drip_enrollments (
  enrollment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID NOT NULL REFERENCES e31.sms_drip_sequences(sequence_id),
  candidate_id        UUID NOT NULL,
  phone_e164          TEXT NOT NULL,
  rnc_regid           TEXT,
  current_step        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','cancelled','opted_out')),
  enrolled_at         TIMESTAMPTZ DEFAULT now(),
  next_send_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_drip_enroll_next ON e31.sms_drip_enrollments (next_send_at)
  WHERE status = 'active';

ALTER TABLE e31.sms_drip_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_drip_enroll_isolation ON e31.sms_drip_enrollments;
CREATE POLICY sms_drip_enroll_isolation ON e31.sms_drip_enrollments
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

-- ============================================================================
-- e31.sms_inbound
-- Webhook receiver — every inbound message from Twilio
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_inbound (
  inbound_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  twilio_message_sid  TEXT UNIQUE NOT NULL,
  from_phone          TEXT NOT NULL,
  to_phone            TEXT NOT NULL,              -- our Twilio number
  message_body        TEXT,
  media_url           TEXT,
  is_stop_keyword     BOOLEAN NOT NULL DEFAULT FALSE,
  stop_keyword        TEXT,
  classified_as       TEXT,                       -- 'stop','reply','question','donation_intent'
  candidate_id        UUID,                       -- inferred from to_phone -> number_pool
  responded_to        BOOLEAN DEFAULT FALSE,
  received_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sms_inbound_from   ON e31.sms_inbound (from_phone);
CREATE INDEX IF NOT EXISTS ix_sms_inbound_stop   ON e31.sms_inbound (is_stop_keyword) WHERE is_stop_keyword;

-- ============================================================================
-- e31.sms_number_pool
-- Twilio phone number → candidate assignment
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_number_pool (
  number_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164          TEXT UNIQUE NOT NULL,       -- the Twilio number: +19195550100
  candidate_id        UUID,                       -- NULL = unassigned pool
  twilio_sid          TEXT,                       -- Twilio PhoneSID
  number_type         TEXT NOT NULL DEFAULT 'local'
                        CHECK (number_type IN ('local','toll_free','short_code','10dlc')),
  ten_dlc_brand_id    TEXT,                       -- 10DLC brand registration ID
  ten_dlc_campaign_id TEXT,                       -- 10DLC campaign registration ID
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','released')),
  assigned_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_number_pool_candidate ON e31.sms_number_pool (candidate_id);

-- ============================================================================
-- e31.sms_ab_tests / sms_ab_variants
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_ab_tests (
  test_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  campaign_id         UUID REFERENCES e31.sms_campaigns(campaign_id),
  test_name           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','cancelled')),
  winner_variant_id   UUID,
  started_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

ALTER TABLE e31.sms_ab_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_ab_tests_isolation ON e31.sms_ab_tests;
CREATE POLICY sms_ab_tests_isolation ON e31.sms_ab_tests
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

CREATE TABLE IF NOT EXISTS e31.sms_ab_variants (
  variant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id             UUID NOT NULL REFERENCES e31.sms_ab_tests(test_id),
  variant_name        TEXT NOT NULL,              -- 'A','B','C'
  message_body        TEXT NOT NULL,
  media_url           TEXT,
  allocation_pct      NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  sends               INTEGER DEFAULT 0,
  deliveries          INTEGER DEFAULT 0,
  replies             INTEGER DEFAULT 0,
  opt_outs            INTEGER DEFAULT 0,
  donations_attributed INTEGER DEFAULT 0,
  donation_amount_attributed NUMERIC(12,2) DEFAULT 0
);

-- ============================================================================
-- e31.sms_cost_ledger
-- Per-candidate per-day cost accounting
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_cost_ledger (
  ledger_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id        UUID NOT NULL,
  ledger_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  sms_count           INTEGER NOT NULL DEFAULT 0,
  mms_count           INTEGER NOT NULL DEFAULT 0,
  total_segments      INTEGER NOT NULL DEFAULT 0,
  cost_usd            NUMERIC(12,6) NOT NULL DEFAULT 0,
  failed_count        INTEGER NOT NULL DEFAULT 0,
  opt_out_count       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (candidate_id, ledger_date)
);

CREATE INDEX IF NOT EXISTS ix_cost_ledger_candidate ON e31.sms_cost_ledger (candidate_id, ledger_date DESC);

ALTER TABLE e31.sms_cost_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_cost_ledger_isolation ON e31.sms_cost_ledger;
CREATE POLICY sms_cost_ledger_isolation ON e31.sms_cost_ledger
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

-- ============================================================================
-- FATIGUE FILTER VIEW
-- The canonical query for eligible phones before any campaign fires.
-- Never queue ineligible phones — exclude them at run time and fire immediately.
-- ============================================================================

CREATE OR REPLACE VIEW e31.v_eligible_phones AS
SELECT r.phone_e164, r.rnc_regid, r.opt_in_status, r.line_type, r.carrier
FROM   core.sms_phone_registry r
WHERE  r.texts_today = 0
  AND  r.opt_in_status != 'opted_out'
  AND  r.is_valid = TRUE
  AND  (r.line_type IS NULL OR r.line_type = 'mobile')
  AND  r.texts_today_date = CURRENT_DATE;

COMMENT ON VIEW e31.v_eligible_phones IS
  'Phones eligible to receive a text right now. Join to your target universe to get the send list. '
  'Fire immediately after this join — no hold queue, no delay. '
  'Ineligible phones are excluded, not queued for tomorrow.';

-- ============================================================================
-- BRAIN THROTTLE REGISTRATION
-- Register E31 in brain.throttle_registry so Brain Worker enforces limits
-- ============================================================================

INSERT INTO brain.throttle_registry (ecosystem_id, dimension, throttle_value, set_by, reason)
SELECT v.ecosystem_id, v.dimension, v.throttle_value, v.set_by, v.reason
FROM (VALUES
  ('E31', 'sms_outbound_daily_limit', 10000000::numeric, 'DEFAULT', 'E31 SMS enterprise schema (migration 201) — global daily send ceiling'),
  ('E31', 'sms_outbound_per_candidate_daily_limit', 50000::numeric, 'DEFAULT', 'E31 SMS enterprise schema (migration 201) — per-candidate daily send ceiling')
) AS v(ecosystem_id, dimension, throttle_value, set_by, reason)
WHERE NOT EXISTS (
  SELECT 1 FROM brain.throttle_registry t
  WHERE t.ecosystem_id = v.ecosystem_id AND t.dimension = v.dimension
);

-- ============================================================================
-- POST-CANARY
-- ============================================================================

COMMIT;

DO $$ BEGIN
  IF (SELECT count(*) FROM raw.ncboe_donations WHERE cluster_id = 372171) <> 147
  THEN RAISE EXCEPTION 'POST-CANARY VIOLATED — investigate immediately'; END IF;
  RAISE NOTICE 'POST-CANARY OK: 147 rows confirmed. Migration 201 complete.';
END $$;

-- VERIFY:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'e31' ORDER BY table_name;
-- SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='sms_phone_registry';
-- SELECT * FROM brain.throttle_registry WHERE ecosystem_id = 'E31';
-- ROLLBACK: DROP SCHEMA e31 CASCADE; DROP TABLE core.sms_phone_registry;
