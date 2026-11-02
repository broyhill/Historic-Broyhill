-- =============================================================================
-- 311_e59_donor_segment_assignment.sql
-- E59 — Donor-to-Segment Assignment (Level 5: individual activation)
-- =============================================================================
-- DRY-RUN ONLY. Requires 305-310. Source: XYZ_MICROSEGMENT_ENGINE_SPEC + MSG-183
-- One row per (cluster_id, microsegment_key). The Level 5 node of the hierarchy.
-- Links donor's E13 tattoo domains to their microsegment match score.
-- This is what the Donor Search tab on each microsegment page queries.
-- cluster_id = INTEGER (canon 2026-06-15). FK to core.donor_profile.
-- NEVER writes to core.donor_profile — assignments stored here only.
-- =============================================================================
BEGIN;

DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL: % / % — ABORT', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS: % / $%', v_txns, v_total;
END $$;

CREATE TABLE IF NOT EXISTS e59.donor_segment_assignment (
    assignment_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id              INTEGER     NOT NULL
                                REFERENCES core.donor_profile(cluster_id),
    microsegment_key        TEXT        NOT NULL
                                REFERENCES e59.microsegment_page_config(microsegment_key),

    -- Match score (1-100) — degree of this donor's affinity to this segment
    -- Combines: SIC/occupation match + E13 domain scores + behavioral history
    segment_match_score     INTEGER     NOT NULL CHECK (segment_match_score BETWEEN 1 AND 100),

    -- Score components (transparency for Donor Search tab display)
    occupation_match        INTEGER     CHECK (occupation_match BETWEEN 1 AND 100),
    employer_sic_match      INTEGER     CHECK (employer_sic_match BETWEEN 1 AND 100),
    behavioral_match        INTEGER     CHECK (behavioral_match BETWEEN 1 AND 100),
    faction_match           INTEGER     CHECK (faction_match BETWEEN 1 AND 100),
    geographic_match        INTEGER     CHECK (geographic_match BETWEEN 1 AND 100),
    tribal_match            INTEGER     CHECK (tribal_match BETWEEN 1 AND 100),

    -- Donor campaign context (per candidate)
    candidate_id            UUID        REFERENCES core.candidates(candidate_id),
    remaining_headroom      DECIMAL(14,2),  -- NC $6,800/election — READ from E13
    predicted_gift          DECIMAL(10,2),  -- E13 Gamma-Gamma expected gift
    predicted_net_value     DECIMAL(10,2),  -- predicted_gift - activation_cost

    -- Donor flags visible on Donor Search tab
    is_defector             BOOLEAN     DEFAULT FALSE,  -- also gives to opponent
    is_dormant_high_value   BOOLEAN     DEFAULT FALSE,  -- capacity > $5K, score < 20 intensity
    has_volunteer_capacity  BOOLEAN     DEFAULT FALSE,  -- also a volunteer prospect
    do_not_contact          BOOLEAN     DEFAULT FALSE,  -- suppress from Wizard

    -- Source of assignment
    assignment_method       TEXT        CHECK (assignment_method IN (
                                'sic_employer',     -- from employer_sic_master
                                'e13_domain',       -- from E13 tattoo domain score
                                'ml_fingerprint',   -- from ml.donor_fingerprint columns
                                'manual',           -- staff override
                                'datatrust'         -- DataTrust occupation field
                            )),
    assignment_confidence   DECIMAL(5,3),   -- 0.0-1.0

    -- Timestamps
    assigned_at             TIMESTAMPTZ DEFAULT NOW(),
    last_scored_at          TIMESTAMPTZ DEFAULT NOW(),
    score_version           TEXT        DEFAULT '1.0',

    CONSTRAINT e59_dsa_unique UNIQUE (cluster_id, microsegment_key, candidate_id)
);

-- Donor Search tab query (microsegment page → top donors ranked by match × headroom)
CREATE INDEX IF NOT EXISTS e59_dsa_segment_score
    ON e59.donor_segment_assignment (microsegment_key, segment_match_score DESC)
    WHERE do_not_contact = FALSE;

CREATE INDEX IF NOT EXISTS e59_dsa_candidate_segment
    ON e59.donor_segment_assignment (candidate_id, microsegment_key, predicted_net_value DESC NULLS LAST)
    WHERE do_not_contact = FALSE AND candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS e59_dsa_cluster
    ON e59.donor_segment_assignment (cluster_id);

CREATE INDEX IF NOT EXISTS e59_dsa_dormant_high_value
    ON e59.donor_segment_assignment (microsegment_key, predicted_net_value DESC NULLS LAST)
    WHERE is_dormant_high_value = TRUE AND do_not_contact = FALSE;

CREATE INDEX IF NOT EXISTS e59_dsa_defectors
    ON e59.donor_segment_assignment (microsegment_key, candidate_id)
    WHERE is_defector = TRUE;

COMMENT ON TABLE e59.donor_segment_assignment IS
    'Level 5 of the E59 hierarchy — individual donor activation. '
    'One row per (cluster_id, microsegment_key, candidate_id). '
    'cluster_id = INTEGER per canon ruling 2026-06-15. '
    'segment_match_score drives the Donor Search tab ranking (Tab 2 in MSG-183). '
    'is_dormant_high_value = TRUE shows in "Dormant High-Potential" section '
    '(capacity > $5K, intensity < 20 — CULTIVATE_NOW quadrant). '
    'is_defector = TRUE = also gives to opponent (from race.shared_donor). '
    'NEVER duplicates or modifies core.donor_profile — this table only.';

DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL after apply: % / % — ROLLBACK', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Post-apply canary PASS: % / $%', v_txns, v_total;
END $$;

COMMIT;
