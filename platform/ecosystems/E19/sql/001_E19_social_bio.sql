-- ============================================================================
-- Migration 001 — E19 Social — Link-in-Bio
-- ============================================================================
-- Status: DRY-RUN (do not execute until Eddie authorizes)
-- Purpose: Per-candidate bio page generator with click attribution + QR
-- Dependencies: candidate silo (built), branding config (built),
--               WinRed/Anedot attribution code generator (built)
-- Reversible: YES — see migrations/rollback/001_rollback.sql
-- ============================================================================

BEGIN;

-- Schema namespace
CREATE SCHEMA IF NOT EXISTS e19_social;
COMMENT ON SCHEMA e19_bio IS
  'E19 Social — Link-in-Bio — per-candidate bio page generator with click attribution.';

-- ----------------------------------------------------------------------------
-- e19_bio.bio_pages — one row per candidate bio page
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_bio.bio_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    slug            VARCHAR(80) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    custom_domain   VARCHAR(255),     -- e.g. johnsmith2026.com/bio
    page_title      VARCHAR(255),
    page_subtitle   VARCHAR(500),
    profile_photo_asset_id UUID,      -- reference to E08 communications library
    theme_overrides JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bio_pages_slug_chars
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
    CONSTRAINT bio_pages_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_bio_pages_candidate ON e19_bio.bio_pages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bio_pages_active    ON e19_bio.bio_pages(is_active) WHERE is_active;

-- ----------------------------------------------------------------------------
-- e19_bio.bio_links — links displayed on the bio page (donate, volunteer, RSVP, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_bio.bio_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    bio_page_id     UUID NOT NULL REFERENCES e19_bio.bio_pages(id) ON DELETE CASCADE,
    link_slug       VARCHAR(80) NOT NULL,   -- e.g. 'donate', 'townhall', 'volunteer'
    display_label   VARCHAR(120) NOT NULL,
    icon_name       VARCHAR(60),            -- lucide-react icon name
    target_url      TEXT NOT NULL,
    link_type       VARCHAR(40) NOT NULL,   -- donate | volunteer | event | issue | external
    sort_order      INT NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    attribution_code VARCHAR(80),           -- stamped onto WinRed/Anedot links
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bio_links_slug_unique UNIQUE (bio_page_id, link_slug),
    CONSTRAINT bio_links_type_valid
        CHECK (link_type IN ('donate','volunteer','event','issue','social','external'))
);

CREATE INDEX IF NOT EXISTS idx_bio_links_page    ON e19_bio.bio_links(bio_page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bio_links_active  ON e19_bio.bio_links(is_active) WHERE is_active;

-- ----------------------------------------------------------------------------
-- e19_bio.bio_link_clicks — every click event, attribution-ready
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_bio.bio_link_clicks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    bio_page_id         UUID NOT NULL,
    bio_link_id         UUID,                       -- nullable: page view (no link click)
    click_timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Attribution payload
    ip_hash             BYTEA,                      -- sha256(ip + daily salt)
    user_agent          TEXT,
    referrer            TEXT,
    utm_source          VARCHAR(120),
    utm_medium          VARCHAR(120),
    utm_campaign        VARCHAR(120),
    qr_source           VARCHAR(80),                -- 'mailer_E33', 'yard_sign', 'door_hanger', etc.
    qr_print_run_id     UUID,                       -- ties back to E33/E14/E18 print job

    -- Identity (populated async by resolver)
    resolved_contact_id UUID,
    resolved_rncid      VARCHAR(40),
    resolved_at         TIMESTAMPTZ,

    -- Geo (best-effort, never used for targeting; just attribution)
    geo_country         VARCHAR(2),
    geo_region          VARCHAR(40),
    geo_city            VARCHAR(80),

    -- E61 cost capture handle (link to action_costs row)
    cost_event_id       UUID,
    benefit_event_id    UUID                        -- populated when click → donation
);

CREATE INDEX IF NOT EXISTS idx_clicks_candidate_time
    ON e19_bio.bio_link_clicks(candidate_id, click_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_page_time
    ON e19_bio.bio_link_clicks(bio_page_id, click_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_resolved
    ON e19_bio.bio_link_clicks(resolved_contact_id) WHERE resolved_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_qr_source
    ON e19_bio.bio_link_clicks(qr_source, click_timestamp DESC) WHERE qr_source IS NOT NULL;

-- ----------------------------------------------------------------------------
-- e19_bio.qr_print_runs — registers QR-encoded print runs from E14/E18/E33
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_bio.qr_print_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    print_ecosystem     VARCHAR(10) NOT NULL,       -- E14, E18, or E33
    bio_link_id         UUID,                       -- which link the QR resolves to
    print_run_date      DATE NOT NULL,
    quantity_printed    INT NOT NULL,
    cost_per_unit_cents INT NOT NULL,               -- emitted to E61
    qr_token            VARCHAR(40) NOT NULL,       -- short token in URL: bio.broyhillgop.com/{slug}?q={qr_token}
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT qr_token_unique UNIQUE (qr_token),
    CONSTRAINT qr_ecosystem_valid CHECK (print_ecosystem IN ('E14','E18','E33'))
);

CREATE INDEX IF NOT EXISTS idx_qr_runs_candidate ON e19_bio.qr_print_runs(candidate_id, print_run_date DESC);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE e19_bio.bio_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_bio.bio_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_bio.bio_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_bio.qr_print_runs   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_bio' AND tablename='bio_pages' AND policyname='candidate_isolation') THEN
        CREATE POLICY candidate_isolation ON e19_bio.bio_pages
            USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_bio' AND tablename='bio_links' AND policyname='candidate_isolation') THEN
        CREATE POLICY candidate_isolation ON e19_bio.bio_links
            USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_bio' AND tablename='bio_link_clicks' AND policyname='candidate_isolation') THEN
        CREATE POLICY candidate_isolation ON e19_bio.bio_link_clicks
            USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_bio' AND tablename='qr_print_runs' AND policyname='candidate_isolation') THEN
        CREATE POLICY candidate_isolation ON e19_bio.qr_print_runs
            USING (candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Public read endpoint for bio pages (anonymous visitors).
-- The renderer uses a service role bypassing RLS, but reads only by slug.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW e19_bio.bio_page_public AS
SELECT
    p.slug,
    p.page_title,
    p.page_subtitle,
    p.theme_overrides,
    p.profile_photo_asset_id,
    p.candidate_id,
    p.custom_domain
FROM e19_bio.bio_pages p
WHERE p.is_active;

-- ----------------------------------------------------------------------------
-- Trigger: emit cost event to E61 on every click (deferred, async)
-- ----------------------------------------------------------------------------
-- (Logic implemented in shared/observability/cost_benefit_emitter.py;
--  we do NOT trigger from inside Postgres to keep DB transactions short.
--  Instead, the click handler API writes the click row AND emits cost asynchronously.)

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- BEGIN;
--   DROP SCHEMA e19_bio CASCADE;
-- COMMIT;
