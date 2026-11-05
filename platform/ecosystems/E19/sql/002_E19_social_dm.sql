-- ============================================================================
-- Migration 002 — E19 Social — DM Capture with DataTrust Identity Resolution
-- ============================================================================
-- Status: DRY-RUN (do not execute until Eddie authorizes)
-- Purpose: IG/FB comment → identity resolution → branched DM with attribution
-- Dependencies: 004 (E61 must exist before cost emission), E44 social_identifier_index
-- Reversible: YES — see migrations/rollback/002_rollback.sql
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS e19_social;
COMMENT ON SCHEMA e19_dm IS
  'E19 Social — DM Capture — capture social comments, resolve identity, branched response.';

-- ----------------------------------------------------------------------------
-- e19_dm.keyword_configs — per-candidate keyword sets driving response branches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_dm.keyword_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    keyword         VARCHAR(120) NOT NULL,
    intent_class    VARCHAR(40) NOT NULL,    -- donate | volunteer | sign | townhall | issue_<topic> | rsvp
    priority        INT NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    response_template_id UUID,               -- E08 communications library reference
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kwc_unique UNIQUE (candidate_id, keyword, intent_class),
    CONSTRAINT kwc_intent_valid
        CHECK (intent_class ~ '^(donate|volunteer|sign|townhall|rsvp|issue_[a-z_]{1,80})$')
);

CREATE INDEX IF NOT EXISTS idx_kwc_lookup
    ON e19_dm.keyword_configs(candidate_id, is_active, priority DESC) WHERE is_active;

-- ----------------------------------------------------------------------------
-- e19_dm.comment_events — every Meta webhook comment event captured
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_dm.comment_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id            UUID NOT NULL,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Source platform
    source_platform         VARCHAR(20) NOT NULL,   -- instagram | facebook | threads
    external_event_id       VARCHAR(120) NOT NULL,  -- idempotency key from Meta
    external_post_id        VARCHAR(120),
    external_comment_id     VARCHAR(120),
    external_commenter_id   VARCHAR(120),
    commenter_handle        VARCHAR(120),
    commenter_display_name  VARCHAR(255),
    comment_text            TEXT,

    -- Processing state
    processing_state        VARCHAR(30) NOT NULL DEFAULT 'queued',
                             -- queued | resolving | resolved | branched | dispatched | failed | skipped
    processing_state_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_error        TEXT,

    -- Identity resolution outputs
    matched_keyword         VARCHAR(120),
    matched_intent_class    VARCHAR(40),
    resolved_contact_id     UUID,
    resolved_rncid          VARCHAR(40),
    resolved_grade          VARCHAR(8),             -- A++ ... U-
    resolved_district_match BOOLEAN,
    identity_match_score    NUMERIC(5,4),           -- 0.0000 to 1.0000

    -- Branch decision
    branch_taken            VARCHAR(60),
                             -- known_a_plus_in_district | known_b_in_district |
                             -- voter_match_no_history | unknown_in_district |
                             -- out_of_district | skipped_low_confidence

    -- E61 hooks
    cost_event_id           UUID,
    benefit_event_id        UUID,

    CONSTRAINT comment_events_idempotent UNIQUE (source_platform, external_event_id),
    CONSTRAINT comment_events_state_valid
        CHECK (processing_state IN ('queued','resolving','resolved','branched','dispatched','failed','skipped')),
    CONSTRAINT comment_events_platform_valid
        CHECK (source_platform IN ('instagram','facebook','threads'))
);

CREATE INDEX IF NOT EXISTS idx_comment_events_state
    ON e19_dm.comment_events(processing_state, received_at)
    WHERE processing_state IN ('queued','resolving');
CREATE INDEX IF NOT EXISTS idx_comment_events_candidate_time
    ON e19_dm.comment_events(candidate_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_events_resolved
    ON e19_dm.comment_events(resolved_contact_id) WHERE resolved_contact_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- e19_dm.dm_dispatched — every DM sent in response, TCPA-stamped
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_dm.dm_dispatched (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id            UUID NOT NULL,
    comment_event_id        UUID NOT NULL REFERENCES e19_dm.comment_events(id) ON DELETE CASCADE,
    sent_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Destination
    destination_platform    VARCHAR(20) NOT NULL,
    destination_user_id     VARCHAR(120),
    destination_thread_id   VARCHAR(120),

    -- Payload
    template_id             UUID,                    -- E08 reference
    rendered_body           TEXT NOT NULL,
    voice_dna_version       VARCHAR(40),             -- E48 versioning
    attribution_code        VARCHAR(80),             -- WinRed/Anedot stamp

    -- Compliance
    tcpa_consent_captured   BOOLEAN NOT NULL DEFAULT FALSE,
    tcpa_opt_in_method      VARCHAR(40),             -- prior_express | first_contact_optin | not_required
    fec_disclaimer_version  VARCHAR(40) NOT NULL,
    stop_keyword_honored    BOOLEAN NOT NULL DEFAULT TRUE,

    -- Outcome
    delivery_status         VARCHAR(30) NOT NULL DEFAULT 'pending',
                             -- pending | delivered | read | replied | failed | blocked_compliance
    delivery_status_at      TIMESTAMPTZ,
    failure_reason          TEXT,

    -- E61 hooks
    cost_event_id           UUID NOT NULL,           -- always emit cost on dispatch attempt
    benefit_event_id        UUID,                    -- populated when downstream donation attributed

    CONSTRAINT dm_status_valid CHECK (delivery_status IN
        ('pending','delivered','read','replied','failed','blocked_compliance'))
);

CREATE INDEX IF NOT EXISTS idx_dm_candidate_time
    ON e19_dm.dm_dispatched(candidate_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_event
    ON e19_dm.dm_dispatched(comment_event_id);
CREATE INDEX IF NOT EXISTS idx_dm_attribution
    ON e19_dm.dm_dispatched(attribution_code) WHERE attribution_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- e19_dm.identity_resolutions — log of resolution attempts (for variance analysis)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_dm.identity_resolutions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id            UUID NOT NULL,
    comment_event_id        UUID NOT NULL,
    attempted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Inputs
    input_handle            VARCHAR(120),
    input_display_name      VARCHAR(255),
    input_platform          VARCHAR(20),

    -- Resolution path
    resolver_strategy       VARCHAR(60),
                             -- exact_handle_index | fuzzy_name_district |
                             -- email_hash_match | acxiom_join | unresolved
    resolution_latency_ms   INT,
    resolution_success      BOOLEAN NOT NULL,

    -- Outputs
    resolved_contact_id     UUID,
    resolved_rncid          VARCHAR(40),
    confidence_score        NUMERIC(5,4),

    -- Diagnostics
    candidates_considered   INT,
    raw_match_payload       JSONB
);

CREATE INDEX IF NOT EXISTS idx_idres_candidate_time
    ON e19_dm.identity_resolutions(candidate_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_idres_strategy
    ON e19_dm.identity_resolutions(resolver_strategy, resolution_success);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE e19_dm.keyword_configs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_dm.comment_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_dm.dm_dispatched         ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_dm.identity_resolutions  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['keyword_configs','comment_events','dm_dispatched','identity_resolutions'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_dm' AND tablename=t AND policyname='candidate_isolation') THEN
            EXECUTE format(
                'CREATE POLICY candidate_isolation ON e19_dm.%I USING (candidate_id = current_setting(''app.current_candidate_id'', TRUE)::UUID)',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;
