-- ============================================================================
-- Migration 004 — E72 Campaign Investment Engine
-- Former name: E61 Cost / Benefit / Variance / ML Brain Control Integration
-- ============================================================================
-- Status: HELD / DRY-RUN (do not execute until namespace cleanup + Eddie authorizes)
-- WARNING: This rescued migration still creates schema e61 because it was copied
-- from the old E61_cost_benefit_variance package. E61 now belongs to Source
-- Ingestion & Identity Resolution (SIIRE). Do not apply this file to Hetzner
-- until schema/table ownership is renamed or explicitly bridged for E72.
-- Purpose: Platform-wide action-level cost capture, benefit attribution,
--          variance tracking, Bayesian action selection, brain signaling,
--          automation throttling.
-- Dependencies: NONE (this is the keystone — it must ship first or in parallel)
-- Reversible: YES (drop schema cascade)
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS e61;
COMMENT ON SCHEMA e61 IS
  'E61 Cost/Benefit/Variance ML Brain Control — every action emits cost, every outcome attributes benefit, variance trains action selection.';

-- ----------------------------------------------------------------------------
-- e61.cost_rate_card — version-controlled per-vendor unit costs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.cost_rate_card (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecosystem_code      VARCHAR(10) NOT NULL,    -- E19_social, E36, E33, E47, etc.
    action_type         VARCHAR(60) NOT NULL,    -- send_dm_meta | send_sms_twilio | rvm_drop_cowboy | print_lob | ...
    vendor              VARCHAR(60),
    fixed_cost_cents    INT NOT NULL DEFAULT 0,
    variable_unit       VARCHAR(40),             -- 'message' | 'recipient' | 'page' | 'minute'
    variable_cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
    effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT crc_unique_active UNIQUE (ecosystem_code, action_type, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_crc_lookup
    ON e61.cost_rate_card(ecosystem_code, action_type, effective_from DESC)
    WHERE effective_to IS NULL;

-- Seed canonical actions (extensible)
INSERT INTO e61.cost_rate_card (ecosystem_code, action_type, vendor, fixed_cost_cents, variable_unit, variable_cost_cents, notes)
VALUES
    ('E19_social','send_dm_instagram','meta',     0, 'message',  0.10, 'IG DM via Graph API; effectively free at low volume, monitor for volume tier costs'),
    ('E19_social','send_dm_facebook','meta',      0, 'message',  0.10, 'FB Messenger via Graph API'),
    ('E19_social','render_bio_page','self',       0, 'pageview', 0.005, 'Hetzner serving cost amortized'),
    ('E33','direct_mail_lob','lob',          0, 'piece',   42.00, 'Lob 6x9 postcard, 4-color, full bleed'),
    ('E31','send_sms_twilio','twilio',       0, 'message',  1.50, 'Twilio US SMS'),
    ('E47','rvm_drop_cowboy','drop_cowboy',  0, 'drop',     0.40, 'Drop Cowboy ringless voicemail'),
    ('E32','call_five9','five9',             0, 'minute',  12.00, 'Five9 call center per agent-minute'),
    ('E30','email_iterable','iterable',      0, 'message',  0.30, 'Iterable email send'),
    ('E09','ai_claude_haiku','anthropic',    0, 'ktok_in',   0.10, 'Claude haiku input per 1K tokens (cents — refresh quarterly)'),
    ('E09','ai_claude_haiku_out','anthropic',0, 'ktok_out',  0.50, 'Claude haiku output per 1K tokens'),
    ('E09','ai_claude_sonnet','anthropic',   0, 'ktok_in',   0.30, 'Claude sonnet input per 1K tokens'),
    ('E09','ai_claude_sonnet_out','anthropic',0,'ktok_out',  1.50, 'Claude sonnet output per 1K tokens'),
    ('E09','ai_claude_opus','anthropic',     0, 'ktok_in',   1.50, 'Claude opus input per 1K tokens'),
    ('E09','ai_claude_opus_out','anthropic', 0, 'ktok_out',  7.50, 'Claude opus output per 1K tokens')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- e61.action_costs — every action emitted by any ecosystem
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.action_costs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    ecosystem_code      VARCHAR(10) NOT NULL,
    action_type         VARCHAR(60) NOT NULL,
    emitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cost breakdown
    fixed_cost_cents    INT NOT NULL DEFAULT 0,
    variable_units      NUMERIC(12,4) NOT NULL DEFAULT 0,
    variable_cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_cost_cents    NUMERIC(12,4) GENERATED ALWAYS AS (fixed_cost_cents + variable_cost_cents) STORED,

    -- AI-specific cost detail
    ai_model            VARCHAR(60),
    ai_input_tokens     INT,
    ai_output_tokens    INT,
    ai_cost_cents       NUMERIC(12,4),

    -- Source linkage (which ecosystem object triggered this cost)
    source_table        VARCHAR(80),    -- e.g. 'e19_dm.dm_dispatched'
    source_id           UUID,           -- the row in source_table

    -- Segmentation
    segment_grade       VARCHAR(8),
    segment_district_match BOOLEAN,
    segment_keyword     VARCHAR(120),
    segment_extra       JSONB DEFAULT '{}'::jsonb,

    -- Idempotency
    idempotency_key     VARCHAR(160),

    CONSTRAINT action_costs_idem_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_action_costs_candidate_time
    ON e61.action_costs(candidate_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_costs_segment
    ON e61.action_costs(action_type, segment_grade, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_costs_source
    ON e61.action_costs(source_table, source_id);

-- ----------------------------------------------------------------------------
-- e61.action_benefits — observed outcomes (donations, volunteer signups, RSVPs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.action_benefits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    benefit_type        VARCHAR(40) NOT NULL,    -- donation | volunteer_signup | rsvp | sign_request | yard_sign_placed | followup_scheduled
    observed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Dollar value (universal currency)
    value_cents         INT NOT NULL,
                                                  -- donations: actual amount
                                                  -- volunteer hour: imputed at $25/hr
                                                  -- RSVP: imputed value config'd per silo

    -- Source
    source_table        VARCHAR(80),    -- core.contribution_map | e38.volunteer_signups | e34.rsvps
    source_id           UUID,
    contact_id          UUID,
    rncid               VARCHAR(40),

    -- Imputation flag
    is_imputed          BOOLEAN NOT NULL DEFAULT FALSE,
    imputation_method   VARCHAR(60),    -- 'flat_rate_per_volunteer_hour' | 'configurable_rsvp_value' | etc.

    -- Idempotency
    idempotency_key     VARCHAR(160),

    CONSTRAINT action_benefits_idem_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_action_benefits_candidate_time
    ON e61.action_benefits(candidate_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_benefits_source
    ON e61.action_benefits(source_table, source_id);

-- ----------------------------------------------------------------------------
-- e61.attribution_chains — links benefits back to upstream actions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.attribution_chains (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    benefit_id          UUID NOT NULL REFERENCES e61.action_benefits(id) ON DELETE CASCADE,
    cost_id             UUID NOT NULL REFERENCES e61.action_costs(id) ON DELETE CASCADE,
    attribution_model   VARCHAR(20) NOT NULL,    -- last_touch | linear | time_decay | markov
    attribution_weight  NUMERIC(6,5) NOT NULL,   -- 0.00000 to 1.00000, sums to 1.0 across chain
    attributed_value_cents NUMERIC(12,4) NOT NULL,
    lookback_days       INT NOT NULL,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chain_weight_valid CHECK (attribution_weight BETWEEN 0 AND 1),
    CONSTRAINT chain_model_valid CHECK (attribution_model IN
        ('last_touch','linear','time_decay','markov'))
);

CREATE INDEX IF NOT EXISTS idx_chains_benefit ON e61.attribution_chains(benefit_id);
CREATE INDEX IF NOT EXISTS idx_chains_cost    ON e61.attribution_chains(cost_id);
CREATE INDEX IF NOT EXISTS idx_chains_candidate ON e61.attribution_chains(candidate_id, computed_at DESC);

-- ----------------------------------------------------------------------------
-- e61.variance_state — Welford online statistics (hot-path, UPSERT semantics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.variance_state (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope               VARCHAR(20) NOT NULL,    -- network | candidate
    candidate_id        UUID,                    -- null when scope='network'
    action_type         VARCHAR(60) NOT NULL,
    segment_key         VARCHAR(255) NOT NULL,   -- canonical hash of segment dimensions
    segment_dims        JSONB NOT NULL,          -- e.g. {"grade":"B+","district_match":true,"keyword":"yard_sign"}

    -- Welford state
    n                   BIGINT NOT NULL DEFAULT 0,
    mean_roi            NUMERIC(14,6) NOT NULL DEFAULT 0,
    m2                  NUMERIC(20,6) NOT NULL DEFAULT 0,    -- sum of squared deviations

    -- Discount-weighted state (for non-stationarity)
    weighted_n          NUMERIC(14,4) NOT NULL DEFAULT 0,
    weighted_mean_roi   NUMERIC(14,6) NOT NULL DEFAULT 0,
    weighted_m2         NUMERIC(20,6) NOT NULL DEFAULT 0,

    last_observation_at TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT variance_state_unique UNIQUE (scope, candidate_id, action_type, segment_key),
    CONSTRAINT variance_state_scope_valid CHECK (scope IN ('network','candidate')),
    CONSTRAINT variance_state_candidate_consistent CHECK (
        (scope='network' AND candidate_id IS NULL) OR
        (scope='candidate' AND candidate_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_variance_lookup
    ON e61.variance_state(scope, candidate_id, action_type, segment_key);

-- ----------------------------------------------------------------------------
-- e61.variance_snapshots — hourly read-optimized snapshots for brain/dashboard
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.variance_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID,
    snapshot_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type         VARCHAR(60) NOT NULL,
    segment_key         VARCHAR(255) NOT NULL,
    segment_dims        JSONB NOT NULL,

    n                   BIGINT NOT NULL,
    mean_roi            NUMERIC(14,6) NOT NULL,
    stddev_roi          NUMERIC(14,6),
    ci_95_lower         NUMERIC(14,6),
    ci_95_upper         NUMERIC(14,6),
    confidence_tier     VARCHAR(20),   -- low | medium | high | very_high based on n and CI width

    CONSTRAINT vs_tier_valid CHECK (confidence_tier IN ('low','medium','high','very_high'))
);

CREATE INDEX IF NOT EXISTS idx_vs_candidate_time
    ON e61.variance_snapshots(candidate_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_vs_action_segment
    ON e61.variance_snapshots(action_type, segment_key, snapshot_at DESC);

-- ----------------------------------------------------------------------------
-- e61.brain_signals — emitted to E20 Central Brain
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.brain_signals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    emitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signal_type         VARCHAR(40) NOT NULL,
                                          -- action_recommendation | throttle_recommendation |
                                          -- variance_alert | budget_reallocation | pause_channel
    payload             JSONB NOT NULL,
    consumed_at         TIMESTAMPTZ,
    consumed_by         VARCHAR(40),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_brain_signals_unconsumed
    ON e61.brain_signals(candidate_id, emitted_at DESC) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brain_signals_expiry
    ON e61.brain_signals(expires_at) WHERE consumed_at IS NULL;

-- ----------------------------------------------------------------------------
-- e61.automation_throttles — read by E40 Automation Control
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.automation_throttles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    ecosystem_code      VARCHAR(10) NOT NULL,
    action_type         VARCHAR(60) NOT NULL,
    throttle_state      VARCHAR(20) NOT NULL,    -- full | reduce | pause | expand
    daily_ceiling_usd_cents INT,
    rationale           TEXT,
    set_by              VARCHAR(40),             -- 'e61_auto' | 'staff_override' | 'candidate_override'
    set_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,

    CONSTRAINT throttle_unique UNIQUE (candidate_id, ecosystem_code, action_type),
    CONSTRAINT throttle_state_valid CHECK (throttle_state IN ('full','reduce','pause','expand'))
);

CREATE INDEX IF NOT EXISTS idx_throttles_candidate
    ON e61.automation_throttles(candidate_id, ecosystem_code);

-- ----------------------------------------------------------------------------
-- e61.bayesian_priors — hierarchical priors per action type
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.bayesian_priors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type         VARCHAR(60) NOT NULL,
    segment_key         VARCHAR(255) NOT NULL,
    segment_dims        JSONB NOT NULL,

    -- Network-aggregate prior (shared across all candidates)
    prior_mu            NUMERIC(14,6) NOT NULL,
    prior_sigma_sq      NUMERIC(14,6) NOT NULL,
    prior_n             BIGINT NOT NULL,

    -- Observation noise estimate (sigma_obs^2 in the Normal-Normal model)
    obs_sigma_sq        NUMERIC(14,6) NOT NULL,

    last_recomputed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT priors_unique UNIQUE (action_type, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_priors_lookup ON e61.bayesian_priors(action_type, segment_key);

-- ----------------------------------------------------------------------------
-- e61.action_selections — log of Thompson sampling decisions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.action_selections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    selected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_actions   JSONB NOT NULL,    -- list of action_type + sampled_value
    selected_action     VARCHAR(60) NOT NULL,
    selected_segment    JSONB NOT NULL,
    sampled_value       NUMERIC(14,6) NOT NULL,
    posterior_mu        NUMERIC(14,6) NOT NULL,
    posterior_sigma_sq  NUMERIC(14,6) NOT NULL,
    selection_strategy  VARCHAR(40) NOT NULL DEFAULT 'thompson_sampling'
);

CREATE INDEX IF NOT EXISTS idx_action_sel_candidate_time
    ON e61.action_selections(candidate_id, selected_at DESC);

-- ----------------------------------------------------------------------------
-- e61.budget_allocations — per-day, per-candidate channel budget split
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS e61.budget_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    allocation_date     DATE NOT NULL,
    total_budget_cents  INT NOT NULL,
    minimum_acceptable_roi NUMERIC(8,4) NOT NULL DEFAULT 1.5,
    allocations         JSONB NOT NULL,    -- {"E19_social":{"send_dm_instagram": {"units":2400, "cost_cents":24000}}, ...}
    expected_donations_cents INT,
    expected_roi        NUMERIC(8,4),
    solver_used         VARCHAR(20),       -- 'mip' | 'greedy_fallback'
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT budget_alloc_unique UNIQUE (candidate_id, allocation_date)
);

CREATE INDEX IF NOT EXISTS idx_budget_alloc_candidate_date
    ON e61.budget_allocations(candidate_id, allocation_date DESC);

-- ----------------------------------------------------------------------------
-- RLS — note: cost_rate_card and bayesian_priors are SHARED (no candidate_id)
-- ----------------------------------------------------------------------------
ALTER TABLE e61.action_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.action_benefits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.attribution_chains  ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.variance_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.brain_signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.automation_throttles ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.action_selections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE e61.budget_allocations  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['action_costs','action_benefits','attribution_chains',
                              'variance_snapshots','brain_signals','automation_throttles',
                              'action_selections','budget_allocations']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e61' AND tablename=t AND policyname='candidate_isolation') THEN
            EXECUTE format(
                'CREATE POLICY candidate_isolation ON e61.%I USING (candidate_id IS NULL OR candidate_id = current_setting(''app.current_candidate_id'', TRUE)::UUID)',
                t
            );
        END IF;
    END LOOP;
END $$;

-- variance_state has special policy: network-scope rows readable by all, candidate-scope isolated
ALTER TABLE e61.variance_state ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='e61' AND tablename='variance_state' AND policyname='network_or_candidate') THEN
        CREATE POLICY network_or_candidate ON e61.variance_state
            USING (
                scope = 'network'
                OR candidate_id = current_setting('app.current_candidate_id', TRUE)::UUID
            );
    END IF;
END $$;

COMMIT;
