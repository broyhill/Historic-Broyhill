-- E59 MICROSEGMENT INTELLIGENCE ENGINE — schema + seeds
-- Extracted verbatim from ecosystems/ecosystem_59_microsegment_intelligence.py (MS_INTEL_SCHEMA + SEGMENT_MEDIA_SOURCES/TOPICS/CTAS)
-- Target: Hetzner db=postgres, schema=public. Authorized by Ed: I AUTHORIZE THIS ACTION (2026-07-08)
BEGIN;

-- ============================================================================
-- ECOSYSTEM 59: MICROSEGMENT INTELLIGENCE
-- Segment-specific media monitoring, issue scoring, nurture triggers
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. SEGMENT MEDIA SOURCES
-- Trade publications, professional associations, government feeds
-- that matter to specific microsegments. NOT general news.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_media_sources (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,           -- 'farmers', 'doctors', 'nurses', etc.
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    feed_url VARCHAR(500),                      -- RSS/Atom feed URL if available
    source_type VARCHAR(50),                    -- professional_association, trade_publication, government, etc.
    credibility_score DECIMAL(3,2) DEFAULT 0.70,
    bias_rating VARCHAR(20),                    -- conservative, neutral, liberal, unknown
    reach_estimate INTEGER,                     -- est. audience size
    check_frequency_minutes INTEGER DEFAULT 60, -- how often to poll
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP,
    last_article_found TIMESTAMP,
    articles_ingested INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(segment_tag, url)
);

CREATE INDEX IF NOT EXISTS idx_ms_media_segment ON ms_segment_media_sources(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_media_active ON ms_segment_media_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_ms_media_type ON ms_segment_media_sources(source_type);

-- -----------------------------------------------------------------------
-- 2. SEGMENT ARTICLES
-- Articles ingested from segment media sources.
-- Separate from E42 news_articles — different purpose, different scoring.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_articles (
    article_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES ms_segment_media_sources(source_id),
    segment_tag VARCHAR(50) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    url_hash VARCHAR(64) UNIQUE,                -- SHA256 for dedup
    title VARCHAR(1000) NOT NULL,
    description TEXT,
    content TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP,
    discovered_at TIMESTAMP DEFAULT NOW(),
    priority VARCHAR(20) DEFAULT 'medium',      -- urgent/high/medium/low/info
    relevance_score DECIMAL(4,3) DEFAULT 0.500, -- 0.000-1.000
    sentiment VARCHAR(20),                      -- positive/negative/neutral/mixed
    sentiment_score DECIMAL(4,3),
    is_actionable BOOLEAN DEFAULT false,        -- triggers nurture action?
    action_taken BOOLEAN DEFAULT false,
    action_type VARCHAR(50),                    -- email_blast, sms_alert, social_post, etc.
    action_taken_at TIMESTAMP,
    word_count INTEGER,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_articles_segment ON ms_segment_articles(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_articles_source ON ms_segment_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_ms_articles_published ON ms_segment_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_ms_articles_priority ON ms_segment_articles(priority);
CREATE INDEX IF NOT EXISTS idx_ms_articles_actionable ON ms_segment_articles(is_actionable);
CREATE INDEX IF NOT EXISTS idx_ms_articles_url_hash ON ms_segment_articles(url_hash);

-- -----------------------------------------------------------------------
-- 3. SEGMENT TOPICS — The issues each microsegment cares about
-- Top 10-20 issues per segment, scored by importance.
-- These drive content matching and relevance scoring.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_topics (
    topic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,
    topic_name VARCHAR(255) NOT NULL,           -- 'crop insurance', 'water rights', 'farm labor'
    topic_category VARCHAR(100),                -- 'regulation', 'economics', 'legislation', 'policy'
    importance_score DECIMAL(4,2) DEFAULT 50.00, -- 1-100 static importance to this segment
    trending_score DECIMAL(4,2) DEFAULT 0.00,   -- 0-100 dynamic trending (ML-updated)
    composite_score DECIMAL(4,2) DEFAULT 50.00, -- (importance * 0.6) + (trending * 0.4)
    keywords JSONB DEFAULT '[]',                -- search keywords for article matching
    subtopics JSONB DEFAULT '[]',               -- nested issue breakdown
    is_active BOOLEAN DEFAULT true,
    articles_matched INTEGER DEFAULT 0,
    last_article_match TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(segment_tag, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_ms_topics_segment ON ms_segment_topics(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_topics_composite ON ms_segment_topics(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_ms_topics_trending ON ms_segment_topics(trending_score DESC);

-- -----------------------------------------------------------------------
-- 4. ARTICLE-TOPIC MATCHES
-- Links articles to the topics they cover, with relevance scoring.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_article_topic_matches (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES ms_segment_articles(article_id),
    topic_id UUID REFERENCES ms_segment_topics(topic_id),
    match_score DECIMAL(4,3) DEFAULT 0.500,     -- how well article matches topic
    match_method VARCHAR(50),                   -- 'keyword', 'ml_classifier', 'manual'
    context_snippet TEXT,                        -- relevant excerpt
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_atm_article ON ms_article_topic_matches(article_id);
CREATE INDEX IF NOT EXISTS idx_ms_atm_topic ON ms_article_topic_matches(topic_id);

-- -----------------------------------------------------------------------
-- 5. SEGMENT CTAs — Calls to Action per segment
-- Pre-built CTAs that get attached to outbound content.
-- "Share with your county Farm Bureau group"
-- "Alert: school board vote THIS WEEK — show up"
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_ctas (
    cta_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,
    cta_text TEXT NOT NULL,                     -- the actual call to action
    cta_type VARCHAR(50),                       -- 'share', 'forward', 'alert', 'sign', 'attend', 'donate'
    priority_level VARCHAR(20) DEFAULT 'medium',
    topic_id UUID REFERENCES ms_segment_topics(topic_id), -- optional topic link
    use_count INTEGER DEFAULT 0,
    last_used TIMESTAMP,
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000, -- ML-tracked effectiveness
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_ctas_segment ON ms_segment_ctas(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_ctas_type ON ms_segment_ctas(cta_type);

-- -----------------------------------------------------------------------
-- 6. SEGMENT NURTURE TRIGGERS
-- When an article + topic + score crosses a threshold, fire a nurture
-- action through E30 (email), E31 (SMS), E19 (social), E09 (content).
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_nurture_triggers (
    trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,
    trigger_name VARCHAR(255) NOT NULL,
    trigger_condition JSONB NOT NULL,           -- {"topic_id": "...", "min_score": 0.75, "priority": "urgent"}
    action_type VARCHAR(50) NOT NULL,           -- email_blast, sms_alert, social_post, etc.
    action_config JSONB DEFAULT '{}',           -- ecosystem-specific config (email template, SMS template, etc.)
    target_ecosystem VARCHAR(10),               -- 'E30', 'E31', 'E19', 'E09'
    cooldown_hours INTEGER DEFAULT 24,          -- don't re-fire for same topic within N hours
    last_fired TIMESTAMP,
    fire_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_triggers_segment ON ms_nurture_triggers(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_triggers_action ON ms_nurture_triggers(action_type);

-- -----------------------------------------------------------------------
-- 7. SEGMENT PERFORMANCE — ML cost/benefit/variance tracking
-- Tracks effectiveness of segment nurture campaigns over time.
-- Fed by E21 Machine Learning for optimization.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_performance (
    perf_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,
    candidate_id VARCHAR(50),                   -- which candidate's segment activation
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Content metrics
    articles_ingested INTEGER DEFAULT 0,
    articles_actioned INTEGER DEFAULT 0,
    content_pieces_generated INTEGER DEFAULT 0,
    -- Outreach metrics
    emails_sent INTEGER DEFAULT 0,
    email_open_rate DECIMAL(5,4),
    email_click_rate DECIMAL(5,4),
    sms_sent INTEGER DEFAULT 0,
    sms_response_rate DECIMAL(5,4),
    social_posts INTEGER DEFAULT 0,
    social_engagement_rate DECIMAL(5,4),
    -- Outcome metrics
    donations_attributed DECIMAL(12,2) DEFAULT 0.00,
    donors_acquired INTEGER DEFAULT 0,
    donors_retained INTEGER DEFAULT 0,
    volunteers_recruited INTEGER DEFAULT 0,
    event_attendees INTEGER DEFAULT 0,
    -- Cost/benefit
    cost_total DECIMAL(10,2) DEFAULT 0.00,
    revenue_total DECIMAL(12,2) DEFAULT 0.00,
    roi_ratio DECIMAL(8,4),                    -- revenue / cost
    -- ML variance
    predicted_revenue DECIMAL(12,2),
    actual_revenue DECIMAL(12,2),
    variance_pct DECIMAL(6,3),                  -- (actual - predicted) / predicted * 100
    ml_confidence DECIMAL(4,3),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_perf_segment ON ms_segment_performance(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_perf_candidate ON ms_segment_performance(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ms_perf_period ON ms_segment_performance(period_start, period_end);

-- -----------------------------------------------------------------------
-- 8. SEGMENT SOCIAL MEDIA TARGETS
-- Social accounts, hashtags, groups per segment for E19 integration.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_segment_social_targets (
    target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag VARCHAR(50) NOT NULL,
    platform VARCHAR(30) NOT NULL,              -- 'twitter', 'facebook', 'instagram', 'nextdoor'
    target_type VARCHAR(30),                    -- 'account', 'hashtag', 'group', 'page'
    target_handle VARCHAR(255) NOT NULL,        -- @NCFarmBureau, #NCFarming, group URL
    follower_count INTEGER,
    engagement_rate DECIMAL(5,4),
    is_monitor_only BOOLEAN DEFAULT true,       -- true = read only, false = post to
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(segment_tag, platform, target_handle)
);

CREATE INDEX IF NOT EXISTS idx_ms_social_segment ON ms_segment_social_targets(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_social_platform ON ms_segment_social_targets(platform);

-- -----------------------------------------------------------------------
-- 9. CANDIDATE SEGMENT ACTIVATION
-- Which candidates have activated which segments.
-- Links to E09 Campaign Control Panel.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_candidate_segment_activation (
    activation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id VARCHAR(50) NOT NULL,
    segment_tag VARCHAR(50) NOT NULL,
    intensity INTEGER DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10), -- 1=passive, 10=aggressive
    is_active BOOLEAN DEFAULT true,
    activated_at TIMESTAMP DEFAULT NOW(),
    deactivated_at TIMESTAMP,
    activated_by VARCHAR(50),                   -- 'candidate', 'manager', 'ai'
    override_topics JSONB DEFAULT '[]',         -- topic overrides for this candidate
    override_ctas JSONB DEFAULT '[]',           -- CTA overrides
    notes TEXT,
    UNIQUE(candidate_id, segment_tag)
);

CREATE INDEX IF NOT EXISTS idx_ms_activation_candidate ON ms_candidate_segment_activation(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ms_activation_segment ON ms_candidate_segment_activation(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_activation_active ON ms_candidate_segment_activation(is_active);

-- -----------------------------------------------------------------------
-- VIEWS
-- -----------------------------------------------------------------------

-- Active segment dashboard — what each candidate sees
CREATE OR REPLACE VIEW v_ms_candidate_dashboard AS
SELECT
    csa.candidate_id,
    csa.segment_tag,
    csa.intensity,
    (SELECT COUNT(*) FROM ms_segment_articles sa
     WHERE sa.segment_tag = csa.segment_tag
     AND sa.discovered_at > NOW() - INTERVAL '7 days') as articles_this_week,
    (SELECT COUNT(*) FROM ms_segment_articles sa
     WHERE sa.segment_tag = csa.segment_tag
     AND sa.is_actionable = true
     AND sa.action_taken = false) as pending_actions,
    (SELECT json_agg(x.topic_obj)
     FROM (SELECT json_build_object('topic', t.topic_name, 'score', t.composite_score) AS topic_obj
           FROM ms_segment_topics t
           WHERE t.segment_tag = csa.segment_tag AND t.is_active = true
           ORDER BY t.composite_score DESC
           LIMIT 5) x) as top_5_topics
FROM ms_candidate_segment_activation csa
WHERE csa.is_active = true;

-- Trending topics across all segments
CREATE OR REPLACE VIEW v_ms_trending_topics AS
SELECT
    t.segment_tag,
    t.topic_name,
    t.importance_score,
    t.trending_score,
    t.composite_score,
    t.articles_matched,
    t.last_article_match
FROM ms_segment_topics t
WHERE t.is_active = true
ORDER BY t.trending_score DESC;

-- Source performance — which sources are producing actionable content
CREATE OR REPLACE VIEW v_ms_source_performance AS
SELECT
    s.segment_tag,
    s.name,
    s.source_type,
    s.credibility_score,
    s.articles_ingested,
    s.last_article_found,
    (SELECT COUNT(*) FROM ms_segment_articles a
     WHERE a.source_id = s.source_id AND a.is_actionable = true) as actionable_articles,
    CASE WHEN s.articles_ingested > 0
         THEN ROUND((SELECT COUNT(*)::numeric FROM ms_segment_articles a
                      WHERE a.source_id = s.source_id AND a.is_actionable = true)
                     / s.articles_ingested, 3)
         ELSE 0 END as actionable_rate
FROM ms_segment_media_sources s
WHERE s.is_active = true
ORDER BY s.segment_tag, actionable_articles DESC;

-- Segment ROI leaderboard
CREATE OR REPLACE VIEW v_ms_segment_roi AS
SELECT
    segment_tag,
    SUM(donations_attributed) as total_donations,
    SUM(donors_acquired) as total_donors_acquired,
    SUM(cost_total) as total_cost,
    SUM(revenue_total) as total_revenue,
    CASE WHEN SUM(cost_total) > 0
         THEN ROUND(SUM(revenue_total) / SUM(cost_total), 2)
         ELSE 0 END as roi_ratio,
    AVG(variance_pct) as avg_variance_pct
FROM ms_segment_performance
GROUP BY segment_tag
ORDER BY total_donations DESC;


-- ============================================================================
-- POLITICAL CLOUT SCORING LAYER
-- Quantifies the power of every special interest organization behind
-- each microsegment. Scores 12 measurable dimensions → CLOUT_SCORE 0-100.
-- Eddie Broyhill: "This goes in the affinity=microsegmenting ecosystem."
-- ============================================================================

-- -----------------------------------------------------------------------
-- 10. INTEREST GROUP CLOUT SCORES
-- One row per special interest organization.
-- Linked to segment_tag so every microsegment knows the power of its
-- backing organizations (Farm Bureau = farmers, NCMS = doctors, etc.)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_interest_group_clout (
    org_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_tag     VARCHAR(50) NOT NULL,           -- which microsegment this org backs
    org_name        VARCHAR(255) NOT NULL UNIQUE,
    org_type        VARCHAR(50),                    -- 'membership_assoc' | 'pac' | 'super_pac' |
                                                    -- 'trade_assoc' | 'nonprofit_501c4' | 'union' | 'lobby_shop'
    partisan_lean   VARCHAR(10) DEFAULT 'R',        -- R / D / N / U
    fec_committee_id VARCHAR(20),                   -- FEC ID if they have a PAC
    sboe_committee_id VARCHAR(20),                  -- NC SBOE ID
    nc_sos_lobby_id  VARCHAR(20),                   -- NC SOS lobbyist registry ID
    website_url     VARCHAR(500),
    rss_feed_url    VARCHAR(500),                   -- feeds into E42 monitoring
    facebook_url    VARCHAR(500),
    twitter_handle  VARCHAR(100),
    instagram_handle VARCHAR(100),
    newsletter_name  VARCHAR(255),
    newsletter_signup_url VARCHAR(500),
    monitor_news    BOOLEAN DEFAULT false,          -- E42 auto-monitor flag
    monitor_social  BOOLEAN DEFAULT false,          -- E19 auto-monitor flag

    -- D1: Total Political Donations (20% weight)
    d1_sboe_giving_cycle    NUMERIC DEFAULT 0,      -- $ given to NC candidates last cycle (SBOE)
    d1_fec_giving_cycle     NUMERIC DEFAULT 0,      -- $ given to federal candidates last cycle
    d1_score                SMALLINT DEFAULT 0,     -- 1-10

    -- D2: Lobbying Spend (15% weight)
    d2_lobby_spend_annual   NUMERIC DEFAULT 0,      -- $ spent at NCGA per year
    d2_score                SMALLINT DEFAULT 0,

    -- D3: Membership / Constituency Size (10% weight)
    d3_member_count         INTEGER DEFAULT 0,      -- # of voters/members represented
    d3_score                SMALLINT DEFAULT 0,

    -- D4: Voter Turnout Rate (8% weight)
    d4_turnout_rate         DECIMAL(4,3) DEFAULT 0, -- 0.000-1.000
    d4_score                SMALLINT DEFAULT 0,

    -- D5: Media / Earned Media Influence (7% weight)
    d5_social_followers     INTEGER DEFAULT 0,      -- total social following
    d5_press_coverage       VARCHAR(20),            -- 'high' | 'medium' | 'low'
    d5_score                SMALLINT DEFAULT 0,

    -- D6: Organized Infrastructure (7% weight)
    d6_fulltime_staff       INTEGER DEFAULT 0,
    d6_chapter_count        INTEGER DEFAULT 0,
    d6_has_pac              BOOLEAN DEFAULT false,
    d6_score                SMALLINT DEFAULT 0,

    -- D7: Issue Salience (5% weight)
    d7_single_issue         BOOLEAN DEFAULT false,  -- single-issue = higher intensity
    d7_score                SMALLINT DEFAULT 0,

    -- D8: Geographic Concentration (3% weight)
    d8_top_counties         TEXT[],                 -- where they're strongest
    d8_score                SMALLINT DEFAULT 0,

    -- D9: Grants Received (8% weight)
    d9_federal_grants_annual NUMERIC DEFAULT 0,     -- $ federal + state grants per year
    d9_state_grants_annual   NUMERIC DEFAULT 0,
    d9_score                SMALLINT DEFAULT 0,

    -- D10: Charitable / 990 Revenue (5% weight)
    d10_irs_990_revenue     NUMERIC DEFAULT 0,      -- annual 990 revenue
    d10_score               SMALLINT DEFAULT 0,

    -- D11: Economic Force / NC GDP (8% weight)
    d11_nc_gdp_contribution NUMERIC DEFAULT 0,      -- $ annual NC GDP contribution
    d11_score               SMALLINT DEFAULT 0,

    -- D12: Employment Base (4% weight)
    d12_nc_jobs             INTEGER DEFAULT 0,      -- # NC jobs in sector
    d12_score               SMALLINT DEFAULT 0,

    -- Composite CLOUT_SCORE
    -- Formula: D1(0.20)+D2(0.15)+D3(0.10)+D4(0.08)+D5(0.07)+D6(0.07)
    --         +D7(0.05)+D8(0.03)+D9(0.08)+D10(0.05)+D11(0.08)+D12(0.04)
    -- Each D scored 1-10, multiply weighted sum × 10 = 0-100
    clout_score             DECIMAL(5,2) DEFAULT 0, -- 0.00-100.00
    clout_tier              VARCHAR(20),             -- 'dominant'(85+) | 'major'(70-84) |
                                                     -- 'significant'(50-69) | 'moderate'(25-49) | 'minor'(<25)
    clout_last_calculated   TIMESTAMP,
    clout_notes             TEXT,                   -- narrative explanation of score

    -- Relationship tracking
    relationship_status     VARCHAR(20) DEFAULT 'cold', -- cold/warm/active/champion
    assigned_relationship_mgr VARCHAR(255),
    last_contact_date       DATE,
    endorsement_status      VARCHAR(20),            -- 'endorsed' | 'neutral' | 'opposed' | 'unknown'
    endorsement_cycle       INTEGER,                -- election year of endorsement

    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_clout_segment ON ms_interest_group_clout(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_clout_score ON ms_interest_group_clout(clout_score DESC);
CREATE INDEX IF NOT EXISTS idx_ms_clout_tier ON ms_interest_group_clout(clout_tier);
CREATE INDEX IF NOT EXISTS idx_ms_clout_lean ON ms_interest_group_clout(partisan_lean);


-- -----------------------------------------------------------------------
-- 11. INTEREST GROUP PEOPLE
-- Officers, decision-makers, and major donors at every special interest.
-- The HUMAN LAYER behind the clout score.
-- "The clout score tells you the organization's power.
--  The human layer tells you WHO to cultivate a relationship with."
--                                              — Ed Broyhill, March 31, 2026
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ms_interest_group_people (
    person_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES ms_interest_group_clout(org_id),
    segment_tag     VARCHAR(50) NOT NULL,

    -- Identity
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    middle_name     VARCHAR(50),
    suffix          VARCHAR(20),
    preferred_name  VARCHAR(100),               -- "goes by Jim"
    norm_first      VARCHAR(100),               -- normalized for spine matching
    norm_last       VARCHAR(100),

    -- Role
    org_name        VARCHAR(255),               -- denormalized for quick display
    role_title      VARCHAR(255),               -- "President", "Executive Director", "PAC Treasurer"
    role_type       VARCHAR(50),                -- 'officer' | 'board' | 'major_donor' | 'lobbyist' | 'staff'
    role_start_date DATE,
    role_end_date   DATE,
    is_current      BOOLEAN DEFAULT true,

    -- Bio
    hometown        VARCHAR(100),
    current_city    VARCHAR(100),
    current_county  VARCHAR(50),
    education       JSONB DEFAULT '[]',         -- [{school, degree, year}]
    occupation      VARCHAR(255),               -- day job if volunteer officer
    employer        VARCHAR(255),
    employer_industry VARCHAR(100),
    military_service VARCHAR(255),
    bio_summary     TEXT,                       -- 2-3 sentence AI-generated bio

    -- Political profile
    party_registration VARCHAR(5),             -- R / D / U / L
    voter_ncid      VARCHAR(20),               -- link to nc_voters
    voter_rncid     VARCHAR(50),               -- link to nc_datatrust / person_spine
    known_political_views TEXT,
    elected_offices_held TEXT[],               -- prior or current offices

    -- Donation history (auto-populated from SBOE + FEC data)
    total_donated_sboe  NUMERIC DEFAULT 0,     -- total to NC candidates (SBOE)
    total_donated_fec   NUMERIC DEFAULT 0,     -- total to federal candidates (FEC)
    total_donated_all   NUMERIC DEFAULT 0,     -- combined
    top_recipient_1  VARCHAR(255),
    top_recipient_2  VARCHAR(255),
    top_recipient_3  VARCHAR(255),
    donor_since_year INTEGER,
    last_donation_year INTEGER,

    -- Charitable giving
    total_charitable NUMERIC DEFAULT 0,
    top_charity_1   VARCHAR(255),
    top_charity_2   VARCHAR(255),
    top_charity_3   VARCHAR(255),

    -- Contact
    email           VARCHAR(255),
    phone           VARCHAR(30),
    address_line1   VARCHAR(255),
    city            VARCHAR(100),
    zip5            VARCHAR(10),
    linkedin_url    VARCHAR(500),
    twitter_handle  VARCHAR(100),
    facebook_url    VARCHAR(500),
    preferred_contact VARCHAR(20),             -- 'email' | 'text' | 'phone' | 'linkedin'

    -- Relationship intelligence
    known_relationships TEXT[],               -- other key people they know
    known_issues    TEXT[],                   -- issue_tags they personally care about
    influence_network TEXT,                   -- brief description of their network
    talking_points  TEXT,                     -- what motivates this person
    approach_notes  TEXT,                     -- how to cultivate this relationship
    contact_rating  VARCHAR(5),              -- 'A' | 'B' | 'C' | 'D' — relationship quality

    -- Cross-segment connector flag (the Charlie Sutton layer)
    -- Person who bridges multiple microsegment worlds
    is_cross_segment_connector BOOLEAN DEFAULT false,
    connector_segments  TEXT[],              -- which segments they bridge
    connector_notes     TEXT,               -- explain the bridge (e.g., "Doctor who hunts AND serves on arts board")

    -- CRM linkage
    last_contact_date DATE,
    assigned_relationship_mgr VARCHAR(255),
    on_email_list   BOOLEAN DEFAULT false,
    on_sms_list     BOOLEAN DEFAULT false,

    -- Spine linkage (populated when matched)
    spine_person_id BIGINT,                  -- FK to core.person_spine when matched
    contact_id      BIGINT,                  -- FK to contacts table

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_people_org ON ms_interest_group_people(org_id);
CREATE INDEX IF NOT EXISTS idx_ms_people_segment ON ms_interest_group_people(segment_tag);
CREATE INDEX IF NOT EXISTS idx_ms_people_last ON ms_interest_group_people(last_name);
CREATE INDEX IF NOT EXISTS idx_ms_people_rncid ON ms_interest_group_people(voter_rncid);
CREATE INDEX IF NOT EXISTS idx_ms_people_connector ON ms_interest_group_people(is_cross_segment_connector);
CREATE INDEX IF NOT EXISTS idx_ms_people_current ON ms_interest_group_people(is_current);
CREATE INDEX IF NOT EXISTS idx_ms_people_rating ON ms_interest_group_people(contact_rating);


-- -----------------------------------------------------------------------
-- VIEW: Cross-segment connectors — the Charlie Sutton layer
-- People who bridge multiple microsegment worlds.
-- "One person who sits in both worlds. That's a RELATIONSHIP microsegment."
--                                              — Ed Broyhill, April 11, 2026
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ms_cross_segment_connectors AS
SELECT
    p.person_id,
    p.first_name || ' ' || p.last_name AS full_name,
    p.org_name,
    p.role_title,
    p.connector_segments,
    p.connector_notes,
    p.total_donated_all,
    p.contact_rating,
    p.talking_points,
    p.approach_notes,
    array_length(p.connector_segments, 1) AS segment_count
FROM ms_interest_group_people p
WHERE p.is_cross_segment_connector = true
  AND p.is_current = true
ORDER BY array_length(p.connector_segments, 1) DESC, p.total_donated_all DESC;


-- -----------------------------------------------------------------------
-- VIEW: Clout leaderboard by segment
-- Which organizations have the most political muscle in each segment?
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ms_clout_by_segment AS
SELECT
    segment_tag,
    org_name,
    org_type,
    partisan_lean,
    clout_score,
    clout_tier,
    d1_sboe_giving_cycle + d1_fec_giving_cycle AS total_political_giving,
    d2_lobby_spend_annual,
    d3_member_count,
    d11_nc_gdp_contribution,
    d12_nc_jobs,
    endorsement_status,
    relationship_status
FROM ms_interest_group_clout
ORDER BY segment_tag, clout_score DESC;

-- ==================== SEEDS ====================
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'NC Farm Bureau — Social + RSS', 'https://www.ncfb.org', 'https://www.ncfb.org/feed/', 'social_rss', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'NC Dept of Agriculture', 'https://www.ncagr.gov', 'https://www.ncagr.gov/feed/', 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'Southeast Farm Press', 'https://www.farmprogress.com/southeast-farm-press', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'Farm Journal', 'https://www.agweb.com/farm-journal', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'USDA NASS NC Crop Reports', 'https://www.nass.usda.gov/Statistics_by_State/North_Carolina/', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'NC State Extension Newsletters', 'https://content.ces.ncsu.edu', NULL, 'university', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('farmers', 'AgWeb.com', 'https://www.agweb.com', 'https://www.agweb.com/rss/news', 'trade_publication', 0.8) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'NC Medical Society — Newsletter + Social', 'https://www.ncmedsoc.org', NULL, 'professional_association', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'NC Medical Journal', 'https://www.ncmedicaljournal.com', NULL, 'journal', 0.92) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'Modern Healthcare Southeast', 'https://www.modernhealthcare.com', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'Becker''s Hospital Review', 'https://www.beckershospitalreview.com', 'https://www.beckershospitalreview.com/rss/', 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'AMA Wire', 'https://www.ama-assn.org/news', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'Healthcare Dive', 'https://www.healthcaredive.com', 'https://www.healthcaredive.com/feeds/news/', 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('doctors', 'NCGA Health Committee News', 'https://www.ncleg.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'NC Nurses Association Newsletter', 'https://www.ncnurses.org', NULL, 'professional_association', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'NursingCenter.com', 'https://www.nursingcenter.com', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'Nurse.com Southeast', 'https://www.nurse.com', NULL, 'trade_publication', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'NC Board of Nursing Updates', 'https://www.ncbon.com', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'NCNA Nurse Practitioner News', 'https://www.ncnurses.org/np', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'Healthcare Dive — Nursing', 'https://www.healthcaredive.com', 'https://www.healthcaredive.com/feeds/news/', 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('nurses', 'NCGA Health Committee News', 'https://www.ncleg.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'NC Wildlife Resources Commission', 'https://www.ncwildlife.org', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'Ducks Unlimited NC Chapter', 'https://www.ducks.org/north-carolina', NULL, 'advocacy_org', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'Outdoor Life Southeast', 'https://www.outdoorlife.com', NULL, 'trade_publication', 0.8) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'Field & Stream', 'https://www.fieldandstream.com', NULL, 'trade_publication', 0.8) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'Sportsmen''s Alliance Alerts', 'https://www.sportsmensalliance.org', NULL, 'advocacy_org', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'NRA-ILA Alerts', 'https://www.nraila.org', 'https://www.nraila.org/rss/', 'advocacy_org', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'BassFan.com Tournament News', 'https://www.bassfan.com', NULL, 'trade_publication', 0.78) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('hunters_fishermen', 'CCA NC — Coastal Conservation', 'https://www.joincca.org/north-carolina', NULL, 'advocacy_org', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'NC Sheriffs'' Association Newsletter', 'https://www.ncsheriffs.org', NULL, 'professional_association', 0.92) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'NC Justice Academy News', 'https://www.ncdoj.gov/ncja/', NULL, 'government', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'PoliceOne.com', 'https://www.policeone.com', NULL, 'trade_publication', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'Law Enforcement Today', 'https://www.lawenforcementtoday.com', NULL, 'trade_publication', 0.78) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'FBI Crime Statistics Releases', 'https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/ucr', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'NCGA Judiciary Committee News', 'https://www.ncleg.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('law_enforcement', 'NC Police Benevolent Association', 'https://www.ncpba.org', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'Moms for Liberty NC — Social', 'https://www.momsforliberty.org', NULL, 'advocacy_org', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'Parents Defending Education Alerts', 'https://www.defendinged.org', NULL, 'advocacy_org', 0.8) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'NC Charter School Alliance Newsletter', 'https://www.nccharterschools.org', NULL, 'professional_association', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'Education Week', 'https://www.edweek.org', NULL, 'trade_publication', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'NCGA Education Committee News', 'https://www.ncleg.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'Local School Board Meeting Agendas', 'https://www.ncsba.org', NULL, 'government', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('teachers_school_board', 'NCAE Social — Monitor Opposition', 'https://www.ncae.org', NULL, 'professional_association', 0.75) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'NC Bankers Association Newsletter', 'https://www.ncbankers.org', NULL, 'professional_association', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'American Banker Southeast', 'https://www.americanbanker.com', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'Charlotte Business Journal — Finance', 'https://www.bizjournals.com/charlotte', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'Triangle Business Journal — Finance', 'https://www.bizjournals.com/triangle', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'NC Association of CPAs Updates', 'https://www.ncacpa.org', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('finance_banking', 'FDIC/OCC Regulatory News', 'https://www.fdic.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'NC Association of Realtors News', 'https://www.ncrealtors.org', NULL, 'professional_association', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'NC Home Builders Association Newsletter', 'https://www.nchba.org', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'CoStar NC Market Reports', 'https://www.costar.com', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'Charlotte Business Journal — Real Estate', 'https://www.bizjournals.com/charlotte', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'NAHB Policy News', 'https://www.nahb.org', NULL, 'professional_association', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('real_estate_builders', 'Zoning/Planning Board Agendas', 'https://www.ncleg.gov', NULL, 'government', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'NC Values Coalition Alerts', 'https://www.ncvalues.org', NULL, 'advocacy_org', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'NC Baptist State Convention News', 'https://ncbaptist.org', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'Christian Post Southeast', 'https://www.christianpost.com', NULL, 'trade_publication', 0.8) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'Christianity Today', 'https://www.christianitytoday.com', NULL, 'trade_publication', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'NCGA Religious Liberty Filtered News', 'https://www.ncleg.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'Faith & Freedom Coalition NC', 'https://www.ffcoalition.com', NULL, 'advocacy_org', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('faith_pastors', 'Christian Radio NC — WCCM, WMIT, WBAJ', NULL, NULL, 'newsletter', 0.78) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'NC Dairy Producers Association', 'https://www.ncdairy.org', NULL, 'professional_association', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'Dairy Herd Management', 'https://www.dairyherd.com', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'Hoard''s Dairyman', 'https://hoards.com', NULL, 'trade_publication', 0.85) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'USDA NASS Dairy Reports', 'https://www.nass.usda.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'Farm Credit News', 'https://www.farmcredit.com', NULL, 'trade_publication', 0.83) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('dairy_specialty_ag', 'NC State Animal Science', 'https://cals.ncsu.edu/animal-science/', NULL, 'university', 0.88) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('seniors', 'AARP NC — Monitor', 'https://states.aarp.org/north-carolina', NULL, 'advocacy_org', 0.75) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('seniors', 'Medicare.gov News', 'https://www.medicare.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('seniors', 'Social Security Administration Announcements', 'https://www.ssa.gov', NULL, 'government', 0.95) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('seniors', 'Senior Living Magazine', 'https://www.seniorlivingmag.com', NULL, 'trade_publication', 0.78) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('seniors', 'McKnight''s Senior Living', 'https://www.mcknightsseniorliving.com', NULL, 'trade_publication', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('suburban_women', 'Moms for Liberty NC — Social', 'https://www.momsforliberty.org', NULL, 'advocacy_org', 0.82) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('suburban_women', 'Local School Board Meeting Agendas', 'https://www.ncsba.org', NULL, 'government', 0.9) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('suburban_women', 'NextDoor Public Posts — Suburban Towns', 'https://www.nextdoor.com', NULL, 'social_rss', 0.75) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('suburban_women', 'Local PTA Newsletters', NULL, NULL, 'newsletter', 0.78) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_media_sources (segment_tag, name, url, feed_url, source_type, credibility_score) VALUES ('suburban_women', 'Suburban Neighborhood Facebook Groups', 'https://www.facebook.com', NULL, 'social_rss', 0.72) ON CONFLICT (segment_tag, url) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Crop Insurance & Farm Bill', 'legislation', 95, 57.0, '["crop insurance", "farm bill", "USDA", "commodity support"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Water Rights & Irrigation', 'regulation', 88, 52.8, '["water rights", "irrigation", "water quality", "WOTUS"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Farm Labor & Immigration', 'policy', 85, 51.0, '["H-2A visa", "farm labor", "ag workers", "migrant"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Property Tax — Agricultural Use', 'taxation', 90, 54.0, '["property tax", "present use value", "ag exemption", "farmland"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Ethanol & Biofuels Mandates', 'regulation', 72, 43.2, '["ethanol", "biofuel", "RFS", "renewable fuel"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Solar Farms on Farmland', 'policy', 80, 48.0, '["solar farm", "farmland conversion", "solar lease", "ag preservation"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'NCDA Regulations & Inspections', 'regulation', 78, 46.8, '["inspection", "NCDA", "food safety", "animal welfare"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Commodity Prices & Markets', 'economics', 92, 55.2, '["commodity price", "corn price", "soybean", "tobacco", "market"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Rural Broadband', 'infrastructure', 70, 42.0, '["rural broadband", "internet access", "connectivity"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Estate Tax & Farm Succession', 'taxation', 85, 51.0, '["estate tax", "death tax", "farm succession", "step-up basis"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Drought & Disaster Relief', 'policy', 82, 49.2, '["drought", "disaster relief", "crop loss", "USDA assistance"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('farmers', 'Environmental Regulations', 'regulation', 88, 52.8, '["EPA", "environmental", "wetlands", "nutrient management"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Medicaid Expansion & Reimbursement', 'policy', 95, 57.0, '["medicaid", "reimbursement", "expansion", "provider rates"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Scope of Practice — NP/PA', 'regulation', 90, 54.0, '["scope of practice", "nurse practitioner", "physician assistant", "supervision"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Medical Malpractice Reform', 'legislation', 88, 52.8, '["malpractice", "tort reform", "liability cap", "medical negligence"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Certificate of Need (CON)', 'regulation', 85, 51.0, '["certificate of need", "CON", "hospital expansion", "facility"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Physician Burnout & Workforce', 'policy', 78, 46.8, '["physician burnout", "doctor shortage", "workforce", "residency"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Telehealth Regulations', 'regulation', 82, 49.2, '["telehealth", "telemedicine", "virtual care", "remote patient"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Prior Authorization Reform', 'regulation', 92, 55.2, '["prior authorization", "prior auth", "insurance denial", "utilization review"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Prescription Drug Pricing', 'legislation', 80, 48.0, '["drug pricing", "PBM", "pharmacy benefit", "prescription cost"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Healthcare Consolidation', 'economics', 75, 45.0, '["hospital merger", "acquisition", "consolidation", "antitrust"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('doctors', 'Mental Health Parity', 'legislation', 72, 43.2, '["mental health", "parity", "behavioral health", "substance abuse"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Nurse Staffing Ratios', 'legislation', 95, 57.0, '["staffing ratio", "nurse patient ratio", "safe staffing"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Scope of Practice Expansion', 'regulation', 92, 55.2, '["scope of practice", "full practice authority", "NP independence"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Nursing Shortage & Recruitment', 'policy', 88, 52.8, '["nursing shortage", "nurse recruitment", "nursing school"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Workplace Violence Protection', 'legislation', 85, 51.0, '["workplace violence", "nurse assault", "hospital security"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Mandatory Overtime Restrictions', 'regulation', 82, 49.2, '["mandatory overtime", "forced overtime", "nurse fatigue"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Nursing License Compact', 'regulation', 80, 48.0, '["nurse license compact", "NLC", "multistate license"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Travel Nurse Regulations', 'regulation', 78, 46.8, '["travel nurse", "agency nurse", "temporary staffing"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('nurses', 'Mental Health for Healthcare Workers', 'policy', 75, 45.0, '["burnout", "mental health", "healthcare worker wellness"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Second Amendment — Federal & State', 'legislation', 98, 58.8, '["2A", "second amendment", "gun rights", "firearms"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'NC Wildlife Regulations', 'regulation', 92, 55.2, '["hunting season", "bag limit", "NCWRC", "wildlife regulation"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Public Land Access', 'policy', 88, 52.8, '["public land", "game lands", "access", "BLM"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Concealed Carry & Permitless Carry', 'legislation', 90, 54.0, '["concealed carry", "permitless carry", "constitutional carry"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Fishing Regulations & Licenses', 'regulation', 85, 51.0, '["fishing license", "creel limit", "fishing regulation"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Endangered Species Impact on Hunting', 'regulation', 80, 48.0, '["endangered species", "ESA", "habitat", "hunting restriction"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Boat & Marina Regulations', 'regulation', 72, 43.2, '["boating", "marina", "waterway", "boat registration"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Conservation Funding', 'policy', 78, 46.8, '["Pittman-Robertson", "conservation fund", "wildlife funding"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'Sunday Hunting', 'legislation', 75, 45.0, '["Sunday hunting", "Sunday restriction"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('hunters_fishermen', 'CWD & Wildlife Disease', 'policy', 82, 49.2, '["chronic wasting", "CWD", "wildlife disease", "deer"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Qualified Immunity', 'legislation', 95, 57.0, '["qualified immunity", "police liability", "officer protection"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Bail Reform & Pretrial Release', 'legislation', 92, 55.2, '["bail reform", "pretrial release", "cash bail"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Police Funding & Equipment', 'policy', 90, 54.0, '["defund police", "police funding", "equipment", "budget"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Fentanyl & Drug Trafficking', 'policy', 95, 57.0, '["fentanyl", "drug trafficking", "opioid", "cartel"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Body Camera & Use of Force Policy', 'regulation', 82, 49.2, '["body camera", "use of force", "bodycam"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Officer Recruitment & Retention', 'policy', 88, 52.8, '["officer recruitment", "retention", "police academy", "staffing"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Gang Task Forces', 'policy', 78, 46.8, '["gang", "task force", "organized crime"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'DA Election & Prosecution Policy', 'policy', 85, 51.0, '["district attorney", "prosecution", "plea bargain", "soft on crime"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Immigration Enforcement — 287(g)', 'legislation', 80, 48.0, '["287g", "ICE", "immigration enforcement", "sanctuary"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('law_enforcement', 'Juvenile Justice Reform', 'legislation', 75, 45.0, '["juvenile justice", "raise the age", "youth offender"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'School Choice & Vouchers', 'legislation', 95, 57.0, '["school choice", "voucher", "opportunity scholarship", "ESA"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Parental Rights in Education', 'legislation', 92, 55.2, '["parental rights", "parents bill of rights", "curriculum transparency"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Critical Race Theory / DEI', 'policy', 88, 52.8, '["CRT", "critical race", "DEI", "diversity equity"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Teacher Pay & Benefits', 'policy', 85, 51.0, '["teacher pay", "teacher salary", "benefit", "retirement"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Charter School Expansion', 'legislation', 82, 49.2, '["charter school", "charter cap", "charter expansion"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Gender Policy in Schools', 'policy', 90, 54.0, '["gender policy", "transgender", "bathroom", "pronoun"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Book Challenges & Library Policy', 'policy', 78, 46.8, '["book challenge", "library", "inappropriate material"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Homeschool Regulations', 'regulation', 80, 48.0, '["homeschool", "home education", "DNPE"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'School Safety & SROs', 'policy', 85, 51.0, '["school safety", "SRO", "school resource officer", "school shooting"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('teachers_school_board', 'Sex Ed & Health Curriculum', 'policy', 75, 45.0, '["sex education", "health curriculum", "abstinence"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Dodd-Frank & Banking Regulation', 'regulation', 92, 55.2, '["Dodd-Frank", "banking regulation", "financial regulation"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Interest Rate Policy', 'economics', 90, 54.0, '["interest rate", "Fed rate", "monetary policy"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Community Bank Regulations', 'regulation', 88, 52.8, '["community bank", "small bank", "regulatory burden"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Tax Policy — Corporate & Capital Gains', 'taxation', 95, 57.0, '["corporate tax", "capital gains", "tax rate"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Fintech Regulation', 'regulation', 78, 46.8, '["fintech", "cryptocurrency", "digital banking"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'SBA Lending Programs', 'policy', 80, 48.0, '["SBA", "small business loan", "PPP"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'Anti-Money Laundering / BSA', 'regulation', 75, 45.0, '["AML", "BSA", "bank secrecy", "compliance"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('finance_banking', 'ESG & Investment Mandates', 'regulation', 85, 51.0, '["ESG", "environmental social governance", "fiduciary"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Zoning & Land Use Regulations', 'regulation', 95, 57.0, '["zoning", "land use", "rezoning", "planning"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Building Code Changes', 'regulation', 90, 54.0, '["building code", "IRC", "energy code"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Impact Fees & Developer Charges', 'taxation', 88, 52.8, '["impact fee", "developer fee", "infrastructure charge"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Affordable Housing Mandates', 'policy', 82, 49.2, '["affordable housing", "inclusionary zoning", "workforce housing"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Lumber & Material Costs', 'economics', 85, 51.0, '["lumber price", "material cost", "supply chain"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Property Tax Assessments', 'taxation', 90, 54.0, '["property tax", "assessment", "revaluation"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Wetlands & Environmental Permits', 'regulation', 80, 48.0, '["wetland permit", "environmental review", "404 permit"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('real_estate_builders', 'Real Estate Transfer Tax', 'taxation', 78, 46.8, '["transfer tax", "excise tax", "deed stamp"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Religious Liberty Legislation', 'legislation', 98, 58.8, '["religious liberty", "religious freedom", "RFRA", "conscience"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Abortion — Pro-Life Policy', 'legislation', 95, 57.0, '["abortion", "pro-life", "heartbeat", "Dobbs"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'School Prayer & Religious Expression', 'legislation', 85, 51.0, '["school prayer", "religious expression", "First Amendment"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Church Tax Exemption', 'taxation', 88, 52.8, '["tax exempt", "501c3", "Johnson Amendment", "church tax"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Marriage & Family Policy', 'policy', 82, 49.2, '["marriage", "family", "parental rights"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Israel Policy & Support', 'policy', 80, 48.0, '["Israel", "Jerusalem", "foreign aid", "antisemitism"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Human Trafficking', 'policy', 78, 46.8, '["human trafficking", "sex trafficking", "modern slavery"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('faith_pastors', 'Gambling Expansion Opposition', 'legislation', 75, 45.0, '["gambling", "casino", "sports betting", "lottery"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'Milk Pricing & Federal Orders', 'regulation', 95, 57.0, '["milk price", "federal milk marketing order", "FMMO"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'USDA Dairy Support Programs', 'policy', 90, 54.0, '["dairy margin", "DMC", "dairy support"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'Animal Welfare Regulations', 'regulation', 85, 51.0, '["animal welfare", "USDA inspection", "confinement"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'Feed Costs & Crop Prices', 'economics', 88, 52.8, '["feed cost", "corn price", "hay price"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'Environmental Compliance — CAFO', 'regulation', 82, 49.2, '["CAFO", "concentrated animal", "manure management"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('dairy_specialty_ag', 'Dairy Trade — Imports/Exports', 'economics', 78, 46.8, '["dairy import", "dairy export", "trade agreement"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Social Security Reform', 'legislation', 98, 58.8, '["social security", "retirement age", "COLA", "benefits"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Medicare Changes', 'legislation', 95, 57.0, '["medicare", "part D", "advantage plan", "premium"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Prescription Drug Costs', 'policy', 92, 55.2, '["drug cost", "prescription price", "drug pricing"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Property Tax Relief for Seniors', 'taxation', 88, 52.8, '["senior tax relief", "homestead exemption", "property tax freeze"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Elder Abuse & Fraud Protection', 'policy', 82, 49.2, '["elder abuse", "senior fraud", "scam"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Long-Term Care & Nursing Homes', 'policy', 85, 51.0, '["long-term care", "nursing home", "assisted living"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Veterans Benefits', 'policy', 80, 48.0, '["veteran benefit", "VA", "military retirement"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('seniors', 'Caregiver Support', 'policy', 75, 45.0, '["caregiver", "family caregiver", "respite"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'School Safety', 'policy', 95, 57.0, '["school safety", "school shooting", "SRO", "security"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Parental Rights in Education', 'legislation', 92, 55.2, '["parental rights", "curriculum", "transparency"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Child Care Costs & Availability', 'policy', 88, 52.8, '["child care", "daycare", "childcare cost"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Property Taxes & Local Spending', 'taxation', 85, 51.0, '["property tax", "school budget", "local spending"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Neighborhood Safety & Crime', 'policy', 90, 54.0, '["crime", "break-in", "theft", "neighborhood safety"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Gender Policy in Schools', 'policy', 88, 52.8, '["gender policy", "transgender", "girls sports"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Grocery & Gas Prices', 'economics', 82, 49.2, '["grocery price", "gas price", "inflation", "cost of living"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_topics (segment_tag, topic_name, topic_category, importance_score, composite_score, keywords) VALUES ('suburban_women', 'Healthcare Access & Costs', 'policy', 80, 48.0, '["healthcare cost", "insurance premium", "pediatric"]'::jsonb) ON CONFLICT (segment_tag, topic_name) DO NOTHING;
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'farmers', 'Share with your county Farm Bureau group', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='farmers' AND cta_text='Share with your county Farm Bureau group');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'farmers', 'Forward to your commodity committee', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='farmers' AND cta_text='Forward to your commodity committee');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'farmers', 'Invite to farm field day event', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='farmers' AND cta_text='Invite to farm field day event');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'farmers', 'Alert: legislation affects YOUR farm — call your rep', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='farmers' AND cta_text='Alert: legislation affects YOUR farm — call your rep');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'farmers', 'Sign: petition to protect ag property tax exemptions', 'sign' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='farmers' AND cta_text='Sign: petition to protect ag property tax exemptions');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'doctors', 'Forward to your practice partners', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='doctors' AND cta_text='Forward to your practice partners');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'doctors', 'Share with your department at grand rounds', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='doctors' AND cta_text='Share with your department at grand rounds');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'doctors', 'Invite to physician policy roundtable', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='doctors' AND cta_text='Invite to physician policy roundtable');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'doctors', 'Alert: scope of practice bill THIS WEEK', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='doctors' AND cta_text='Alert: scope of practice bill THIS WEEK');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'nurses', 'Share in your hospital''s nurse group', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='nurses' AND cta_text='Share in your hospital''s nurse group');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'nurses', 'Forward to your unit manager', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='nurses' AND cta_text='Forward to your unit manager');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'nurses', 'Invite to nurse policy briefing', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='nurses' AND cta_text='Invite to nurse policy briefing');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'nurses', 'Alert: staffing ratio bill needs YOUR voice', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='nurses' AND cta_text='Alert: staffing ratio bill needs YOUR voice');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'hunters_fishermen', 'Share with your hunting club', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='hunters_fishermen' AND cta_text='Share with your hunting club');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'hunters_fishermen', 'Forward to your DU chapter', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='hunters_fishermen' AND cta_text='Forward to your DU chapter');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'hunters_fishermen', 'Alert: NCWRC regulation change affects YOU', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='hunters_fishermen' AND cta_text='Alert: NCWRC regulation change affects YOU');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'hunters_fishermen', 'Sign: petition against anti-hunting bill', 'sign' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='hunters_fishermen' AND cta_text='Sign: petition against anti-hunting bill');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'hunters_fishermen', 'Invite to sportsmen''s policy dinner', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='hunters_fishermen' AND cta_text='Invite to sportsmen''s policy dinner');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'law_enforcement', 'Endorse: add your name to Sheriffs for [Candidate]', 'sign' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='law_enforcement' AND cta_text='Endorse: add your name to Sheriffs for [Candidate]');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'law_enforcement', 'Alert: bail reform bill threatens your county', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='law_enforcement' AND cta_text='Alert: bail reform bill threatens your county');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'law_enforcement', 'Share with your department', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='law_enforcement' AND cta_text='Share with your department');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'law_enforcement', 'Forward to your county sheriff', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='law_enforcement' AND cta_text='Forward to your county sheriff');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'teachers_school_board', 'Share with your school''s parent group', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='teachers_school_board' AND cta_text='Share with your school''s parent group');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'teachers_school_board', 'Forward to homeschool co-op', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='teachers_school_board' AND cta_text='Forward to homeschool co-op');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'teachers_school_board', 'Alert: school board vote on curriculum THIS WEEK', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='teachers_school_board' AND cta_text='Alert: school board vote on curriculum THIS WEEK');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'teachers_school_board', 'Sign: parental rights petition', 'sign' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='teachers_school_board' AND cta_text='Sign: parental rights petition');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'teachers_school_board', 'Bring a friend to school board meeting', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='teachers_school_board' AND cta_text='Bring a friend to school board meeting');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'finance_banking', 'Forward to your banking colleagues', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='finance_banking' AND cta_text='Forward to your banking colleagues');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'finance_banking', 'Alert: new financial regulation affects your clients', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='finance_banking' AND cta_text='Alert: new financial regulation affects your clients');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'finance_banking', 'Invite to financial policy briefing', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='finance_banking' AND cta_text='Invite to financial policy briefing');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'real_estate_builders', 'Alert: zoning bill affects your listings', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='real_estate_builders' AND cta_text='Alert: zoning bill affects your listings');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'real_estate_builders', 'Share with your brokerage', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='real_estate_builders' AND cta_text='Share with your brokerage');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'real_estate_builders', 'Forward to your builder clients', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='real_estate_builders' AND cta_text='Forward to your builder clients');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'faith_pastors', 'Share from the pulpit', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='faith_pastors' AND cta_text='Share from the pulpit');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'faith_pastors', 'Include in church newsletter', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='faith_pastors' AND cta_text='Include in church newsletter');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'faith_pastors', 'Alert: religious freedom bill THIS WEEK', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='faith_pastors' AND cta_text='Alert: religious freedom bill THIS WEEK');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'faith_pastors', 'Bring congregation to candidate forum', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='faith_pastors' AND cta_text='Bring congregation to candidate forum');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'faith_pastors', 'Donate: protect our values', 'donate' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='faith_pastors' AND cta_text='Donate: protect our values');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'dairy_specialty_ag', 'Forward to your co-op members', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='dairy_specialty_ag' AND cta_text='Forward to your co-op members');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'dairy_specialty_ag', 'Alert: milk pricing order under review', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='dairy_specialty_ag' AND cta_text='Alert: milk pricing order under review');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'dairy_specialty_ag', 'Share with your Farm Credit lender', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='dairy_specialty_ag' AND cta_text='Share with your Farm Credit lender');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'seniors', 'Forward to your senior center', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='seniors' AND cta_text='Forward to your senior center');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'seniors', 'Alert: Social Security changes affect YOUR benefit', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='seniors' AND cta_text='Alert: Social Security changes affect YOUR benefit');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'seniors', 'Share with your VFW/Legion post', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='seniors' AND cta_text='Share with your VFW/Legion post');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'seniors', 'Invite neighbor to candidate coffee', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='seniors' AND cta_text='Invite neighbor to candidate coffee');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'suburban_women', 'Share in your neighborhood Facebook group', 'share' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='suburban_women' AND cta_text='Share in your neighborhood Facebook group');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'suburban_women', 'Forward to your school''s parent group', 'forward' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='suburban_women' AND cta_text='Forward to your school''s parent group');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'suburban_women', 'Alert: school board vote THIS WEEK — show up', 'alert' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='suburban_women' AND cta_text='Alert: school board vote THIS WEEK — show up');
INSERT INTO ms_segment_ctas (segment_tag, cta_text, cta_type) SELECT 'suburban_women', 'Bring a friend to meet the candidate', 'attend' WHERE NOT EXISTS (SELECT 1 FROM ms_segment_ctas WHERE segment_tag='suburban_women' AND cta_text='Bring a friend to meet the candidate');
COMMIT;
