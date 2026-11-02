-- =============================================================================
-- 308_e59_microsegment_hierarchy.sql
-- E59 — 5-Level Microsegment Hierarchy Tree
-- =============================================================================
-- DRY-RUN ONLY. Codex applies after Ed `Authorized`. Requires 307 first
-- (FK to e42.dynamic_issue_events). Requires 305-306.
-- Source: MSG-182 (Nexus E51, 2026-06-16)
-- 5-level tree: Master segment → Issue sub-segment → Community →
--               Neighborhood/precinct → Individual donor activation
-- Materialized path pattern for fast tree traversal.
-- cluster_id = INTEGER (canon 2026-06-15).
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

CREATE TABLE IF NOT EXISTS e59.microsegment_hierarchy (
    node_id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_node_id          UUID        REFERENCES e59.microsegment_hierarchy(node_id),

    -- Tree position
    level                   INTEGER     NOT NULL CHECK (level BETWEEN 1 AND 5),
    -- Level 1: Master microsegment (heat map front page — top 50/100)
    -- Level 2: Issue sub-segments (district-wide)
    -- Level 3: Community sub-segments (county/municipality)
    -- Level 4: Neighborhood/precinct sub-segments
    -- Level 5: Individual donor activation (the search result)
    path                    TEXT        NOT NULL,   -- materialized path '1.3.2.4'
    sort_path               TEXT,                   -- zero-padded for sorting

    -- Identity
    microsegment_key        TEXT        NOT NULL,   -- links to e59.microsegment_page_config
    display_name            TEXT        NOT NULL,

    -- Geography
    geo_scope               TEXT        NOT NULL CHECK (geo_scope IN (
                                'statewide','congressional_district',
                                'state_senate','state_house',
                                'county','municipality','precinct','neighborhood'
                            )),
    geo_id                  TEXT,       -- district_id, county FIPS, precinct code
    office_class            TEXT        REFERENCES race_relational.office_class_taxonomy(office_class),
    min_office_display      TEXT        CHECK (min_office_display IN ('local','state','federal','all'))
                                        DEFAULT 'all',

    -- Heat (updated by E42 event processor)
    heat_score              DECIMAL(4,1) CHECK (heat_score BETWEEN 0 AND 10),
    intensity_tier          TEXT        CHECK (intensity_tier IN ('HOT','WARM','COOL','DORMANT')),
    heat_updated_at         TIMESTAMPTZ,

    -- Money (the ranking metric per Ed)
    predicted_net_revenue   DECIMAL(14,2),
    donor_count_activated   INTEGER     DEFAULT 0,
    total_headroom          DECIMAL(14,2),

    -- 2×2 quadrant
    quadrant                TEXT        CHECK (quadrant IN (
                                'STRIKE_NOW','CULTIVATE_NOW','INFORM_ONLY','MONITOR_BENCH'
                            )),

    -- Tree metadata
    is_expandable           BOOLEAN     DEFAULT TRUE,
    child_count             INTEGER     DEFAULT 0,
    max_depth               INTEGER     DEFAULT 5,

    -- Display rules (Ed's minimum thresholds)
    show_in_local_heatmap   BOOLEAN     DEFAULT TRUE,   -- 50 minimum for local/county
    show_in_state_heatmap   BOOLEAN     DEFAULT TRUE,   -- 100 minimum for state/federal
    show_in_federal_heatmap BOOLEAN     DEFAULT TRUE,

    -- Dynamic creation from E42 news events
    auto_created            BOOLEAN     DEFAULT FALSE,
    trigger_event_id        UUID        REFERENCES e42.dynamic_issue_events(event_id),
    trigger_headline        TEXT,       -- the news headline that created this node

    -- Endurance (mirrors e59.microsegment_intensity_log endurance_type)
    endurance_type          TEXT        CHECK (endurance_type IN (
                                'permanent','seasonal','legislative',
                                'news_flash','election_countdown','auto_dynamic'
                            )),
    estimated_cool_date     DATE,
    decay_rate              DECIMAL(5,4) DEFAULT 0.0500,

    -- Issue tag linkage (connects to issues.canonical and E42)
    issue_tags              TEXT[],         -- issues.canonical issue_code values
    parent_issue_tags       TEXT[],         -- inherited from parent node

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Fast tree traversal
CREATE INDEX IF NOT EXISTS e59_mh_parent
    ON e59.microsegment_hierarchy(parent_node_id)
    WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS e59_mh_level_revenue
    ON e59.microsegment_hierarchy(level, predicted_net_revenue DESC NULLS LAST)
    WHERE intensity_tier IN ('HOT','WARM');

CREATE INDEX IF NOT EXISTS e59_mh_level_heat
    ON e59.microsegment_hierarchy(level, heat_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS e59_mh_geo
    ON e59.microsegment_hierarchy(geo_scope, geo_id);

CREATE INDEX IF NOT EXISTS e59_mh_path
    ON e59.microsegment_hierarchy(path);

CREATE INDEX IF NOT EXISTS e59_mh_auto_created
    ON e59.microsegment_hierarchy(trigger_event_id)
    WHERE auto_created = TRUE;

CREATE INDEX IF NOT EXISTS e59_mh_quadrant
    ON e59.microsegment_hierarchy(quadrant, predicted_net_revenue DESC NULLS LAST)
    WHERE quadrant IN ('STRIKE_NOW','CULTIVATE_NOW');

CREATE INDEX IF NOT EXISTS e59_mh_key
    ON e59.microsegment_hierarchy(microsegment_key, level);

CREATE INDEX IF NOT EXISTS e59_mh_issue_tags
    ON e59.microsegment_hierarchy USING GIN (issue_tags);

COMMENT ON TABLE e59.microsegment_hierarchy IS
    '5-level microsegment tree. Materialized path for fast drilldown from '
    'state/district heat map front page down to precinct → individual donor. '
    'Level 1 = master segment (heat map). Level 5 = donor activation (search result). '
    'auto_created=TRUE rows are spawned by e42.dynamic_issue_events when a news event '
    'fires in a specific geography. trigger_event_id FK to e42.dynamic_issue_events. '
    'Path example: 1.rural_safety.wildlife_bear.hyde_county.engelhard '
    'office_class FK to race_relational.office_class_taxonomy(office_class).';

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
