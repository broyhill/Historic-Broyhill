-- =============================================================================
-- 306_e59_page_config.sql
-- E59 Microsegment Page Configuration
-- =============================================================================
-- DRY-RUN ONLY. Codex applies after Ed `Authorized`. Requires 305 first.
-- Source: MSG-181 (Nexus E51, 2026-06-16)
-- Defines per-microsegment HTML page config: display rank, minimum thresholds,
-- seasonal triggers, legislative triggers, 6-tab layout flags, page slug.
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

CREATE TABLE IF NOT EXISTS e59.microsegment_page_config (
    config_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    microsegment_key        TEXT        NOT NULL UNIQUE,
    display_name            TEXT        NOT NULL,
    display_rank            INTEGER,        -- 1 = highest priority on heat map
    category                TEXT,           -- 'occupational','lifestyle','ideological','geographic','tribal'
    is_primary_influencer   BOOLEAN     DEFAULT FALSE,  -- top influencers get full 6-tab page

    -- Ed's minimum display rules
    min_display_local       INTEGER     DEFAULT 50,     -- municipal/county minimum
    min_display_state       INTEGER     DEFAULT 100,    -- state leg/statewide/judicial/federal minimum

    -- Endurance defaults
    default_endurance_type  TEXT        CHECK (default_endurance_type IN (
                                'permanent','seasonal','legislative',
                                'news_flash','election_countdown'
                            )) DEFAULT 'permanent',
    default_decay_rate      DECIMAL(4,3) DEFAULT 0.0500,  -- per-day

    -- Seasonal config (MM-DD strings)
    seasonal_peak_start     TEXT,           -- '11-25' for Thanksgiving
    seasonal_peak_end       TEXT,           -- '01-06' for post-Christmas
    seasonal_peak_boost     INTEGER     DEFAULT 0,  -- intensity boost during season

    -- Legislative triggers (wake segment when these bills are active in NCGA)
    trigger_bill_codes      TEXT[],
    trigger_issue_codes     TEXT[],     -- issues.canonical issue_code values

    -- 6-tab layout flags (MSG-183 spec)
    show_overview_tab       BOOLEAN     DEFAULT TRUE,
    show_donor_volunteer_tab BOOLEAN    DEFAULT TRUE,
    show_dollar_tab         BOOLEAN     DEFAULT TRUE,
    show_wizard_tab         BOOLEAN     DEFAULT TRUE,
    show_endurance_tab      BOOLEAN     DEFAULT TRUE,
    show_hierarchy_tab      BOOLEAN     DEFAULT TRUE,   -- drilldown to precinct level

    -- Dormant high-potential section (CULTIVATE_NOW quadrant)
    show_dormant_section    BOOLEAN     DEFAULT TRUE,
    dormant_capacity_min    DECIMAL(14,2) DEFAULT 5000.00,  -- $5K minimum capacity to show

    -- E13 domain linkage (which tattoo domains activate this segment)
    e13_domain_codes        TEXT[],     -- e.g. ['AGRI','0B','6'] for rural/ag segment

    -- HTML page
    page_slug               TEXT        UNIQUE,  -- /microsegments/{slug}
    icon_class              TEXT,               -- lucide icon class

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS e59_pc_rank      ON e59.microsegment_page_config(display_rank NULLS LAST);
CREATE INDEX IF NOT EXISTS e59_pc_primary   ON e59.microsegment_page_config(is_primary_influencer) WHERE is_primary_influencer;
CREATE INDEX IF NOT EXISTS e59_pc_category  ON e59.microsegment_page_config(category);

-- ─── SEED: Core 30 canonical microsegments (from MICROSEGMENT_SIZE_ESTIMATES.md) ─
-- Priority order per canonical doc: Seniors, Small Biz, Veterans, Hunters, Soccer Moms first
INSERT INTO e59.microsegment_page_config
    (microsegment_key, display_name, display_rank, category,
     is_primary_influencer, default_endurance_type, default_decay_rate,
     e13_domain_codes, page_slug, icon_class)
VALUES
-- TIER 1 — Primary influencers (Ed's priority: Seniors first, then Small Biz, Veterans, Hunters)
('seniors_65plus',       'Seniors (65+)',                1,  'demographic',    TRUE,  'permanent', 0.020, ARRAY['9','0B','0C'],       'seniors',          'lucide-user-2'),
('small_biz_owners',     'Small Business Owners',        2,  'occupational',   TRUE,  'permanent', 0.025, ARRAY['4','SBIZ','0B'],      'small-business',   'lucide-store'),
('veterans',             'Veterans & Military Community', 3,  'tribal',         TRUE,  'permanent', 0.015, ARRAY['8','MIL','0B'],       'veterans',         'lucide-shield'),
('hunters_fishermen',    'Hunters & Fishermen',          4,  'lifestyle',      TRUE,  'permanent', 0.030, ARRAY['SPORT','2A','6'],     'hunters',          'lucide-crosshair'),
('soccer_moms',          'Suburban Parents',             5,  'demographic',    TRUE,  'permanent', 0.025, ARRAY['FAM','11','EDU'],     'suburban-parents', 'lucide-users'),
('farmers_ag',           'Farmers & Agriculture',        6,  'occupational',   TRUE,  'permanent', 0.020, ARRAY['AGRI','6','0B'],      'farmers',          'lucide-tractor'),
('evangelical_faith',    'Evangelical / Faith Community',7,  'tribal',         TRUE,  'permanent', 0.015, ARRAY['FAITH','EVAN','12'],  'faith-community',  'lucide-church'),
('law_enforcement',      'Law Enforcement & First Resp.',8,  'occupational',   TRUE,  'permanent', 0.020, ARRAY['LEO','0B','BACK'],    'law-enforcement',  'lucide-badge'),
('realtors_real_estate', 'Realtors & Real Estate',       9,  'occupational',   TRUE,  'permanent', 0.025, ARRAY['RE','4','0B'],        'real-estate',      'lucide-home'),
('construction',         'Construction & Contractors',   10, 'occupational',   TRUE,  'permanent', 0.030, ARRAY['CONST','4','0B'],     'construction',     'lucide-hard-hat'),

-- TIER 2 — High value
('doctors_physicians',   'Physicians & Surgeons',        11, 'occupational',   TRUE,  'permanent', 0.020, ARRAY['HEALTH','4','0B'],    'physicians',       'lucide-stethoscope'),
('bankers_finance',      'Bankers & Finance Executives', 12, 'occupational',   TRUE,  'permanent', 0.020, ARRAY['FIN','4','0B'],       'finance',          'lucide-landmark'),
('manufacturers',        'Manufacturers',                13, 'occupational',   FALSE, 'permanent', 0.025, ARRAY['MFG','4','0B'],       'manufacturing',    'lucide-factory'),
('military_community',   'Active Military & Families',   14, 'tribal',         TRUE,  'permanent', 0.015, ARRAY['8','MIL','FAM'],      'military',         'lucide-flag'),
('trucking_transport',   'Trucking & Transportation',    15, 'occupational',   FALSE, 'permanent', 0.030, ARRAY['TRANS','4','0B'],     'transportation',   'lucide-truck'),
('lawyers_legal',        'Attorneys & Legal',            16, 'occupational',   FALSE, 'permanent', 0.025, ARRAY['LEGAL','4','0B'],     'legal',            'lucide-scale'),
('nurses_healthcare',    'Nurses & Healthcare Workers',  17, 'occupational',   FALSE, 'permanent', 0.025, ARRAY['HEALTH','9','FAM'],   'nurses',           'lucide-heart-pulse'),
('healthcare_admin',     'Hospital & Healthcare Admin',  18, 'occupational',   FALSE, 'permanent', 0.025, ARRAY['HEALTH','4','0B'],    'healthcare-admin', 'lucide-hospital'),
('teachers_edu',         'Teachers & School Board',      19, 'occupational',   FALSE, 'permanent', 0.020, ARRAY['EDU','11','0B'],      'educators',        'lucide-graduation-cap'),
('auto_dealers',         'Auto Dealers',                 20, 'occupational',   FALSE, 'permanent', 0.030, ARRAY['AUTO','4','0B'],      'auto-dealers',     'lucide-car'),

-- TIER 3 — Geographic & lifestyle
('beach_coastal',        'Beach & Coastal Community',    21, 'geographic',     FALSE, 'seasonal',  0.040, ARRAY['GEO','6','SPORT'],    'coastal',          'lucide-waves'),
('mountain_resort',      'Mountain & Resort Community',  22, 'geographic',     FALSE, 'seasonal',  0.040, ARRAY['GEO','6','SPORT'],    'mountain-resort',  'lucide-mountain'),
('lake_recreation',      'Lake Homeowners & Recreation', 23, 'geographic',     FALSE, 'seasonal',  0.040, ARRAY['GEO','6','SPORT'],    'lake-recreation',  'lucide-anchor'),
('nascar_motorsports',   'NASCAR & Motorsports',         24, 'lifestyle',      FALSE, 'seasonal',  0.050, ARRAY['SPORT','4','0B'],     'motorsports',      'lucide-gauge'),
('biotech_rtp',          'Biotech / Pharma / RTP',       25, 'occupational',   FALSE, 'permanent', 0.020, ARRAY['TECH','4','0B'],      'biotech',          'lucide-flask-conical'),

-- TIER 4 — Agricultural sub-segments
('dairy_farmers',        'Dairy Farmers',                26, 'occupational',   FALSE, 'permanent', 0.020, ARRAY['AGRI','6','DAIRY'],   'dairy',            'lucide-milk'),
('hog_farmers',          'Pork / Hog Industry',          27, 'occupational',   FALSE, 'permanent', 0.020, ARRAY['AGRI','6','HOG'],     'pork-industry',    'lucide-beef'),
('tobacco_farmers',      'Tobacco Farmers',              28, 'occupational',   FALSE, 'permanent', 0.025, ARRAY['AGRI','6','TOB'],     'tobacco',          'lucide-leaf'),

-- TIER 5 — Issue-driven
('maga_true_believers',  'MAGA True Believers',          29, 'ideological',    FALSE, 'permanent', 0.010, ARRAY['MAGA','1','0B'],      'maga-core',        'lucide-flag'),
('pro_life_single_issue','Pro-Life Single Issue',        30, 'ideological',    FALSE, 'permanent', 0.010, ARRAY['PROLIFE','2','FAITH'],'pro-life',         'lucide-heart')

ON CONFLICT (microsegment_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    display_rank = EXCLUDED.display_rank,
    updated_at   = NOW();

DO $$ BEGIN
    RAISE NOTICE 'Seeded 30 canonical microsegment page configs';
END $$;

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
