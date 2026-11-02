-- =============================================================================
-- 305_e59_microsegment_intensity_log.sql
-- E59 Living Microsegment Intelligence — Daily Intensity Log
-- =============================================================================
-- DRY-RUN ONLY. Codex applies after Ed `Authorized`. Requires e59 schema (apply
-- after E77 304 — same 300-series). Requires core.candidates (exists).
-- Source: MSG-181 (Nexus E51, 2026-06-16)
-- cluster_id = INTEGER. candidate_id = UUID FK core.candidates.
-- ADDITIVE — no existing objects touched.
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

CREATE SCHEMA IF NOT EXISTS e59;

COMMENT ON SCHEMA e59 IS
    'E59 Living Microsegment Intelligence Engine. '
    'Minimum 50 microsegments per local/county race, 100 per state/statewide/federal. '
    'Each microsegment has a floating intensity score (1-100) updated daily from '
    'E42 news events, legislative calendar, seasonal triggers, and opponent activity. '
    'Heat map ranked by predicted_net_revenue — the money leaderboard, not engagement. '
    'Spec: MSG-181 through MSG-184 (Nexus E51, 2026-06-16).';

-- =============================================================================
-- e59.microsegment_intensity_log
-- One row per (microsegment_key, candidate_id, day).
-- The daily floating intensity record — updated every 24hrs for WARM/COOL,
-- every 1hr for HOT segments. Drives the heat map ranking.
-- =============================================================================
CREATE TABLE IF NOT EXISTS e59.microsegment_intensity_log (
    log_id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    microsegment_key        TEXT        NOT NULL,
    candidate_id            UUID        NOT NULL
                                REFERENCES core.candidates(candidate_id),
    office_district_id      TEXT,           -- FK to e77.district_tattoo (nullable until E77 applies)

    -- Daily floating intensity
    intensity_score         INTEGER     NOT NULL CHECK (intensity_score BETWEEN 1 AND 100),
    intensity_tier          TEXT        NOT NULL
                                CHECK (intensity_tier IN ('HOT','WARM','COOL','DORMANT')),

    -- Endurance classification (Ed's directive — some endure, some come and go)
    endurance_type          TEXT        NOT NULL
                                CHECK (endurance_type IN (
                                    'permanent',        -- always present (small biz owners, veterans)
                                    'seasonal',         -- Christmas, Tax Season, Primary Season
                                    'legislative',      -- driven by NCGA session / bill activity
                                    'news_flash',       -- news event (bear attack, rate hike)
                                    'election_countdown' -- T-30/14/7/3/1 countdown triggers
                                )),

    -- What's driving intensity today
    primary_driver          TEXT,       -- e.g. 'EPA_FARM_RULE_NCGA_HEARING'
    driver_source           TEXT        CHECK (driver_source IN (
                                'E42_news','E60_poll','E63_datatrust',
                                'calendar','opponent_event','manual'
                            )),
    news_event_ids          TEXT[],     -- from heat.news_events or e42.dynamic_issue_events

    -- Decay forecast
    peak_date               DATE,
    decay_rate              DECIMAL(4,3),   -- per-day decay coefficient (0.150 = fast news flash)
    estimated_cool_date     DATE,           -- when segment drops below WARM

    -- Dollar influence (THE ranking metric per Ed)
    predicted_net_revenue   DECIMAL(14,2),  -- ranked by this on heat map
    total_capacity          DECIMAL(14,2),
    remaining_headroom      DECIMAL(14,2),  -- capped at $6,800/election NC law
    propensity_score        DECIMAL(5,3),
    activation_cost_est     DECIMAL(14,2),

    -- 2×2 quadrant (intensity × potential)
    quadrant                TEXT        CHECK (quadrant IN (
                                'STRIKE_NOW',       -- high intensity + high potential
                                'CULTIVATE_NOW',    -- low intensity + high potential
                                'INFORM_ONLY',      -- high intensity + low potential
                                'MONITOR_BENCH'     -- low intensity + low potential
                            )),

    -- Wizard recommendations (pre-loaded context for Launch Wizard button)
    top_issue_to_stress     TEXT,
    recommended_channel     TEXT        CHECK (recommended_channel IN (
                                'email','sms','rvm','event',
                                'personal_call','direct_mail','multi_channel'
                            )),
    optimal_ask_amount      DECIMAL(10,2),
    urgency_window_days     INTEGER,    -- days before opportunity closes

    -- Validity
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    computed_date           DATE        GENERATED ALWAYS AS ((computed_at AT TIME ZONE 'UTC')::DATE) STORED,
    valid_until             TIMESTAMPTZ     -- HOT = 1hr TTL, WARM/COOL = 24hr
);

CREATE UNIQUE INDEX IF NOT EXISTS e59_mil_daily_unique
    ON e59.microsegment_intensity_log (microsegment_key, candidate_id, computed_date);

-- Heat map query: ranked by predicted net revenue, filtered to valid rows
CREATE INDEX IF NOT EXISTS e59_mil_heatmap
    ON e59.microsegment_intensity_log (candidate_id, predicted_net_revenue DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS e59_mil_tier
    ON e59.microsegment_intensity_log (candidate_id, intensity_tier, predicted_net_revenue DESC)
    WHERE intensity_tier IN ('HOT','WARM');

CREATE INDEX IF NOT EXISTS e59_mil_endurance
    ON e59.microsegment_intensity_log (endurance_type, estimated_cool_date)
    WHERE intensity_tier != 'DORMANT';

CREATE INDEX IF NOT EXISTS e59_mil_quadrant
    ON e59.microsegment_intensity_log (candidate_id, quadrant, predicted_net_revenue DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS e59_mil_district
    ON e59.microsegment_intensity_log (office_district_id, intensity_score DESC)
    WHERE office_district_id IS NOT NULL;

COMMENT ON TABLE e59.microsegment_intensity_log IS
    'Daily floating intensity record per microsegment × candidate. '
    'Heat map front page ranks rows by predicted_net_revenue DESC (money leaderboard). '
    'HOT tier: recomputed every 1hr. WARM/COOL: every 24hrs. DORMANT: weekly. '
    'quadrant determines Wizard strategy: STRIKE_NOW=48hr window, '
    'CULTIVATE_NOW=relationship building, INFORM_ONLY=amplify, MONITOR_BENCH=watch.';

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
