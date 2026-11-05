-- ============================================================================
-- Migration 003 — E36 Unified Inbox Extension
-- ============================================================================
-- Status: DRY-RUN (do not execute until Eddie authorizes)
-- Purpose: Ingest external social DMs into E36, with grade-based triage
-- Dependencies: 002 (reuses webhook signature verification + queue),
--               existing e36 schema (Slack-modeled)
-- ============================================================================

BEGIN;

-- We extend the existing e36 schema rather than create a new one.
-- (If e36 schema doesn't exist, this migration creates it minimally;
--  Eddie's existing E36 implementation should already have it.)
CREATE SCHEMA IF NOT EXISTS e36;
COMMENT ON SCHEMA e36 IS
  'E36 Messaging Center — internal Slack-modeled messaging plus external social DMs (extension migration 003).';

-- ----------------------------------------------------------------------------
-- e36.message_sources — registered ingestion channels per silo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e36.message_sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    source_platform     VARCHAR(30) NOT NULL,
                         -- instagram | facebook | twitter_x | linkedin |
                         -- tiktok | threads | bluesky | whatsapp_business
    external_account_id VARCHAR(120) NOT NULL,
    display_handle      VARCHAR(120),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    oauth_token_vault_ref VARCHAR(255),    -- pointer to silo encrypted vault, NEVER stored here
    last_synced_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT msg_sources_unique UNIQUE (candidate_id, source_platform, external_account_id),
    CONSTRAINT msg_sources_platform_valid CHECK (source_platform IN (
        'instagram','facebook','twitter_x','linkedin','tiktok','threads','bluesky','whatsapp_business'
    ))
);

CREATE INDEX IF NOT EXISTS idx_msg_sources_active
    ON e36.message_sources(candidate_id, is_active) WHERE is_active;

-- ----------------------------------------------------------------------------
-- e36.external_messages — every inbound social DM, normalized
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e36.external_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    source_id           UUID NOT NULL REFERENCES e36.message_sources(id) ON DELETE CASCADE,

    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    external_message_id VARCHAR(160) NOT NULL,
    external_thread_id  VARCHAR(160),
    external_sender_id  VARCHAR(160),
    sender_handle       VARCHAR(120),
    sender_display_name VARCHAR(255),

    direction           VARCHAR(10) NOT NULL,    -- inbound | outbound
    message_text        TEXT,
    media_attachments   JSONB DEFAULT '[]'::jsonb,
    raw_payload         JSONB,                   -- vendor's raw event for debugging

    -- Identity (resolved by shared/identity_resolution)
    resolved_contact_id UUID,
    resolved_rncid      VARCHAR(40),
    resolved_grade      VARCHAR(8),
    resolved_at         TIMESTAMPTZ,

    -- Triage
    triage_priority     VARCHAR(20),
                         -- urgent | high | normal | low | auto_handled
    assigned_to_user_id UUID,
    assigned_at         TIMESTAMPTZ,
    handled_at          TIMESTAMPTZ,
    handled_by_user_id  UUID,
    auto_handled_response_id UUID,                -- if E09 auto-replied

    -- E61 hooks
    cost_event_id       UUID,
    benefit_event_id    UUID,

    CONSTRAINT ext_msg_unique UNIQUE (source_id, external_message_id),
    CONSTRAINT ext_msg_direction_valid CHECK (direction IN ('inbound','outbound')),
    CONSTRAINT ext_msg_priority_valid CHECK (triage_priority IS NULL OR
        triage_priority IN ('urgent','high','normal','low','auto_handled'))
);

CREATE INDEX IF NOT EXISTS idx_ext_msg_candidate_time
    ON e36.external_messages(candidate_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_msg_unhandled
    ON e36.external_messages(candidate_id, triage_priority)
    WHERE handled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ext_msg_thread
    ON e36.external_messages(external_thread_id, received_at DESC);

-- ----------------------------------------------------------------------------
-- e36.routing_rules — per-silo triage rules (programmable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e36.routing_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    rule_name           VARCHAR(120) NOT NULL,
    rule_priority       INT NOT NULL DEFAULT 100,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    -- Conditions
    grade_in            VARCHAR(8)[],           -- e.g. ['A++','A+']
    keywords_any        TEXT[],
    source_platforms    VARCHAR(30)[],
    hours_window        INT4RANGE,              -- minute-of-day range, e.g. [480, 1080) for 8am-6pm
    district_match_required BOOLEAN,

    -- Action
    action_type         VARCHAR(30) NOT NULL,
                         -- assign_user | assign_role | escalate_candidate |
                         -- auto_handle_e09 | route_press_e45 | route_volunteer_e38
    action_target       VARCHAR(120),           -- user_id, role name, or ecosystem ref
    triage_priority     VARCHAR(20) NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rr_action_valid CHECK (action_type IN
        ('assign_user','assign_role','escalate_candidate','auto_handle_e09',
         'route_press_e45','route_volunteer_e38','flag_only')),
    CONSTRAINT rr_priority_valid CHECK (triage_priority IN
        ('urgent','high','normal','low','auto_handled'))
);

CREATE INDEX IF NOT EXISTS idx_rr_candidate_active
    ON e36.routing_rules(candidate_id, rule_priority DESC) WHERE is_active;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE e36.message_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE e36.external_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE e36.routing_rules      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['message_sources','external_messages','routing_rules'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e36' AND tablename=t AND policyname='candidate_isolation') THEN
            EXECUTE format(
                'CREATE POLICY candidate_isolation ON e36.%I USING (candidate_id = current_setting(''app.current_candidate_id'', TRUE)::UUID)',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;
