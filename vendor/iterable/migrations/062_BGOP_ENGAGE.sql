-- ============================================================================
-- 062 BGOP ENGAGE — native engagement app schema
-- File:   database/migrations/062_BGOP_ENGAGE.sql
-- Product: ecosystems/bgop_engage/  (CLONE — no Iterable subscribe)
-- ----------------------------------------------------------------------------
-- Discoverable path (NOT under dryrun/).
-- Hetzner apply only when Ed types: I AUTHORIZE THIS ACTION
-- Additive. No sacred-table writes. No vendor SaaS.
-- ==============================================================================
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

CREATE SCHEMA IF NOT EXISTS engage;

CREATE TABLE IF NOT EXISTS engage.profiles (
    engage_user_id   TEXT PRIMARY KEY,
    candidate_id     UUID NOT NULL,
    cluster_id       INTEGER,                          -- INTEGER per canon
    email            TEXT,
    attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_engage_profiles_candidate ON engage.profiles(candidate_id);
CREATE INDEX IF NOT EXISTS idx_engage_profiles_cluster ON engage.profiles(cluster_id);

CREATE TABLE IF NOT EXISTS engage.userid_map (
    engage_user_id   TEXT NOT NULL,
    candidate_id     UUID NOT NULL,
    cluster_id       INTEGER,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (candidate_id, engage_user_id)
);

CREATE TABLE IF NOT EXISTS engage.propensities (
    engage_user_id         TEXT PRIMARY KEY REFERENCES engage.profiles(engage_user_id),
    brand_affinity_label   TEXT,
    p_engage               NUMERIC,
    preferred_channel      TEXT,
    send_time_slot         TEXT,
    frequency_cap          INTEGER,
    raw_fields             JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engage.catalog_items (
    item_id      TEXT PRIMARY KEY,
    item_type    TEXT NOT NULL,                       -- ask|event|content
    title        TEXT NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engage.journeys (
    journey_id     TEXT PRIMARY KEY,
    candidate_id   UUID NOT NULL,
    name           TEXT NOT NULL,
    definition     JSONB NOT NULL DEFAULT '{}'::jsonb, -- tiles
    enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engage.campaigns (
    campaign_id    TEXT PRIMARY KEY,
    candidate_id   UUID NOT NULL,
    name           TEXT NOT NULL,
    channel        TEXT NOT NULL DEFAULT 'email',
    template_ref   TEXT,
    meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engage.events (
    event_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engage_user_id   TEXT,
    event_class      TEXT NOT NULL,
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_engage_events_class ON engage.events(event_class);
CREATE INDEX IF NOT EXISTS idx_engage_events_user ON engage.events(engage_user_id);

COMMENT ON SCHEMA engage IS
  'BGOP Engage — native Iterable-class clone. No vendor SaaS. Send via E30. LP decides.';

COMMIT;
