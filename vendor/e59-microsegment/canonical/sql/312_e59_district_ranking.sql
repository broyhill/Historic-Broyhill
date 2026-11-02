-- =============================================================================
-- 312_e59_district_ranking.sql
-- E59 — District Microsegment Ranking
-- =============================================================================
-- DRY-RUN ONLY. Requires 305-311, E77 302.
-- Source: DISTRICT_MICROSEGMENT_RANKING.md (March 31, 2026 canonical)
-- One row per (district_id, microsegment_key). Ranks microsegments within each
-- district using DOMINANCE_SCORE formula: 40% voter share + 35% donor share +
-- 15% volunteer share + 10% turnout. Drives which segments show first per office.
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

CREATE TABLE IF NOT EXISTS e59.district_microsegment_ranking (
    ranking_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id             TEXT        NOT NULL,   -- FK to e77.district_tattoo (after E77 applies)
    microsegment_key        TEXT        NOT NULL
                                REFERENCES e59.microsegment_page_config(microsegment_key),

    -- DOMINANCE_SCORE formula (from DISTRICT_MICROSEGMENT_RANKING.md)
    -- DOMINANCE_SCORE = (voter_share_pct × 0.40)
    --                 + (donor_share_pct × 0.35)
    --                 + (volunteer_share_pct × 0.15)
    --                 + (turnout_rate × 0.10)
    dominance_score         DECIMAL(5,2) NOT NULL CHECK (dominance_score BETWEEN 0 AND 100),
    district_rank           INTEGER,    -- rank 1 = most dominant segment in this district

    -- Component inputs
    voter_share_pct         DECIMAL(5,2),   -- % of R+UNA voters in this district in this segment
    donor_share_pct         DECIMAL(5,2),   -- % of known donors in this district in this segment
    volunteer_share_pct     DECIMAL(5,2),   -- % of volunteer prospects in this district
    turnout_rate            DECIMAL(5,2),   -- historical turnout rate for this segment in district

    -- Absolute counts
    voters_in_segment       INTEGER,
    donors_in_segment       INTEGER,
    volunteers_in_segment   INTEGER,
    total_giving_cents      BIGINT,     -- total historical giving in this district × segment

    -- Computed value opportunity
    estimated_cycle_value   DECIMAL(14,2),  -- LP ceiling for this district × segment pair
    avg_gift_size           DECIMAL(10,2),
    donor_density           DECIMAL(5,2),   -- donors per 1,000 R+UNA voters

    -- Context
    office_class            TEXT        REFERENCES race_relational.office_class_taxonomy(office_class),
    is_shown_local          BOOLEAN     DEFAULT TRUE,   -- shown on local/county heat maps
    is_shown_state          BOOLEAN     DEFAULT TRUE,   -- shown on state heat maps

    -- Freshness
    computed_at             TIMESTAMPTZ DEFAULT NOW(),
    data_vintage            TEXT,       -- e.g. '2024_cycle'

    CONSTRAINT e59_dmr_unique UNIQUE (district_id, microsegment_key)
);

CREATE INDEX IF NOT EXISTS e59_dmr_district_rank
    ON e59.district_microsegment_ranking (district_id, district_rank NULLS LAST);
CREATE INDEX IF NOT EXISTS e59_dmr_district_value
    ON e59.district_microsegment_ranking (district_id, estimated_cycle_value DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS e59_dmr_dominance
    ON e59.district_microsegment_ranking (microsegment_key, dominance_score DESC);
CREATE INDEX IF NOT EXISTS e59_dmr_office_class
    ON e59.district_microsegment_ranking (office_class, dominance_score DESC NULLS LAST)
    WHERE office_class IS NOT NULL;

-- Function to recompute dominance scores after data refresh
CREATE OR REPLACE FUNCTION e59.recompute_district_rankings(p_district_id TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_updated INTEGER := 0;
BEGIN
    UPDATE e59.district_microsegment_ranking r
    SET dominance_score = ROUND(
            COALESCE(voter_share_pct, 0)     * 0.40 +
            COALESCE(donor_share_pct, 0)     * 0.35 +
            COALESCE(volunteer_share_pct, 0) * 0.15 +
            COALESCE(turnout_rate, 0)        * 0.10
        , 2),
        computed_at = NOW()
    WHERE (p_district_id IS NULL OR r.district_id = p_district_id);
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Re-rank within each district
    UPDATE e59.district_microsegment_ranking r
    SET district_rank = ranked.rnk
    FROM (
        SELECT ranking_id,
               ROW_NUMBER() OVER (PARTITION BY district_id ORDER BY dominance_score DESC) AS rnk
        FROM e59.district_microsegment_ranking
        WHERE (p_district_id IS NULL OR district_id = p_district_id)
    ) ranked
    WHERE r.ranking_id = ranked.ranking_id;

    RETURN v_updated;
END;
$$;

COMMENT ON TABLE e59.district_microsegment_ranking IS
    'Per-district segment ranking using DOMINANCE_SCORE = '
    '40% voter share + 35% donor share + 15% volunteer share + 10% turnout. '
    'Drives which microsegments appear first on the heat map for each race. '
    'district_id FK to e77.district_tattoo (wired after E77 applies). '
    'office_class FK to race_relational.office_class_taxonomy. '
    'Refreshed by e59.recompute_district_rankings() after each data cycle.';

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
