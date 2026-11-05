-- ============================================================================
-- Migration 005 — E19 Social Funnel Conversational Funnel Builder
-- ============================================================================
-- Status: DRY-RUN (do not execute until Eddie authorizes)
-- Purpose: No-code campaign-grade chatbot flow builder
-- Dependencies: 002 (E19 Social DM must be live with 90+ days of data),
--               Meta Advanced Access approved,
--               E48 conversational extension live (separate deliverable)
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS e19_social;
COMMENT ON SCHEMA e19_funnel IS
  'E19 Social Funnel Conversational Funnel Builder — no-code campaign-grade chatbot flows.';

-- ----------------------------------------------------------------------------
-- e19_funnel.flows — top-level flow definitions per silo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_funnel.flows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    flow_name       VARCHAR(120) NOT NULL,
    flow_purpose    VARCHAR(60),    -- donate | volunteer | rsvp | issue_response | sign_request | general
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    current_version_id UUID,         -- points to e19_funnel.flow_versions
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT flows_name_unique UNIQUE (candidate_id, flow_name)
);

CREATE INDEX IF NOT EXISTS idx_flows_active
    ON e19_funnel.flows(candidate_id) WHERE is_active;

-- ----------------------------------------------------------------------------
-- e19_funnel.flow_versions — versioned flow graph blob (for in-flight stability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_funnel.flow_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id         UUID NOT NULL REFERENCES e19_funnel.flows(id) ON DELETE CASCADE,
    candidate_id    UUID NOT NULL,
    version_number  INT NOT NULL,
    flow_graph      JSONB NOT NULL,    -- nodes + edges + block configs
    published_at    TIMESTAMPTZ,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT flow_version_unique UNIQUE (flow_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_flow_versions_flow ON e19_funnel.flow_versions(flow_id, version_number DESC);

-- ----------------------------------------------------------------------------
-- e19_funnel.flow_block_library — pre-built block templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_funnel.flow_block_library (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_code      VARCHAR(60) NOT NULL UNIQUE,
                     -- intent_detect | identity_branch | issue_response | donate_flow |
                     -- volunteer_flow | event_rsvp | handoff_human | compliance_gate
    block_name      VARCHAR(120) NOT NULL,
    block_category  VARCHAR(40),
    config_schema   JSONB NOT NULL,    -- JSON Schema for the block's config
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO e19_funnel.flow_block_library (block_code, block_name, block_category, config_schema, description) VALUES
    ('intent_detect', 'Intent Detection', 'logic',
     '{"type":"object","properties":{"intents":{"type":"array","items":{"type":"string"}}}}',
     'Classifies inbound message into one of declared intents using keyword + LLM hybrid'),
    ('identity_branch', 'Identity Branch', 'logic',
     '{"type":"object","properties":{"branches":{"type":"array"}}}',
     'Routes based on resolver result: known_a_plus | known_b | voter_match | unknown | out_of_district'),
    ('issue_response', 'Issue Response', 'message',
     '{"type":"object","properties":{"issue_topic":{"type":"string"}}}',
     'Pulls candidates position from 500-question profile, voiced via E48'),
    ('donate_flow', 'Donate Flow', 'message',
     '{"type":"object","properties":{"ask_amount":{"type":"integer"},"attribution_code":{"type":"string"}}}',
     'Generates WinRed/Anedot link with attribution; FEC disclaimer auto-stamped'),
    ('volunteer_flow', 'Volunteer Flow', 'message',
     '{"type":"object","properties":{"capture_fields":{"type":"array"}}}',
     'Captures availability + geo, writes to E38 Field Ops'),
    ('event_rsvp', 'Event RSVP', 'message',
     '{"type":"object","properties":{"event_id":{"type":"string"}}}',
     'Pulls live event from E34/E37, captures RSVP, sends confirmation'),
    ('handoff_human', 'Handoff to Human', 'control',
     '{"type":"object","properties":{"target_role":{"type":"string"}}}',
     'Escalates to candidate/staff via E36 with full conversation context'),
    ('compliance_gate', 'Compliance Gate', 'control',
     '{"type":"object","properties":{"gate_type":{"enum":["tcpa","fec_disclaimer","stop_keyword"]}}}',
     'Blocks downstream emit until compliance condition satisfied')
ON CONFLICT (block_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- e19_funnel.flow_executions — per-conversation runtime state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_funnel.flow_executions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    flow_version_id     UUID NOT NULL REFERENCES e19_funnel.flow_versions(id),
    external_thread_id  VARCHAR(160),
    contact_id          UUID,
    rncid               VARCHAR(40),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_step_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_node_id     VARCHAR(80),
    completed_at        TIMESTAMPTZ,
    completion_outcome  VARCHAR(40),
                         -- donated | volunteered | rsvped | abandoned | escalated_human | error
    state_blob          JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT fe_outcome_valid CHECK (completion_outcome IS NULL OR completion_outcome IN
        ('donated','volunteered','rsvped','abandoned','escalated_human','error','sign_requested'))
);

CREATE INDEX IF NOT EXISTS idx_fe_active
    ON e19_funnel.flow_executions(candidate_id, last_step_at DESC) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fe_outcome
    ON e19_funnel.flow_executions(candidate_id, completion_outcome, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fe_thread
    ON e19_funnel.flow_executions(external_thread_id) WHERE external_thread_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- e19_funnel.flow_branches_taken — analytics: which paths people walk
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e19_funnel.flow_branches_taken (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id        UUID NOT NULL REFERENCES e19_funnel.flow_executions(id) ON DELETE CASCADE,
    candidate_id        UUID NOT NULL,
    from_node_id        VARCHAR(80) NOT NULL,
    to_node_id          VARCHAR(80) NOT NULL,
    branch_label        VARCHAR(80),
    taken_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision_payload    JSONB
);

CREATE INDEX IF NOT EXISTS idx_branches_execution ON e19_funnel.flow_branches_taken(execution_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_branches_candidate_path
    ON e19_funnel.flow_branches_taken(candidate_id, from_node_id, to_node_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE e19_funnel.flows                ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_funnel.flow_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_funnel.flow_executions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE e19_funnel.flow_branches_taken  ENABLE ROW LEVEL SECURITY;
-- flow_block_library is shared (no candidate_id, no RLS)

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['flows','flow_versions','flow_executions','flow_branches_taken'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e19_funnel' AND tablename=t AND policyname='candidate_isolation') THEN
            EXECUTE format(
                'CREATE POLICY candidate_isolation ON e19_funnel.%I USING (candidate_id = current_setting(''app.current_candidate_id'', TRUE)::UUID)',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;
