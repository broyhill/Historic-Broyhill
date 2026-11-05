-- DRYRUN_BANT_PROSPECT_SCORE_2026-08-02.sql
-- BANT — Behavioral Adaptive Nurture Targeting (prospect scoring organ under E01)
-- Status: DRY-RUN ONLY — not applied. Additive DDL. No sacred-table writes.
-- Canary: cluster_id 372171 = 147 / $332,631.30 (verify before/after any apply)
-- Author: Cursor | 2026-08-02
-- Doctrine: scores feed Context Plane for E20/E59/E60; never fires guns; never bypasses ActionSocket.
-- Rollback: DROP SCHEMA bant CASCADE; (only if never applied with live dependents — Ed authorize)

BEGIN;

CREATE SCHEMA IF NOT EXISTS bant;

COMMENT ON SCHEMA bant IS
  'BANT prospect scoring — experimental organ under E01. Writes scores only; E20/ActionSocket own fire.';

-- ---------------------------------------------------------------------------
-- Model registry (versioned statistical / ML runs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bant.model_registry (
    model_id          TEXT PRIMARY KEY,
    model_name        TEXT NOT NULL DEFAULT 'BANT',
    model_version     TEXT NOT NULL,
    algorithm         TEXT NOT NULL DEFAULT 'weighted_logistic_v1',
    feature_set_id    TEXT NOT NULL,
    trained_at        TIMESTAMPTZ,
    metrics_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active         BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        TEXT NOT NULL DEFAULT 'cursor'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bant_model_active
    ON bant.model_registry (is_active)
    WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Feature dictionary (machine-readable; mirrors feature_dictionary.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bant.feature_dictionary (
    feature_id        TEXT PRIMARY KEY,
    family            TEXT NOT NULL,          -- donation | voter | acxiom | entity | heat | segment | fatigue
    source_schema     TEXT,
    source_table      TEXT,
    source_column     TEXT,
    description       TEXT NOT NULL,
    dtype             TEXT NOT NULL DEFAULT 'numeric',  -- numeric | flag | categorical
    transform         TEXT NOT NULL DEFAULT 'identity',
    weight_default    NUMERIC(8,4) NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Per-silo × donor feature snapshot (materialized inputs for a score run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bant.feature_snapshot (
    snapshot_id       BIGSERIAL PRIMARY KEY,
    silo_id           TEXT NOT NULL,          -- candidate / committee silo
    cluster_id        INTEGER NOT NULL,       -- canon: INTEGER
    model_id          TEXT NOT NULL REFERENCES bant.model_registry(model_id),
    features_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_hash       TEXT,                   -- sha256 of feature payload for idempotency
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (silo_id, cluster_id, model_id, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_bant_feat_snap_cluster
    ON bant.feature_snapshot (cluster_id);
CREATE INDEX IF NOT EXISTS idx_bant_feat_snap_silo
    ON bant.feature_snapshot (silo_id, computed_at DESC);

-- ---------------------------------------------------------------------------
-- Prospect scores (primary output consumed by E59 / E20 / Wizard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bant.prospect_score (
    score_id          BIGSERIAL PRIMARY KEY,
    silo_id           TEXT NOT NULL,
    cluster_id        INTEGER NOT NULL,
    model_id          TEXT NOT NULL REFERENCES bant.model_registry(model_id),
    snapshot_id       BIGINT REFERENCES bant.feature_snapshot(snapshot_id),
    -- Classic BANT dimensions remapped to political prospecting (0–100)
    budget_score      SMALLINT NOT NULL CHECK (budget_score BETWEEN 0 AND 100),
    authority_score   SMALLINT NOT NULL CHECK (authority_score BETWEEN 0 AND 100),
    need_score        SMALLINT NOT NULL CHECK (need_score BETWEEN 0 AND 100),
    timing_score      SMALLINT NOT NULL CHECK (timing_score BETWEEN 0 AND 100),
    -- Composite
    bant_composite    NUMERIC(6,3) NOT NULL CHECK (bant_composite BETWEEN 0 AND 100),
    p_act             NUMERIC(8,6) CHECK (p_act IS NULL OR (p_act >= 0 AND p_act <= 1)),
    expected_amount   NUMERIC(12,2),
    tier              TEXT NOT NULL DEFAULT 'unscored'
                      CHECK (tier IN ('A','B','C','D','U','unscored')),
    reason_vector     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- why-vector for munition/segment
    microsegment_hints TEXT[] NOT NULL DEFAULT '{}',
    jurisdiction_key  TEXT,                   -- office/district key
    opponent_safe     BOOLEAN NOT NULL DEFAULT TRUE,  -- false → E20 must suppress
    scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (silo_id, cluster_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_bant_score_silo_tier
    ON bant.prospect_score (silo_id, tier, bant_composite DESC);
CREATE INDEX IF NOT EXISTS idx_bant_score_cluster
    ON bant.prospect_score (cluster_id);
CREATE INDEX IF NOT EXISTS idx_bant_score_jurisdiction
    ON bant.prospect_score (jurisdiction_key, bant_composite DESC);

COMMENT ON TABLE bant.prospect_score IS
  'BANT outputs only. Consumers: E59 segments, E20 GO features, E68 Wizard display. Never a send list.';

-- ---------------------------------------------------------------------------
-- Score run ledger (batch / API audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bant.score_run (
    run_id            BIGSERIAL PRIMARY KEY,
    model_id          TEXT NOT NULL REFERENCES bant.model_registry(model_id),
    silo_id           TEXT,
    mode              TEXT NOT NULL DEFAULT 'batch'
                      CHECK (mode IN ('single','batch','backfill','observe')),
    row_count         INTEGER NOT NULL DEFAULT 0,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at       TIMESTAMPTZ,
    status            TEXT NOT NULL DEFAULT 'started'
                      CHECK (status IN ('started','succeeded','failed','cancelled')),
    error_text        TEXT,
    request_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    canary_open       TEXT,                   -- e.g. '147/332631.30'
    canary_close      TEXT,
    created_by        TEXT NOT NULL DEFAULT 'bant-service'
);

-- ---------------------------------------------------------------------------
-- View: E59 / Wizard-friendly export (no PII beyond cluster_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW bant.v_prospect_score_current AS
SELECT
    ps.silo_id,
    ps.cluster_id,
    ps.model_id,
    ps.budget_score,
    ps.authority_score,
    ps.need_score,
    ps.timing_score,
    ps.bant_composite,
    ps.p_act,
    ps.expected_amount,
    ps.tier,
    ps.reason_vector,
    ps.microsegment_hints,
    ps.jurisdiction_key,
    ps.opponent_safe,
    ps.scored_at,
    mr.model_version,
    mr.algorithm
FROM bant.prospect_score ps
JOIN bant.model_registry mr ON mr.model_id = ps.model_id
WHERE mr.is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Seed: inactive experimental model + core feature dictionary rows
-- ---------------------------------------------------------------------------
INSERT INTO bant.model_registry (model_id, model_name, model_version, algorithm, feature_set_id, is_active, notes)
VALUES (
    'bant_v0_experimental',
    'BANT',
    '0.1.0',
    'weighted_logistic_v1',
    'bant_features_v0',
    FALSE,
    'Experimental — activate only after Ed ruling + two-agent dry-run review'
)
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO bant.feature_dictionary (feature_id, family, source_schema, source_table, source_column, description, dtype, weight_default) VALUES
('F_DON_TOTAL_10Y',   'donation', 'spine',  'donor_transactions_deduped', 'norm_amount', '10y gift total (silo-aware rollup)', 'numeric', 0.18),
('F_DON_RECENCY_DAYS','donation', 'spine',  'donor_transactions_deduped', 'txn_date',    'Days since last gift', 'numeric', 0.12),
('F_DON_FREQUENCY',   'donation', 'spine',  'donor_transactions_deduped', 'txn_id',      'Gift count in window', 'numeric', 0.10),
('F_VOTE_PRIMARY_R',  'voter',    'core',   'datatrust_voter_nc',         NULL,          'R primary participation streak proxy', 'numeric', 0.10),
('F_VOTE_TURNOUT',    'voter',    'core',   'datatrust_voter_nc',         NULL,          'General turnout consistency proxy', 'numeric', 0.06),
('F_ACX_AFFLUENCE',   'acxiom',   'core',   'acxiom_ibe',                 NULL,          'Consumer affluence / capacity proxy', 'numeric', 0.08),
('F_ENTITY_PAC_INT',  'entity',   NULL,     NULL,                         NULL,          'PAC/527/501c3 aligned entity intensity', 'numeric', 0.08),
('F_HEAT_ISSUE',      'heat',     NULL,     NULL,                         NULL,          'News/legislation issue heat for silo', 'numeric', 0.10),
('F_SEG_ALIVE_HIT',   'segment',  'e59',    NULL,                         NULL,          'In an alive microsegment for jurisdiction', 'flag', 0.08),
('F_FATIGUE_HEADROOM','fatigue',  'brain',  'channel_fatigue_ledger',     NULL,          'Remaining multi-channel touch headroom', 'numeric', 0.10)
ON CONFLICT (feature_id) DO NOTHING;

-- Expected row delta on first apply (informational):
--   +1 schema, +5 tables, +1 view, +1 model row, +10 feature rows
-- Sacred canary MUST remain 147 / 332631.30 — this DDL touches no raw/core donor money tables.

-- ROLLBACK for dry-run inspection (uncomment to abort without commit):
-- ROLLBACK;

COMMIT;
