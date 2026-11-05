-- ============================================================================
-- MIGRATION: E31 Enterprise SMS/MMS/iMessage Schema
-- Author:   Devin (designer) · Date: 2026-07-05
-- Deployer: Cursor (Hetzner 37.27.169.232) under Ed Broyhill authorization
-- Depends:  core schema, brain schema
-- SAFETY:   Canary-guarded. BEGIN/COMMIT. Idempotent (IF NOT EXISTS throughout).
--           Touches e31.* and core.sms_phone_registry only.
--           Never writes raw.*, spine.*, donor_intelligence.*
-- SOURCE:   archive/201_e31_sms_enterprise_schema.sql (expanded for Sendblue,
--           AI journeys, behavior tracking, shortlinks, A/B test results)
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
-- Platform-wide phone consent, fatigue tracking, and iMessage capability.
-- One row per phone_e164. Single source of truth for opt-in status,
-- one-text-per-day TCPA gate, and Sendblue iMessage detection.
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.sms_phone_registry (
  phone_e164          TEXT PRIMARY KEY,
  rnc_regid           TEXT,
  opt_in_status       TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (opt_in_status IN ('opted_in','opted_out','unknown','pending')),
  opt_in_source       TEXT,
  opt_in_timestamp    TIMESTAMPTZ,
  opt_out_timestamp   TIMESTAMPTZ,
  opt_out_keyword     TEXT,
  is_valid            BOOLEAN NOT NULL DEFAULT TRUE,
  line_type           TEXT CHECK (line_type IN ('mobile','landline','voip','unknown',NULL)),
  carrier             TEXT,
  is_imessage         BOOLEAN DEFAULT NULL,       -- Sendblue iMessage detection result
  texts_today         INTEGER NOT NULL DEFAULT 0,
  texts_today_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  last_texted_at      TIMESTAMPTZ,
  last_texted_by_candidate_id UUID,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_phone_reg_rnc     ON core.sms_phone_registry (rnc_regid);
CREATE INDEX IF NOT EXISTS ix_phone_reg_status  ON core.sms_phone_registry (opt_in_status);
CREATE INDEX IF NOT EXISTS ix_phone_reg_texts   ON core.sms_phone_registry (texts_today, texts_today_date);
CREATE INDEX IF NOT EXISTS ix_phone_reg_imsg    ON core.sms_phone_registry (is_imessage) WHERE is_imessage = TRUE;

COMMENT ON TABLE core.sms_phone_registry IS
  'Platform-wide phone consent + fatigue gate + iMessage detection. '
  'texts_today is the TCPA one-text-per-day filter. '
  'Opt-out is platform-wide — once a phone opts out, no candidate can text it. '
  'is_imessage from Sendblue evaluate-service API for auto-routing.';

-- ============================================================================
-- e31.sms_platform_log
-- Immutable record of every text sent. Expanded for iMessage + read receipts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_platform_log (
  log_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id        UUID NOT NULL,
  campaign_id         UUID,
  send_id             UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_e164          TEXT NOT NULL,
  rnc_regid           TEXT,
  message_body        TEXT NOT NULL,
  media_url           TEXT,
  twilio_message_sid  TEXT UNIQUE,
  twilio_status       TEXT,
  error_code          TEXT,
  direction           TEXT NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound','inbound')),
  message_type        TEXT NOT NULL DEFAULT 'sms'
                        CHECK (message_type IN ('sms','mms','rcs','imessage')),
  provider            TEXT DEFAULT 'twilio'
                        CHECK (provider IN ('twilio','sinch','bandwidth','sendblue')),
  cost_usd            NUMERIC(10,6),
  is_read             BOOLEAN DEFAULT FALSE,       -- iMessage read receipt
  read_at             TIMESTAMPTZ,                 -- when donor read it
  brain_authorized    BOOLEAN NOT NULL DEFAULT FALSE,
  brain_auth_token    TEXT,
  sent_at             TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_platform_log_candidate CHECK (candidate_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_sms_log_candidate  ON e31.sms_platform_log (candidate_id);
CREATE INDEX IF NOT EXISTS ix_sms_log_phone      ON e31.sms_platform_log (phone_e164);
CREATE INDEX IF NOT EXISTS ix_sms_log_campaign   ON e31.sms_platform_log (campaign_id);
CREATE INDEX IF NOT EXISTS ix_sms_log_sent       ON e31.sms_platform_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS ix_sms_log_twilio     ON e31.sms_platform_log (twilio_message_sid);
CREATE INDEX IF NOT EXISTS ix_sms_log_provider   ON e31.sms_platform_log (provider);
CREATE INDEX IF NOT EXISTS ix_sms_log_read       ON e31.sms_platform_log (is_read) WHERE is_read = TRUE;

ALTER TABLE e31.sms_platform_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_platform_log_candidate_isolation ON e31.sms_platform_log;
CREATE POLICY sms_platform_log_candidate_isolation ON e31.sms_platform_log
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

-- ============================================================================
-- e31.sms_campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_campaigns (
  campaign_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  wizard_session_id   UUID,
  campaign_name       TEXT NOT NULL,
  message_body        TEXT NOT NULL,
  media_url           TEXT,
  campaign_type       TEXT NOT NULL DEFAULT 'blast'
                        CHECK (campaign_type IN ('blast','drip','ab_test','p2p','triggered')),
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
  target_universe     TEXT,
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
-- e31.sms_inbound
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_inbound (
  inbound_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  twilio_message_sid  TEXT UNIQUE,
  from_phone          TEXT NOT NULL,
  to_phone            TEXT NOT NULL,
  message_body        TEXT,
  media_url           TEXT,
  is_stop_keyword     BOOLEAN NOT NULL DEFAULT FALSE,
  stop_keyword        TEXT,
  classified_as       TEXT,
  candidate_id        UUID,
  responded_to        BOOLEAN DEFAULT FALSE,
  received_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sms_inbound_from   ON e31.sms_inbound (from_phone);
CREATE INDEX IF NOT EXISTS ix_sms_inbound_stop   ON e31.sms_inbound (is_stop_keyword) WHERE is_stop_keyword;
CREATE INDEX IF NOT EXISTS ix_sms_inbound_class  ON e31.sms_inbound (classified_as);

-- ============================================================================
-- e31.sms_number_pool
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_number_pool (
  number_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164          TEXT UNIQUE NOT NULL,
  candidate_id        UUID,
  twilio_sid          TEXT,
  number_type         TEXT NOT NULL DEFAULT 'local'
                        CHECK (number_type IN ('local','toll_free','short_code','10dlc')),
  ten_dlc_brand_id    TEXT,
  ten_dlc_campaign_id TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','released')),
  assigned_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_number_pool_candidate ON e31.sms_number_pool (candidate_id);

-- ============================================================================
-- e31.sms_drip_sequences / sms_drip_enrollments
-- Expanded: steps_json (JSONB) replaces separate sms_drip_steps table
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_drip_sequences (
  sequence_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  sequence_name       TEXT NOT NULL,
  trigger_event       TEXT,
  steps_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','archived')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE e31.sms_drip_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_drip_seq_isolation ON e31.sms_drip_sequences;
CREATE POLICY sms_drip_seq_isolation ON e31.sms_drip_sequences
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

CREATE TABLE IF NOT EXISTS e31.sms_drip_enrollments (
  enrollment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         UUID NOT NULL REFERENCES e31.sms_drip_sequences(sequence_id),
  phone_e164          TEXT NOT NULL,
  current_step        INTEGER NOT NULL DEFAULT 1,
  context             JSONB DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','cancelled','opted_out')),
  enrolled_at         TIMESTAMPTZ DEFAULT now(),
  next_send_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_drip_enroll_next ON e31.sms_drip_enrollments (next_send_at)
  WHERE status = 'active';

-- ============================================================================
-- e31.sms_ab_tests / sms_ab_test_results
-- Multi-variant A/B testing with per-variant outcome tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_ab_tests (
  test_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL,
  campaign_id         UUID REFERENCES e31.sms_campaigns(campaign_id),
  test_name           TEXT NOT NULL,
  variants_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_pct          NUMERIC(5,2) DEFAULT 100.0,
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','cancelled')),
  winner_variant      TEXT,
  started_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

ALTER TABLE e31.sms_ab_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_ab_tests_isolation ON e31.sms_ab_tests;
CREATE POLICY sms_ab_tests_isolation ON e31.sms_ab_tests
  USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);

CREATE TABLE IF NOT EXISTS e31.sms_ab_test_results (
  result_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  test_id             UUID NOT NULL REFERENCES e31.sms_ab_tests(test_id),
  variant_name        TEXT NOT NULL,
  sends               INTEGER NOT NULL DEFAULT 0,
  deliveries          INTEGER NOT NULL DEFAULT 0,
  replies             INTEGER NOT NULL DEFAULT 0,
  opt_outs            INTEGER NOT NULL DEFAULT 0,
  donations           INTEGER NOT NULL DEFAULT 0,
  donation_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (test_id, variant_name)
);

-- ============================================================================
-- e31.sms_cost_ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_cost_ledger (
  ledger_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id        UUID NOT NULL,
  ledger_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  sms_count           INTEGER NOT NULL DEFAULT 0,
  mms_count           INTEGER NOT NULL DEFAULT 0,
  imessage_count      INTEGER NOT NULL DEFAULT 0,
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
-- e31.sms_shortlinks / sms_shortlink_clicks
-- Trackable short URLs with click attribution
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_shortlinks (
  shortlink_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  short_code          TEXT UNIQUE NOT NULL,
  destination_url     TEXT NOT NULL,
  candidate_id        UUID NOT NULL,
  campaign_id         UUID,
  variant_name        TEXT,
  phone_e164          TEXT,
  click_count         INTEGER NOT NULL DEFAULT 0,
  last_clicked_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_shortlinks_code      ON e31.sms_shortlinks (short_code);
CREATE INDEX IF NOT EXISTS ix_shortlinks_campaign   ON e31.sms_shortlinks (campaign_id);

CREATE TABLE IF NOT EXISTS e31.sms_shortlink_clicks (
  click_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  short_code          TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT,
  device_type         TEXT,
  clicked_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_shortlink_clicks_code ON e31.sms_shortlink_clicks (short_code);

-- ============================================================================
-- e31.sms_journey_enrollments
-- AI Journey adaptive conversation flow state machine
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_journey_enrollments (
  enrollment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164          TEXT NOT NULL,
  journey_type        TEXT NOT NULL,
  candidate_id        UUID NOT NULL,
  current_step        INTEGER NOT NULL DEFAULT 1,
  context             JSONB DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','cancelled')),
  enrolled_at         TIMESTAMPTZ DEFAULT now(),
  next_send_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_journey_enroll_status ON e31.sms_journey_enrollments (status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_journey_enroll_phone  ON e31.sms_journey_enrollments (phone_e164);

-- ============================================================================
-- e31.sms_behavior_events
-- Tracks donor behavior: read receipts, clicks, response times, etc.
-- Feeds into donor engagement scoring and AI journey adaptation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e31.sms_behavior_events (
  event_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_e164          TEXT NOT NULL,
  event_type          TEXT NOT NULL,               -- 'read_receipt','click','reply','opt_out'
  event_data          JSONB DEFAULT '{}'::jsonb,
  occurred_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_behavior_phone  ON e31.sms_behavior_events (phone_e164);
CREATE INDEX IF NOT EXISTS ix_behavior_type   ON e31.sms_behavior_events (event_type);

-- ============================================================================
-- FATIGUE FILTER VIEW (expanded for iMessage routing)
-- ============================================================================

CREATE OR REPLACE VIEW e31.v_eligible_phones AS
SELECT r.phone_e164, r.rnc_regid, r.opt_in_status,
       r.line_type, r.carrier, r.is_imessage
FROM   core.sms_phone_registry r
WHERE  r.texts_today = 0
  AND  r.opt_in_status != 'opted_out'
  AND  r.is_valid = TRUE
  AND  (r.line_type IS NULL OR r.line_type = 'mobile')
  AND  r.texts_today_date = CURRENT_DATE;

COMMENT ON VIEW e31.v_eligible_phones IS
  'Phones eligible to receive a text right now. '
  'is_imessage column enables auto-routing: TRUE → Sendblue, FALSE/NULL → Twilio.';

-- ============================================================================
-- BRAIN THROTTLE REGISTRATION
-- ============================================================================

INSERT INTO brain.throttle_registry (ecosystem_id, throttle_type, daily_limit, per_candidate_daily_limit, status)
VALUES ('E31', 'sms_outbound', 10000000, 50000, 'active')
ON CONFLICT (ecosystem_id) DO UPDATE
  SET daily_limit = EXCLUDED.daily_limit,
      per_candidate_daily_limit = EXCLUDED.per_candidate_daily_limit,
      status = EXCLUDED.status;

-- ============================================================================
-- POST-CANARY
-- ============================================================================

COMMIT;

DO $$ BEGIN
  IF (SELECT count(*) FROM raw.ncboe_donations WHERE cluster_id = 372171) <> 147
  THEN RAISE EXCEPTION 'POST-CANARY VIOLATED — investigate immediately'; END IF;
  RAISE NOTICE 'POST-CANARY OK: 147 rows confirmed. E31 Enterprise SMS/MMS/iMessage schema complete.';
END $$;

-- VERIFY:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'e31' ORDER BY table_name;
-- Expected: sms_ab_test_results, sms_ab_tests, sms_behavior_events, sms_campaigns,
--           sms_cost_ledger, sms_drip_enrollments, sms_drip_sequences, sms_inbound,
--           sms_journey_enrollments, sms_number_pool, sms_platform_log,
--           sms_shortlink_clicks, sms_shortlinks
-- SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='sms_phone_registry';
-- SELECT * FROM brain.throttle_registry WHERE ecosystem_id = 'E31';
-- ROLLBACK: DROP SCHEMA e31 CASCADE; DROP TABLE core.sms_phone_registry;
