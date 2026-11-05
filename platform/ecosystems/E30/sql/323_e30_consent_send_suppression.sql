-- 323_e30_consent_ledger.sql
-- E30 Email: Consent ledger + suppression list + send log
-- Source: SECTION_7_E30_EMAIL_ENTERPRISE_DESIGN.md + EMAIL_DELIVERABILITY_ARCHITECTURE.md
-- Canary: cluster_id 372171 = 147 / $332,631.30
-- Author: Claude (claude.ai) | Date: 2026-06-18
-- cluster_id = INTEGER (canon 2026-06-15)

BEGIN;

CREATE SCHEMA IF NOT EXISTS e30;

-- ============================================================
-- TABLE 1: e30.consent_ledger
-- CAN-SPAM + TCPA consent tracking. Source of truth for opt-in.
-- ============================================================
CREATE TABLE IF NOT EXISTS e30.consent_ledger (
    email               TEXT NOT NULL,
    cluster_id          INTEGER,
    rnc_regid           TEXT,
    channel             TEXT NOT NULL DEFAULT 'email',
    consent_source      TEXT NOT NULL,
    opted_in_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_ip           TEXT,
    source_url          TEXT,
    double_opt_in_sent  BOOLEAN DEFAULT FALSE,
    double_opt_in_confirmed BOOLEAN DEFAULT FALSE,
    double_opt_in_at    TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    revoke_source       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (email, channel)
);

COMMENT ON TABLE e30.consent_ledger IS 'CAN-SPAM/TCPA consent record. Every opt-in must have source + timestamp. Revocation is permanent per scope. Gate 3 in EnterpriseEmailSender.';

CREATE INDEX IF NOT EXISTS idx_consent_cluster
    ON e30.consent_ledger (cluster_id)
    WHERE cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consent_rnc
    ON e30.consent_ledger (rnc_regid)
    WHERE rnc_regid IS NOT NULL;

-- ============================================================
-- TABLE 2: e30.suppression_list
-- Platform-wide + per-tenant suppression. Check BEFORE any send.
-- Reasons: HARD_BOUNCE, COMPLAINT, UNSUBSCRIBE, MANUAL
-- ============================================================
CREATE TABLE IF NOT EXISTS e30.suppression_list (
    email               TEXT NOT NULL,
    reason              TEXT NOT NULL CHECK (reason IN ('HARD_BOUNCE','COMPLAINT','UNSUBSCRIBE','MANUAL')),
    source_send_id      TEXT,
    candidate_id        UUID,
    scope               TEXT NOT NULL DEFAULT 'global',
    permanent           BOOLEAN NOT NULL DEFAULT TRUE,
    suppressed_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (email, scope)
);

COMMENT ON TABLE e30.suppression_list IS 'Deliverability architecture: hard bounces, complaints, unsubscribes. Global scope = platform-wide block. Per-tenant scope = candidate_id. Gate 2 in EnterpriseEmailSender.';

CREATE INDEX IF NOT EXISTS idx_suppression_reason
    ON e30.suppression_list (reason);

CREATE INDEX IF NOT EXISTS idx_suppression_candidate
    ON e30.suppression_list (candidate_id)
    WHERE candidate_id IS NOT NULL;

-- ============================================================
-- TABLE 3: e30.send_log
-- Every email sent or blocked. Audit trail + ML feedback source.
-- ============================================================
CREATE TABLE IF NOT EXISTS e30.send_log (
    send_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID,
    candidate_id        UUID,
    cluster_id          INTEGER,
    recipient_email     TEXT NOT NULL,
    channel_code        TEXT NOT NULL DEFAULT 'EMAIL_PERSONAL',
    -- Gate results
    match_tier          TEXT,
    gate_passed         BOOLEAN NOT NULL,
    blocked_by          TEXT,
    -- Send details
    template_id         TEXT,
    subject_line        TEXT,
    personalization_vars JSONB DEFAULT '{}'::JSONB,
    is_fundraising      BOOLEAN DEFAULT FALSE,
    -- Delivery
    provider            TEXT DEFAULT 'sendgrid',
    provider_message_id TEXT,
    sent_at             TIMESTAMPTZ,
    delivered           BOOLEAN,
    -- Engagement (updated via webhook)
    opened_at           TIMESTAMPTZ,
    clicked_at          TIMESTAMPTZ,
    bounced             BOOLEAN DEFAULT FALSE,
    bounce_type         TEXT,
    complained          BOOLEAN DEFAULT FALSE,
    unsubscribed        BOOLEAN DEFAULT FALSE,
    -- Cost
    cost_cents          INTEGER DEFAULT 12,
    -- Metadata
    pattern_code        TEXT,
    stop_codes          TEXT[],
    force_sent          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE e30.send_log IS 'Every email attempt. gate_passed=false means blocked before provider call (no cost). Webhooks update opened_at/clicked_at/bounced/complained/unsubscribed.';

CREATE INDEX IF NOT EXISTS idx_sendlog_campaign
    ON e30.send_log (campaign_id)
    WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sendlog_cluster
    ON e30.send_log (cluster_id)
    WHERE cluster_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sendlog_candidate
    ON e30.send_log (candidate_id)
    WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sendlog_sent
    ON e30.send_log (sent_at)
    WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sendlog_blocked
    ON e30.send_log (blocked_by)
    WHERE blocked_by IS NOT NULL;

-- ============================================================
-- TABLE 4: e30.ip_warmup_schedule
-- Per-pool daily send caps for cold-start ramp
-- ============================================================
CREATE TABLE IF NOT EXISTS e30.ip_warmup_schedule (
    pool_code           TEXT NOT NULL,
    day_number          INTEGER NOT NULL,
    daily_cap           INTEGER NOT NULL,
    PRIMARY KEY (pool_code, day_number)
);

INSERT INTO e30.ip_warmup_schedule (pool_code, day_number, daily_cap) VALUES
('C', 1, 50), ('C', 2, 100), ('C', 3, 200), ('C', 4, 400),
('C', 5, 700), ('C', 6, 1000), ('C', 7, 1000),
('C', 8, 2000), ('C', 9, 3000), ('C', 10, 5000),
('C', 11, 7000), ('C', 12, 10000), ('C', 13, 10000), ('C', 14, 10000),
('C', 15, 15000), ('C', 18, 20000), ('C', 21, 25000),
('C', 25, 35000), ('C', 30, 50000)
ON CONFLICT (pool_code, day_number) DO NOTHING;

-- ============================================================
-- TABLE 5: e30.sending_domain_config
-- Per-tenant sending identity (Model A or B from deliverability arch)
-- ============================================================
CREATE TABLE IF NOT EXISTS e30.sending_domain_config (
    candidate_id        UUID PRIMARY KEY,
    sending_model       TEXT NOT NULL CHECK (sending_model IN ('candidate_owned','platform_hosted')),
    sending_subdomain   TEXT NOT NULL,
    from_name           TEXT NOT NULL,
    from_email          TEXT NOT NULL,
    reply_to_email      TEXT,
    physical_address    TEXT NOT NULL,
    paid_for_by         TEXT,
    not_authorized      BOOLEAN DEFAULT FALSE,
    ip_pool             TEXT NOT NULL DEFAULT 'C',
    pool_start_date     DATE,
    spf_verified        BOOLEAN DEFAULT FALSE,
    dkim_verified       BOOLEAN DEFAULT FALSE,
    dmarc_verified      BOOLEAN DEFAULT FALSE,
    active              BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE e30.sending_domain_config IS 'Per-tenant sending identity. Model A = candidate_owned (delegated subdomain). Model B = platform_hosted (<slug>.send.ncfirst.org). physical_address is CAN-SPAM mandatory.';

DO $$
BEGIN
  RAISE NOTICE 'e30.consent_ledger: created';
  RAISE NOTICE 'e30.suppression_list: created';
  RAISE NOTICE 'e30.send_log: created + 5 indexes';
  RAISE NOTICE 'e30.ip_warmup_schedule: created + 19 rows seeded';
  RAISE NOTICE 'e30.sending_domain_config: created';
END $$;

ROLLBACK;
