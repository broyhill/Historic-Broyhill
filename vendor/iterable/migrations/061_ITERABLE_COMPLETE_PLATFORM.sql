-- ============================================================================
-- ITERABLE COMPLETE PLATFORM — CANONICAL MIGRATION 061
-- File:   database/migrations/061_ITERABLE_COMPLETE_PLATFORM.sql
-- Author: Cursor · 2026-07-24
-- Canon:  ITERABLE_NOVA_TEARDOWN + ITERABLE_FULL_CAPABILITY_INVENTORY + inventory 2026-07-24
-- ----------------------------------------------------------------------------
-- Discoverable path (NOT under dryrun/). Hetzner apply only when Ed types:
--   I AUTHORIZE THIS ACTION
-- Additive only. No raw.* / core.di_donor_attribution / datatrust / acxiom writes.
-- Vendor executor seeds enabled=FALSE + de_identified_only=TRUE (DDL invariant).
-- ============================================================================
BEGIN;

DO $$
DECLARE
    v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
      FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL: got %/% expected 147/332631.30 — ABORT', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS: % / %', v_txns, v_total;
END $$;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS brain;

-- ── Propensity coefficient staging (Iterable → LP) ──
CREATE TABLE IF NOT EXISTS staging.iterable_propensity (
    user_id                 TEXT PRIMARY KEY,           -- candidate-scoped pseudonym / Iterable userId
    brand_affinity_label    TEXT,
    predictive_goal_score   NUMERIC,
    channel_propensity      TEXT,
    send_time_slot          TEXT,
    frequency_cap           INTEGER,
    raw_fields              JSONB NOT NULL DEFAULT '{}'::jsonb,
    pulled_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iterable_propensity_pulled
  ON staging.iterable_propensity(pulled_at DESC);
CREATE INDEX IF NOT EXISTS idx_iterable_propensity_affinity
  ON staging.iterable_propensity(brand_affinity_label);

COMMENT ON TABLE staging.iterable_propensity IS
  'Iterable Nova propensities → LP coefficients. Never stores donor signature. '
  'Joins to donor via staging.iterable_userid_map only.';

-- ── userId map (pseudonym ↔ cluster, candidate-scoped) ──
CREATE TABLE IF NOT EXISTS staging.iterable_userid_map (
    user_id         TEXT NOT NULL,
    candidate_id    UUID NOT NULL,
    cluster_id      INTEGER,                            -- INTEGER per canon (not BIGINT/TEXT)
    project_id      TEXT,                               -- Iterable project (= tenant)
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (candidate_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_iterable_userid_cluster
  ON staging.iterable_userid_map(cluster_id) WHERE active;

COMMENT ON TABLE staging.iterable_userid_map IS
  'Maps Iterable userId (de-identified) to core.donor_profile.cluster_id under candidate RLS. '
  'One Iterable project per candidate (inventory §12).';

-- ── USDC IP allowlist cache (firewall reconciler) ──
CREATE TABLE IF NOT EXISTS staging.iterable_usdc_ip_ranges (
    prefix          TEXT PRIMARY KEY,
    ip_version      SMALLINT NOT NULL CHECK (ip_version IN (4, 6)),
    label           TEXT,                               -- webhooks | datafeeds | …
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vendor action executors (inert until live-fire flip) ──
-- Requires brain.action_executors from KEYSTONE dry-run (2026-06-14).
DO $$
BEGIN
    IF to_regclass('brain.action_executors') IS NULL THEN
        RAISE NOTICE 'brain.action_executors missing — skip Iterable executor seeds (apply KEYSTONE first)';
        RETURN;
    END IF;

    INSERT INTO brain.action_executors
      (executor_code, ecosystem_code, weapon, event_class, handler_kind,
       handler_endpoint, enabled, is_vendor, de_identified_only,
       requires_observe_pass, requires_go_nogo, requires_compliance)
    VALUES
      ('EXEC_ITERABLE_EMAIL_SEND','ITERABLE','email','donation.received','vendor_webhook',
       'https://api.iterable.com/api/email/target', FALSE, TRUE, TRUE,
       TRUE, TRUE, TRUE),
      ('EXEC_ITERABLE_PROPENSITY_PULL','ITERABLE','vendor','iterable.propensity.sync','worker',
       '/workers/iterable-propensity-sync', FALSE, TRUE, TRUE,
       TRUE, FALSE, FALSE)
    ON CONFLICT (executor_code) DO NOTHING;

    RAISE NOTICE 'Iterable executors seeded enabled=FALSE';
END $$;

COMMIT;

-- ROLLBACK sketch:
--   DROP TABLE IF EXISTS staging.iterable_usdc_ip_ranges;
--   DROP TABLE IF EXISTS staging.iterable_userid_map;
--   DROP TABLE IF EXISTS staging.iterable_propensity;
--   DELETE FROM brain.action_executors WHERE ecosystem_code='ITERABLE';
