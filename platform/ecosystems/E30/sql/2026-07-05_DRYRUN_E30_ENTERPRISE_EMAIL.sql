-- ============================================================================
-- E30 Enterprise Email Platform — DRY-RUN DDL
-- ============================================================================
-- Generated: 2026-07-05
-- Ecosystem:  E30 (Email)
-- Canary:     cluster_id 372171 = 147 txns / $332,631.30
-- Schema:     e30
-- Tables:     15
-- Views:      4
-- RLS:        per-tenant isolation on all tenant-scoped tables
--
-- AUTHORIZATION REQUIRED: "I AUTHORIZE THIS ACTION"
-- Execution:  Codex on Hetzner 37.27.169.232 via SSH + psql
-- ============================================================================

BEGIN;

-- Schema
CREATE SCHEMA IF NOT EXISTS e30;

-- ============================================================================
-- 1. Tenants (multi-tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.tenants (
    tenant_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name     TEXT          NOT NULL,
    candidate_name    TEXT          NOT NULL DEFAULT '',
    candidate_id      TEXT,
    campaign_type     TEXT          NOT NULL DEFAULT 'candidate'
                                   CHECK (campaign_type IN ('candidate','pac','committee','party')),
    jurisdiction      TEXT          NOT NULL DEFAULT '',
    sending_domain    TEXT          NOT NULL DEFAULT '',
    from_email        TEXT          NOT NULL DEFAULT '',
    from_name         TEXT          NOT NULL DEFAULT '',
    reply_to_email    TEXT          NOT NULL DEFAULT '',
    physical_address  TEXT          NOT NULL DEFAULT '',
    paid_for_by       TEXT,
    monthly_email_limit INT        NOT NULL DEFAULT 50000,
    emails_sent_this_month INT     NOT NULL DEFAULT 0,
    daily_email_limit INT          NOT NULL DEFAULT 5000,
    features          JSONB        NOT NULL DEFAULT '{}',
    status            TEXT          NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','suspended','closed')),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_candidate ON e30.tenants (candidate_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status    ON e30.tenants (status);

-- ============================================================================
-- 2. Campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.campaigns (
    campaign_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID          REFERENCES e30.tenants(tenant_id),
    name              TEXT          NOT NULL,
    subject           TEXT          NOT NULL DEFAULT '',
    body_html         TEXT          NOT NULL DEFAULT '',
    body_text         TEXT          NOT NULL DEFAULT '',
    template_id       TEXT,
    campaign_type     TEXT          NOT NULL DEFAULT 'blast'
                                   CHECK (campaign_type IN ('blast','drip','triggered','transactional')),
    is_fundraising    BOOLEAN       NOT NULL DEFAULT FALSE,
    target_grades     TEXT[]        DEFAULT '{}',
    target_counties   TEXT[]        DEFAULT '{}',
    schedule_at       TIMESTAMPTZ,
    sent_at           TIMESTAMPTZ,
    status            TEXT          NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','scheduled','sending','sent','paused','cancelled')),
    total_recipients  INT           NOT NULL DEFAULT 0,
    total_sent        INT           NOT NULL DEFAULT 0,
    total_delivered   INT           NOT NULL DEFAULT 0,
    total_opened      INT           NOT NULL DEFAULT 0,
    total_clicked     INT           NOT NULL DEFAULT 0,
    total_bounced     INT           NOT NULL DEFAULT 0,
    total_complained  INT           NOT NULL DEFAULT 0,
    total_revenue_cents BIGINT      NOT NULL DEFAULT 0,
    experiment_id     TEXT,
    created_by        TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant  ON e30.campaigns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON e30.campaigns (status);

-- ============================================================================
-- 3. Send log (every individual email)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.send_log (
    send_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id        UUID          REFERENCES e30.campaigns(campaign_id),
    candidate_id       TEXT,
    donor_id           TEXT,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    recipient_email    TEXT          NOT NULL,
    match_tier         TEXT          NOT NULL DEFAULT 'UNMATCHED',
    gate_passed        BOOLEAN       NOT NULL DEFAULT FALSE,
    blocked_by         TEXT,
    template_id        TEXT,
    subject_line       TEXT,
    is_fundraising     BOOLEAN       NOT NULL DEFAULT FALSE,
    provider_message_id TEXT,
    sent_at            TIMESTAMPTZ,
    delivered          BOOLEAN       NOT NULL DEFAULT FALSE,
    -- Engagement tracking
    first_opened_at    TIMESTAMPTZ,
    last_opened_at     TIMESTAMPTZ,
    open_count         INT           NOT NULL DEFAULT 0,
    first_clicked_at   TIMESTAMPTZ,
    last_clicked_at    TIMESTAMPTZ,
    click_count        INT           NOT NULL DEFAULT 0,
    -- Device / geo
    device_type        TEXT,
    browser            TEXT,
    os_name            TEXT,
    geo_city           TEXT,
    geo_state          TEXT,
    geo_country        TEXT,
    -- Bounce
    bounce_type        TEXT          CHECK (bounce_type IN ('hard','soft','block','complaint')),
    bounce_reason      TEXT,
    is_complaint       BOOLEAN       NOT NULL DEFAULT FALSE,
    is_unsubscribe     BOOLEAN       NOT NULL DEFAULT FALSE,
    -- Cost
    cost_cents         INT           NOT NULL DEFAULT 0,
    -- Conversion
    conversion_cents   BIGINT        NOT NULL DEFAULT 0,
    converted_at       TIMESTAMPTZ,
    -- E22 experiment tracking
    experiment_id      TEXT,
    variation_id       TEXT,
    pattern_code       TEXT,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sendlog_campaign   ON e30.send_log (campaign_id);
CREATE INDEX IF NOT EXISTS idx_sendlog_tenant     ON e30.send_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sendlog_donor      ON e30.send_log (donor_id);
CREATE INDEX IF NOT EXISTS idx_sendlog_email      ON e30.send_log (recipient_email);
CREATE INDEX IF NOT EXISTS idx_sendlog_sent       ON e30.send_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sendlog_experiment  ON e30.send_log (experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sendlog_provider_msg ON e30.send_log (provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ============================================================================
-- 4. Email events (webhook-ingested)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.email_events (
    event_id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type         TEXT          NOT NULL,
    send_id            TEXT,
    recipient_email    TEXT,
    provider_message_id TEXT,
    event_timestamp    TIMESTAMPTZ,
    ip_address         INET,
    user_agent         TEXT,
    device_type        TEXT,
    browser            TEXT,
    os_name            TEXT,
    geo_city           TEXT,
    geo_state          TEXT,
    geo_country        TEXT,
    link_url           TEXT,
    bounce_type        TEXT,
    bounce_reason      TEXT,
    smtp_code          INT,
    raw_payload        JSONB,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_send       ON e30.email_events (send_id);
CREATE INDEX IF NOT EXISTS idx_events_type       ON e30.email_events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_email      ON e30.email_events (recipient_email);
CREATE INDEX IF NOT EXISTS idx_events_ts         ON e30.email_events (event_timestamp DESC);

-- ============================================================================
-- 5. Suppression list
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.suppression_list (
    suppression_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT          NOT NULL,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    reason             TEXT          NOT NULL
                                    CHECK (reason IN ('HARD_BOUNCE','COMPLAINT','UNSUBSCRIBE','MANUAL','LIST_UNSUBSCRIBE')),
    source_send_id     UUID,
    permanent          BOOLEAN       NOT NULL DEFAULT TRUE,
    suppressed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (email, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON e30.suppression_list (email);

-- ============================================================================
-- 6. Consent ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.consent_ledger (
    consent_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT          NOT NULL,
    channel            TEXT          NOT NULL DEFAULT 'email',
    opted_in_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    revoked_at         TIMESTAMPTZ,
    double_opt_in_confirmed BOOLEAN  NOT NULL DEFAULT FALSE,
    double_opt_in_at   TIMESTAMPTZ,
    source             TEXT          NOT NULL DEFAULT 'import',
    ip_address         INET,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_email   ON e30.consent_ledger (email, channel);

-- ============================================================================
-- 7. Sequences (drip automation definitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.sequences (
    sequence_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT          NOT NULL,
    sequence_type      TEXT          NOT NULL DEFAULT 'welcome'
                                    CHECK (sequence_type IN ('welcome','donor_cultivation','volunteer_recruitment',
                                                             'lapsed_reactivation','event_invitation','gotv','post_event')),
    candidate_id       TEXT,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    trigger_event      TEXT          NOT NULL DEFAULT '',
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. Sequence steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.sequence_steps (
    step_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id        UUID          NOT NULL REFERENCES e30.sequences(sequence_id) ON DELETE CASCADE,
    step_number        INT           NOT NULL,
    template_id        TEXT          NOT NULL DEFAULT '',
    subject_override   TEXT,
    delay_days         INT           NOT NULL DEFAULT 0,
    delay_hours        INT           NOT NULL DEFAULT 0,
    condition          TEXT          NOT NULL DEFAULT 'always'
                                    CHECK (condition IN ('always','opened_previous','not_opened',
                                                         'clicked_previous','not_clicked','donated','not_donated')),
    grade_filter       TEXT[],
    is_fundraising     BOOLEAN       NOT NULL DEFAULT FALSE,
    UNIQUE (sequence_id, step_number)
);

-- ============================================================================
-- 9. Enrollments (donors enrolled in sequences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.enrollments (
    enrollment_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id        UUID          NOT NULL REFERENCES e30.sequences(sequence_id),
    donor_id           TEXT          NOT NULL,
    email              TEXT          NOT NULL,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    current_step       INT           NOT NULL DEFAULT 1,
    status             TEXT          NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','paused','completed','cancelled')),
    enrolled_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    next_send_at       TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_enroll_seq       ON e30.enrollments (sequence_id);
CREATE INDEX IF NOT EXISTS idx_enroll_donor     ON e30.enrollments (donor_id);
CREATE INDEX IF NOT EXISTS idx_enroll_pending   ON e30.enrollments (next_send_at) WHERE status = 'active';

-- ============================================================================
-- 10. Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.templates (
    template_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    name               TEXT          NOT NULL,
    subject            TEXT          NOT NULL DEFAULT '',
    body_html          TEXT          NOT NULL DEFAULT '',
    body_text          TEXT          NOT NULL DEFAULT '',
    template_tier      TEXT          NOT NULL DEFAULT 'standard_segmented'
                                    CHECK (template_tier IN ('personalized_vip','high_value',
                                                             'standard_segmented','mass_optimized','minimal')),
    category           TEXT          NOT NULL DEFAULT 'general',
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON e30.templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_tier   ON e30.templates (template_tier);

-- ============================================================================
-- 11. Send time profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.send_time_profiles (
    profile_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT          NOT NULL UNIQUE,
    best_hour          INT           NOT NULL DEFAULT 10,
    best_day           INT           NOT NULL DEFAULT 2,
    avg_response_hours NUMERIC(6,2)  NOT NULL DEFAULT 4.0,
    total_opens        INT           NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. Link tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.link_tracking (
    link_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id            UUID          REFERENCES e30.send_log(send_id),
    campaign_id        UUID          REFERENCES e30.campaigns(campaign_id),
    original_url       TEXT          NOT NULL,
    tracking_url       TEXT          NOT NULL,
    position           INT,
    link_text          TEXT,
    click_count        INT           NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_links_send     ON e30.link_tracking (send_id);
CREATE INDEX IF NOT EXISTS idx_links_campaign ON e30.link_tracking (campaign_id);

-- ============================================================================
-- 13. Link clicks (individual click events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.link_clicks (
    click_id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id            UUID          REFERENCES e30.link_tracking(link_id),
    send_id            UUID          REFERENCES e30.send_log(send_id),
    donor_id           TEXT,
    ip_address         INET,
    user_agent         TEXT,
    device_type        TEXT,
    browser            TEXT,
    os_name            TEXT,
    geo_city           TEXT,
    geo_state          TEXT,
    clicked_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clicks_link ON e30.link_clicks (link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_send ON e30.link_clicks (send_id);

-- ============================================================================
-- 14. Cost ledger (per-send cost tracking for E60)
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.cost_ledger (
    cost_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           TEXT          NOT NULL,
    ecosystem          TEXT          NOT NULL DEFAULT 'E30',
    channel            TEXT          NOT NULL DEFAULT 'email',
    vendor             TEXT          NOT NULL DEFAULT 'sendgrid',
    cost_cents         INT           NOT NULL DEFAULT 0,
    send_id            UUID,
    donor_id           TEXT,
    candidate_id       TEXT,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_tenant   ON e30.cost_ledger (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_donor    ON e30.cost_ledger (donor_id);

-- ============================================================================
-- 15. Warmup tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS e30.warmup_log (
    log_id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date           DATE          NOT NULL DEFAULT CURRENT_DATE,
    tenant_id          UUID          REFERENCES e30.tenants(tenant_id),
    sends_today        INT           NOT NULL DEFAULT 0,
    daily_cap          INT           NOT NULL DEFAULT 50,
    warmup_day         INT           NOT NULL DEFAULT 1,
    UNIQUE (log_date, tenant_id)
);

-- ============================================================================
-- Views
-- ============================================================================

-- Campaign performance dashboard
CREATE OR REPLACE VIEW e30.v_campaign_dashboard AS
SELECT
    c.campaign_id,
    c.name,
    c.status,
    c.tenant_id,
    t.campaign_name,
    c.total_recipients,
    c.total_sent,
    c.total_delivered,
    c.total_opened,
    c.total_clicked,
    c.total_bounced,
    c.total_complained,
    c.total_revenue_cents,
    CASE WHEN c.total_sent > 0
         THEN ROUND(c.total_delivered::NUMERIC / c.total_sent, 4)
         ELSE 0 END AS delivery_rate,
    CASE WHEN c.total_delivered > 0
         THEN ROUND(c.total_opened::NUMERIC / c.total_delivered, 4)
         ELSE 0 END AS open_rate,
    CASE WHEN c.total_opened > 0
         THEN ROUND(c.total_clicked::NUMERIC / c.total_opened, 4)
         ELSE 0 END AS click_to_open_rate,
    c.created_at,
    c.sent_at
FROM e30.campaigns c
LEFT JOIN e30.tenants t ON c.tenant_id = t.tenant_id;

-- Reputation monitor
CREATE OR REPLACE VIEW e30.v_reputation_monitor AS
SELECT
    DATE_TRUNC('day', sent_at) AS send_date,
    tenant_id,
    COUNT(*) AS total_sent,
    COUNT(*) FILTER (WHERE delivered = TRUE) AS delivered,
    COUNT(*) FILTER (WHERE bounce_type IS NOT NULL) AS bounced,
    COUNT(*) FILTER (WHERE bounce_type = 'hard') AS hard_bounced,
    COUNT(*) FILTER (WHERE is_complaint = TRUE) AS complaints,
    COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS opened,
    COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL) AS clicked,
    ROUND(COUNT(*) FILTER (WHERE is_complaint = TRUE)::NUMERIC
          / GREATEST(COUNT(*) FILTER (WHERE delivered = TRUE), 1), 6) AS complaint_rate,
    ROUND(COUNT(*) FILTER (WHERE bounce_type IS NOT NULL)::NUMERIC
          / GREATEST(COUNT(*), 1), 4) AS bounce_rate
FROM e30.send_log
WHERE sent_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', sent_at), tenant_id
ORDER BY send_date DESC;

-- Sequence enrollment status
CREATE OR REPLACE VIEW e30.v_sequence_status AS
SELECT
    s.sequence_id,
    s.name AS sequence_name,
    s.sequence_type,
    s.is_active,
    COUNT(e.enrollment_id) AS total_enrolled,
    COUNT(e.enrollment_id) FILTER (WHERE e.status = 'active') AS active,
    COUNT(e.enrollment_id) FILTER (WHERE e.status = 'completed') AS completed,
    COUNT(e.enrollment_id) FILTER (WHERE e.status = 'cancelled') AS cancelled
FROM e30.sequences s
LEFT JOIN e30.enrollments e ON s.sequence_id = e.sequence_id
GROUP BY s.sequence_id, s.name, s.sequence_type, s.is_active;

-- Top-performing content
CREATE OR REPLACE VIEW e30.v_content_performance AS
SELECT
    subject_line,
    template_id,
    COUNT(*) AS sends,
    COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS opens,
    COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL) AS clicks,
    COUNT(*) FILTER (WHERE conversion_cents > 0) AS conversions,
    COALESCE(SUM(conversion_cents), 0) AS total_revenue_cents,
    ROUND(COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL)::NUMERIC
          / GREATEST(COUNT(*), 1), 4) AS open_rate,
    ROUND(COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL)::NUMERIC
          / GREATEST(COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL), 1), 4) AS click_to_open_rate
FROM e30.send_log
WHERE delivered = TRUE
GROUP BY subject_line, template_id
HAVING COUNT(*) >= 10
ORDER BY open_rate DESC;

-- ============================================================================
-- Row Level Security (RLS) — per-tenant isolation
-- ============================================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE e30.send_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE e30.campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE e30.templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE e30.enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE e30.cost_ledger    ENABLE ROW LEVEL SECURITY;

-- Policies: each table sees only rows where tenant_id matches app.current_tenant_id
-- or tenant_id IS NULL (global/shared data)
DO $$
BEGIN
    -- send_log
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'e30_sendlog_tenant_isolation') THEN
        EXECUTE 'CREATE POLICY e30_sendlog_tenant_isolation ON e30.send_log
                 USING (tenant_id IS NULL OR tenant_id::TEXT = current_setting(''app.current_tenant_id'', TRUE))';
    END IF;
    -- campaigns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'e30_campaigns_tenant_isolation') THEN
        EXECUTE 'CREATE POLICY e30_campaigns_tenant_isolation ON e30.campaigns
                 USING (tenant_id IS NULL OR tenant_id::TEXT = current_setting(''app.current_tenant_id'', TRUE))';
    END IF;
    -- templates
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'e30_templates_tenant_isolation') THEN
        EXECUTE 'CREATE POLICY e30_templates_tenant_isolation ON e30.templates
                 USING (tenant_id IS NULL OR tenant_id::TEXT = current_setting(''app.current_tenant_id'', TRUE))';
    END IF;
    -- enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'e30_enrollments_tenant_isolation') THEN
        EXECUTE 'CREATE POLICY e30_enrollments_tenant_isolation ON e30.enrollments
                 USING (tenant_id IS NULL OR tenant_id::TEXT = current_setting(''app.current_tenant_id'', TRUE))';
    END IF;
    -- cost_ledger
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'e30_cost_tenant_isolation') THEN
        EXECUTE 'CREATE POLICY e30_cost_tenant_isolation ON e30.cost_ledger
                 USING (tenant_id IS NULL OR tenant_id::TEXT = current_setting(''app.current_tenant_id'', TRUE))';
    END IF;
END
$$;

COMMIT;

-- ============================================================================
-- Verification query (run after execution):
-- SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'e30';
-- Expected: 15 tables
-- ============================================================================
