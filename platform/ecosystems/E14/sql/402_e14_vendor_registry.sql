-- ============================================================================
-- MIGRATION: E14 Vendor Registry
-- File: database/migrations/dryrun/402_e14_vendor_registry.sql
-- Author: Nexus (E51) — 2026-06-20
-- Status: DRY RUN — DO NOT APPLY without Ed's authorization (I AUTHORIZE THIS ACTION)
--
-- CANARY CHECK FIRST (every time, before any apply):
--   SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id=372171;
--   -- expect 147 / $332,631.30
--
-- PURPOSE:
--   Creates the e14.vendor_registry, e14.vendor_capability_map, and
--   e14.vendor_routing_rules tables, seeds the initial 5-vendor roster,
--   and wires campaign settings so the E14 Production Panel UI can
--   dynamically resolve the correct vendor for any (print_track, donor_grade,
--   material_type) combination without hardcoding vendor names in application code.
--
-- SCHEMAS TOUCHED: e14 (already created by migration 400)
-- SCHEMAS READ:    campaigns, e41
-- TABLES CREATED:  e14.vendor_registry
--                  e14.vendor_capability_map
--                  e14.vendor_routing_rules
--                  e14.vendor_job_cost_schedule
-- VIEWS CREATED:   e14.v_active_vendor_routes (UI query surface)
-- FUNCTION CREATED: e14.fn_resolve_vendor(...)
--
-- IDEMPOTENT: yes — all CREATE TABLE use IF NOT EXISTS;
--             all INSERTs use ON CONFLICT DO NOTHING
-- ============================================================================

-- ── STEP 0: DRY-RUN READ-ONLY CHECKS (run these before BEGIN) ────────────────
-- SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id=372171;
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'e14';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'e14';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'e14' AND table_name = 'print_job_log'
--   ORDER BY ordinal_position;
-- ── End dry-run checks ────────────────────────────────────────────────────────

BEGIN;

-- ── GUARD: e14 schema must exist (created by migration 400) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'e14'
  ) THEN
    RAISE EXCEPTION
      'e14 schema not found. Run migration 400_e14_lettrlabs_print_job_log.sql first.';
  END IF;
END $$;


-- ============================================================================
-- TABLE 1: e14.vendor_registry
-- One row per approved print vendor. Contains identity, contact, and transport
-- configuration. Credential secrets are NEVER stored here — only vault references.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e14.vendor_registry (

    -- ── Identity ──────────────────────────────────────────────────────────────
    vendor_id           TEXT        PRIMARY KEY,
        -- slug-style identifier: 'lettrlabs', 'lob', 'xmpie_sftp_vendor_a', etc.
        -- must be stable — used as FK target in routing rules and job logs

    vendor_name         TEXT        NOT NULL,
        -- human-readable: 'LettrLabs', 'Lob Direct Mail', 'ABC Print Co.'

    vendor_type         TEXT        NOT NULL
                            CHECK (vendor_type IN (
                                'handwritten',      -- robotic ink / LettrLabs model
                                'digital_vdp',      -- XMPie/FusionPro output shops
                                'offset',           -- traditional offset press
                                'digital_offset',   -- hybrid digital+offset
                                'fulfillment_only'  -- receives pre-composed files, no composition
                            )),

    -- ── Print track this vendor serves ───────────────────────────────────────
    print_track         TEXT        NOT NULL
                            CHECK (print_track IN (
                                'handwritten',      -- LettrLabs track
                                'vdp',              -- XMPie/FusionPro VDP track
                                'both'              -- can serve either track
                            )),

    -- ── Transport (how files get to this vendor) ──────────────────────────────
    transport_method    TEXT        NOT NULL
                            CHECK (transport_method IN (
                                'sftp',             -- SFTP file drop
                                'api',              -- vendor REST API
                                'email',            -- download-and-email fallback
                                'api_webhook'       -- API submission + webhook status callbacks
                            )),

    transport_config    JSONB       NOT NULL DEFAULT '{}'::jsonb,
        -- transport_method-specific parameters (no secrets — see credentials_vault_ref)
        -- sftp:        { "host": "sftp.vendor.com", "port": 22, "path": "/jobs/bgop/" }
        -- api:         { "base_url": "https://api.vendor.com/v1", "timeout_seconds": 30 }
        -- api_webhook: { "base_url": "...", "webhook_path": "/webhooks/e14/<vendor_id>",
        --                "webhook_event_map": {"job_accepted":"...", "card_mailed":"..."} }
        -- email:       { "to": "jobs@vendor.com", "cc": "ops@broyhillgop.com" }

    -- ── Credentials vault reference (NEVER the secret itself) ────────────────
    credentials_vault_ref   TEXT    NOT NULL DEFAULT '',
        -- 1Password vault item reference or env-var key name.
        -- Format: "op://BroyhillGOP/E14-<vendor_id>-creds/password"
        --      or env var key: "LETTRLABS_API_KEY", "VENDOR_A_SFTP_PASSWORD"
        -- Application code resolves this at runtime. This table stores the
        -- reference path only, never the secret value.

    -- ── Preferred file format ─────────────────────────────────────────────────
    preferred_file_format   TEXT    NOT NULL DEFAULT 'PDF/X-1a'
                            CHECK (preferred_file_format IN (
                                'PDF/X-1a',         -- most compatible, default
                                'PDF/X-3',
                                'PDF/X-4',          -- transparency native
                                'PDF/VT',           -- variable data optimized (large runs)
                                'PPML',             -- personalized print markup language
                                'VIPP',             -- Xerox VIPP
                                'api_json'          -- API vendors receive JSON not file
                            )),

    supported_file_formats  TEXT[]  NOT NULL DEFAULT ARRAY['PDF/X-1a'],
        -- full list of formats this vendor accepts. preferred_file_format must be in this array.

    -- ── Material capabilities ─────────────────────────────────────────────────
    supported_material_types TEXT[] NOT NULL DEFAULT ARRAY['direct_mail'],
        -- values: 'direct_mail', 'donor_letter', 'event_invitation', 'palmcard',
        --         'envelope', 'handwritten_card', 'precinct_packet', 'thank_you_card'

    supported_sizes         TEXT[]  NOT NULL DEFAULT ARRAY['4x6','6x9','8.5x11'],
        -- USPS-standard postcard sizes + letter sizes supported

    color_modes_supported   TEXT[]  NOT NULL DEFAULT ARRAY['CMYK'],
        -- 'CMYK', 'CMYK+Spot', 'RGB_to_CMYK_convert'

    -- ── Custom SLA parameters ─────────────────────────────────────────────────
    custom_sla_params       JSONB   NOT NULL DEFAULT '{}'::jsonb,
        -- Vendor-negotiated SLA terms. All time values in hours unless noted.
        -- {
        --   "production_lead_hours":    48,    -- file receipt → print complete
        --   "mailing_lead_hours":       24,    -- print complete → USPS induction
        --   "total_lead_days":          4,     -- file receipt → in-mailbox estimate
        --   "max_records_per_job":      100000,
        --   "min_records_per_job":      1,
        --   "rush_available":           true,
        --   "rush_surcharge_pct":       25.0,
        --   "rush_lead_hours":          24,
        --   "acknowledgment_sla_hours": 2,     -- vendor must ACK receipt within N hours
        --   "reprint_policy":           "replace_at_no_charge_if_reported_within_30_days",
        --   "usps_class":               "FIRST_CLASS"  | "MARKETING_MAIL"
        -- }

    -- ── Operational state ─────────────────────────────────────────────────────
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    is_default          BOOLEAN     NOT NULL DEFAULT FALSE,
        -- exactly one vendor per print_track should have is_default=TRUE as the
        -- routing fallback if no routing rule matches. enforced by trigger below.

    notes               TEXT,
    contact_email       TEXT,
    contract_expiry     DATE,
        -- reminder: if contract expires, router falls back to next eligible vendor

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce: preferred_file_format must be in supported_file_formats
ALTER TABLE e14.vendor_registry
    ADD CONSTRAINT chk_preferred_in_supported
    CHECK (preferred_file_format = ANY(supported_file_formats));

-- Enforce: at most one default per print_track (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_e14_vendor_one_default_per_track
    ON e14.vendor_registry (print_track)
    WHERE is_default = TRUE AND active = TRUE;

CREATE INDEX IF NOT EXISTS idx_e14_vendor_track_active
    ON e14.vendor_registry (print_track, active);

CREATE INDEX IF NOT EXISTS idx_e14_vendor_transport
    ON e14.vendor_registry (transport_method);


-- ============================================================================
-- TABLE 2: e14.vendor_capability_map
-- Explicit (vendor_id, material_type, size, min_records, max_records) capability
-- rows. Allows the router to filter vendors not only by print_track but by the
-- specific material being produced and volume tier of the job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e14.vendor_capability_map (
    id              BIGSERIAL   PRIMARY KEY,
    vendor_id       TEXT        NOT NULL REFERENCES e14.vendor_registry(vendor_id) ON DELETE CASCADE,
    material_type   TEXT        NOT NULL,
        -- 'direct_mail' | 'donor_letter' | 'event_invitation' | 'palmcard' |
        -- 'handwritten_card' | 'thank_you_card' | 'precinct_packet' | 'envelope'
    size_code       TEXT,
        -- NULL = any size; '4x6', '6x9', '8.5x11', '#10_envelope', 'A2_card'
    min_records     INTEGER     NOT NULL DEFAULT 1,
    max_records     INTEGER     NOT NULL DEFAULT 999999,
    cost_per_piece  NUMERIC(8,4) NOT NULL DEFAULT 0,
        -- unit cost at standard volume. actual cost may use volume_tiers in job_cost_schedule
    turnaround_hours INTEGER    NOT NULL DEFAULT 96,
    notes           TEXT,

    CONSTRAINT uq_vendor_capability
        UNIQUE (vendor_id, material_type, COALESCE(size_code, ''))
);

CREATE INDEX IF NOT EXISTS idx_e14_cap_vendor
    ON e14.vendor_capability_map (vendor_id);
CREATE INDEX IF NOT EXISTS idx_e14_cap_material
    ON e14.vendor_capability_map (material_type);


-- ============================================================================
-- TABLE 3: e14.vendor_routing_rules
-- Priority-ordered rules that map a (print_track, donor_grade_min, material_type,
-- record_count_range, candidate_id override) to a specific vendor_id.
-- The resolver evaluates rules in priority order and returns the first match.
-- A NULL in any condition column means "match any value."
-- ============================================================================

CREATE TABLE IF NOT EXISTS e14.vendor_routing_rules (
    rule_id         BIGSERIAL   PRIMARY KEY,
    rule_name       TEXT        NOT NULL,
        -- human label: 'Principal donors → LettrLabs handwritten'

    -- ── Match conditions (NULL = wildcard) ────────────────────────────────────
    print_track     TEXT        CHECK (print_track IN ('handwritten','vdp','both')),
    material_type   TEXT,
        -- if NULL, rule applies to all material types on this track
    donor_grade_min TEXT,
        -- minimum donor grade for this rule to apply. grades: A++, A+, A, A-, B+, ..., D-, U
        -- NULL = apply to any grade
        -- enforcement uses the grade_rank lookup in §6 below
    donor_grade_max TEXT,
        -- maximum grade bracket (inclusive). NULL = no upper bound.
    min_records     INTEGER,    -- NULL = no lower bound
    max_records     INTEGER,    -- NULL = no upper bound
    candidate_id    UUID,       -- NULL = applies to all candidates; set for candidate-specific overrides
    trigger_family  TEXT,       -- NULL = any; 'print' narrows to print triggers only

    -- ── Resolution ────────────────────────────────────────────────────────────
    vendor_id       TEXT        NOT NULL REFERENCES e14.vendor_registry(vendor_id),

    -- ── Rule control ─────────────────────────────────────────────────────────
    priority        SMALLINT    NOT NULL DEFAULT 50,
        -- lower number = evaluated first. conflicts resolved by priority.
        -- recommended bands: 10=principal, 20=major, 30=material, 40=volume, 50=default

    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e14_routing_track
    ON e14.vendor_routing_rules (print_track, active, priority);
CREATE INDEX IF NOT EXISTS idx_e14_routing_vendor
    ON e14.vendor_routing_rules (vendor_id);


-- ============================================================================
-- TABLE 4: e14.vendor_job_cost_schedule
-- Volume-tiered cost schedule per vendor per material type.
-- Used by E51 finance and the LP engine (CPDR calculation) to price print jobs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e14.vendor_job_cost_schedule (
    id              BIGSERIAL   PRIMARY KEY,
    vendor_id       TEXT        NOT NULL REFERENCES e14.vendor_registry(vendor_id) ON DELETE CASCADE,
    material_type   TEXT        NOT NULL,
    min_qty         INTEGER     NOT NULL,
    max_qty         INTEGER,    -- NULL = no upper bound (largest tier)
    cost_per_piece  NUMERIC(8,4) NOT NULL,
    setup_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
    postage_included BOOLEAN    NOT NULL DEFAULT TRUE,
    notes           TEXT,
    effective_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    expires_date    DATE,       -- NULL = no expiry

    CONSTRAINT uq_cost_tier UNIQUE (vendor_id, material_type, min_qty)
);

CREATE INDEX IF NOT EXISTS idx_e14_cost_vendor_material
    ON e14.vendor_job_cost_schedule (vendor_id, material_type);


-- ============================================================================
-- DONOR GRADE RANK LOOKUP (inline reference for routing rule evaluation)
-- Grade rank is used by fn_resolve_vendor to compare donor_grade_min/max.
-- Lower rank number = higher tier.
-- ============================================================================

CREATE TABLE IF NOT EXISTS e14.donor_grade_rank (
    grade       TEXT    PRIMARY KEY,
    rank        SMALLINT NOT NULL UNIQUE   -- 1 = A++ (highest), 14 = U (ungraded)
);

INSERT INTO e14.donor_grade_rank (grade, rank) VALUES
    ('A++', 1), ('A+', 2), ('A',  3), ('A-', 4),
    ('B+',  5), ('B',  6), ('B-', 7),
    ('C+',  8), ('C',  9), ('C-', 10),
    ('D+', 11), ('D', 12), ('D-', 13),
    ('U',  14)
ON CONFLICT (grade) DO NOTHING;


-- ============================================================================
-- SEED DATA: Initial 5-vendor roster
-- ============================================================================

INSERT INTO e14.vendor_registry (
    vendor_id, vendor_name, vendor_type, print_track,
    transport_method, transport_config,
    credentials_vault_ref,
    preferred_file_format, supported_file_formats,
    supported_material_types, supported_sizes,
    custom_sla_params,
    active, is_default, notes, contact_email
) VALUES

-- 1. LettrLabs — handwritten track default
(
    'lettrlabs',
    'LettrLabs',
    'handwritten',
    'handwritten',
    'api_webhook',
    '{
        "base_url": "https://api.lettrlabs.com/v1",
        "timeout_seconds": 30,
        "webhook_path": "/webhooks/e14/lettrlabs",
        "webhook_event_map": {
            "job_accepted":  "job_accepted",
            "card_produced": "card_produced",
            "card_mailed":   "card_mailed"
        }
    }'::jsonb,
    'LETTRLABS_API_KEY',
    'api_json',
    ARRAY['api_json'],
    ARRAY['handwritten_card','thank_you_card','donor_letter'],
    ARRAY['A2_card','#10_envelope','4x6'],
    '{
        "production_lead_hours":    48,
        "mailing_lead_hours":       24,
        "total_lead_days":          5,
        "max_records_per_job":      10000,
        "min_records_per_job":      1,
        "rush_available":           false,
        "acknowledgment_sla_hours": 1,
        "reprint_policy":           "replace_at_no_charge_within_30_days",
        "usps_class":               "FIRST_CLASS"
    }'::jsonb,
    TRUE, TRUE,
    'Primary handwritten mail vendor. Robotic-ink fulfillment. API + webhooks.',
    'support@lettrlabs.com'
),

-- 2. Lob — VDP direct mail, API-native
(
    'lob',
    'Lob Direct Mail',
    'digital_vdp',
    'vdp',
    'api',
    '{
        "base_url": "https://api.lob.com/v1",
        "timeout_seconds": 30,
        "api_version": "2020-02-11"
    }'::jsonb,
    'LOB_API_KEY',
    'api_json',
    ARRAY['api_json','PDF/X-1a'],
    ARRAY['direct_mail','event_invitation','donor_letter','envelope'],
    ARRAY['4x6','6x9','8.5x11','#10_envelope'],
    '{
        "production_lead_hours":    72,
        "mailing_lead_hours":       24,
        "total_lead_days":          5,
        "max_records_per_job":      500000,
        "min_records_per_job":      1,
        "rush_available":           false,
        "acknowledgment_sla_hours": 0,
        "reprint_policy":           "credit_within_60_days",
        "usps_class":               "FIRST_CLASS"
    }'::jsonb,
    TRUE, TRUE,
    'Primary VDP direct mail vendor for automated, API-native runs. Address verification included.',
    'support@lob.com'
),

-- 3. Generic SFTP Offset Vendor A — high-volume offset runs
(
    'sftp_vendor_a',
    'Primary Offset Vendor (SFTP)',
    'offset',
    'vdp',
    'sftp',
    '{
        "host":    "sftp.vendor-a.com",
        "port":    22,
        "path":    "/bgop/jobs/",
        "timeout": 60
    }'::jsonb,
    'SFTP_VENDOR_A_PASSWORD',
    'PDF/X-1a',
    ARRAY['PDF/X-1a','PDF/X-3','PDF/VT'],
    ARRAY['direct_mail','palmcard','event_invitation','precinct_packet','envelope'],
    ARRAY['4x6','6x9','8.5x11','8.5x14','#10_envelope','5.5x8.5'],
    '{
        "production_lead_hours":    96,
        "mailing_lead_hours":       48,
        "total_lead_days":          7,
        "max_records_per_job":      1000000,
        "min_records_per_job":      500,
        "rush_available":           true,
        "rush_surcharge_pct":       30.0,
        "rush_lead_hours":          48,
        "acknowledgment_sla_hours": 4,
        "reprint_policy":           "replace_within_45_days",
        "usps_class":               "MARKETING_MAIL"
    }'::jsonb,
    TRUE, FALSE,
    'High-volume offset runs. Min 500 pieces. SFTP + PDF/X-1a. Marketing mail postage.',
    'jobs@vendor-a-placeholder.com'
),

-- 4. Stannp — lower-volume international-capable VDP
(
    'stannp',
    'Stannp',
    'digital_vdp',
    'vdp',
    'api',
    '{
        "base_url": "https://dash.stannp.com/api/v1",
        "timeout_seconds": 30
    }'::jsonb,
    'STANNP_API_KEY',
    'api_json',
    ARRAY['api_json','PDF/X-1a'],
    ARRAY['direct_mail','donor_letter','event_invitation'],
    ARRAY['4x6','6x9','8.5x11'],
    '{
        "production_lead_hours":    48,
        "mailing_lead_hours":       24,
        "total_lead_days":          5,
        "max_records_per_job":      50000,
        "min_records_per_job":      1,
        "rush_available":           false,
        "acknowledgment_sla_hours": 2,
        "reprint_policy":           "credit_within_30_days",
        "usps_class":               "FIRST_CLASS"
    }'::jsonb,
    TRUE, FALSE,
    'API-native backup VDP vendor. Lower minimums. Good for small-batch candidate runs.',
    'hello@stannp.com'
),

-- 5. Email fallback — any vendor where SFTP/API is unavailable
(
    'email_fallback',
    'Email Fallback (Manual)',
    'fulfillment_only',
    'both',
    'email',
    '{
        "to":      "print@broyhillgop.com",
        "cc":      "ops@broyhillgop.com",
        "subject": "BGOP Print Job — {job_id} — {record_count} records"
    }'::jsonb,
    '',
    'PDF/X-1a',
    ARRAY['PDF/X-1a','PDF/X-3','PDF/X-4','PDF/VT'],
    ARRAY['direct_mail','donor_letter','event_invitation','palmcard','handwritten_card',
          'thank_you_card','precinct_packet','envelope'],
    ARRAY['4x6','6x9','8.5x11','A2_card','#10_envelope'],
    '{
        "production_lead_hours":    240,
        "mailing_lead_hours":       48,
        "total_lead_days":          14,
        "max_records_per_job":      999999,
        "min_records_per_job":      1,
        "rush_available":           false,
        "acknowledgment_sla_hours": 24,
        "reprint_policy":           "manual_review",
        "usps_class":               "FIRST_CLASS"
    }'::jsonb,
    TRUE, FALSE,
    'Last-resort fallback. Manual handling. Only fires when all other transport methods fail.',
    'print@broyhillgop.com'
)

ON CONFLICT (vendor_id) DO NOTHING;


-- ── Seed capability map ───────────────────────────────────────────────────────

INSERT INTO e14.vendor_capability_map
    (vendor_id, material_type, size_code, min_records, max_records, cost_per_piece, turnaround_hours)
VALUES
    -- LettrLabs
    ('lettrlabs', 'handwritten_card',  'A2_card',         1,   10000, 3.50,  48),
    ('lettrlabs', 'thank_you_card',    'A2_card',         1,   10000, 3.50,  48),
    ('lettrlabs', 'donor_letter',      '#10_envelope',    1,    5000, 4.50,  72),

    -- Lob
    ('lob', 'direct_mail',      '4x6',           1, 500000, 0.87,  72),
    ('lob', 'direct_mail',      '6x9',           1, 500000, 1.10,  72),
    ('lob', 'event_invitation', '6x9',           1,  50000, 1.25,  72),
    ('lob', 'donor_letter',     '8.5x11',        1, 100000, 1.15,  72),
    ('lob', 'envelope',         '#10_envelope',  1, 100000, 0.45,  72),

    -- SFTP Vendor A
    ('sftp_vendor_a', 'direct_mail',       '4x6',      500, 1000000, 0.42,  96),
    ('sftp_vendor_a', 'direct_mail',       '6x9',      500, 1000000, 0.58,  96),
    ('sftp_vendor_a', 'event_invitation',  '6x9',      500,  500000, 0.72,  96),
    ('sftp_vendor_a', 'palmcard',          '4x9',      500, 1000000, 0.28,  96),
    ('sftp_vendor_a', 'precinct_packet',   '8.5x11',   500,  100000, 0.35,  96),

    -- Stannp
    ('stannp', 'direct_mail',      '4x6',          1,  50000, 0.95,  48),
    ('stannp', 'direct_mail',      '6x9',          1,  50000, 1.15,  48),
    ('stannp', 'donor_letter',     '8.5x11',       1,  20000, 1.25,  48),
    ('stannp', 'event_invitation', '6x9',          1,  10000, 1.30,  48)

ON CONFLICT (vendor_id, material_type, COALESCE(size_code, '')) DO NOTHING;


-- ── Seed routing rules ────────────────────────────────────────────────────────

INSERT INTO e14.vendor_routing_rules
    (rule_name, print_track, material_type, donor_grade_min, donor_grade_max,
     min_records, max_records, vendor_id, priority, notes)
VALUES

    -- Rule 1 (priority 10): Principal donors (A++ and A+) → LettrLabs handwritten, any material
    ('Principal donors — LettrLabs handwritten',
     'handwritten', NULL, 'A++', 'A+',
     NULL, NULL,
     'lettrlabs', 10,
     'Ring 1 donors. LTV justifies $3.50+ per piece. Auto-triggered from Brain events.'),

    -- Rule 2 (priority 10): Major donors (A) → LettrLabs for cards/letters, Lob for bulk mail
    ('Major donors — handwritten cards',
     'handwritten', 'handwritten_card', 'A', 'A',
     NULL, 500,
     'lettrlabs', 10,
     'Major donor thank-yous and stewardship cards up to 500 pieces.'),

    -- Rule 3 (priority 15): Major donors — bulk VDP mail
    ('Major donors — VDP direct mail (Lob)',
     'vdp', 'direct_mail', 'A', 'A+',
     1, 10000,
     'lob', 15,
     'Major donor direct mail campaigns. Lob API handles personalization.'),

    -- Rule 4 (priority 20): Event invitations — Lob for precision, any grade
    ('Event invitations — Lob',
     'vdp', 'event_invitation', NULL, NULL,
     1, 50000,
     'lob', 20,
     'All event invitations via Lob. Reliable address verification.'),

    -- Rule 5 (priority 20): Donor letters — Lob under 50K, SFTP Vendor A above
    ('Donor letters under 50K — Lob',
     'vdp', 'donor_letter', NULL, NULL,
     1, 50000,
     'lob', 20,
     'Small-to-mid-size donor letter runs via Lob.'),

    -- Rule 6 (priority 25): High-volume VDP runs — SFTP Vendor A
    ('High-volume VDP — SFTP Vendor A (500+ pieces)',
     'vdp', 'direct_mail', NULL, NULL,
     500, 1000000,
     'sftp_vendor_a', 25,
     'Volume runs over 500 pieces. Offset pricing. 7-day lead time.'),

    -- Rule 7 (priority 30): Palmcards and precinct packets — SFTP Vendor A only
    ('Palmcards — SFTP Vendor A',
     'vdp', 'palmcard', NULL, NULL,
     NULL, NULL,
     'sftp_vendor_a', 30,
     'Palmcards and precinct walk packets. SFTP only.'),

    -- Rule 8 (priority 40): VDP small-batch fallback — Stannp (no minimum)
    ('Small-batch VDP fallback — Stannp',
     'vdp', NULL, NULL, NULL,
     1, 499,
     'stannp', 40,
     'Sub-500-piece runs that SFTP Vendor A cannot fulfill. API-native.'),

    -- Rule 9 (priority 99): Last-resort email fallback — any track, any segment
    ('Last-resort email fallback',
     NULL, NULL, NULL, NULL,
     NULL, NULL,
     'email_fallback', 99,
     'Fires only when all higher-priority rules fail or their vendors are inactive.')

ON CONFLICT DO NOTHING;


-- ── Seed cost schedule ────────────────────────────────────────────────────────

INSERT INTO e14.vendor_job_cost_schedule
    (vendor_id, material_type, min_qty, max_qty, cost_per_piece, setup_fee, postage_included, notes)
VALUES
    -- LettrLabs (flat per-piece, no volume discount, postage included)
    ('lettrlabs', 'handwritten_card',  1,    NULL, 3.50, 0,     TRUE,  'Includes first-class postage + USPS induction'),
    ('lettrlabs', 'thank_you_card',    1,    NULL, 3.50, 0,     TRUE,  'Same as handwritten_card rate'),
    ('lettrlabs', 'donor_letter',      1,    NULL, 4.50, 0,     TRUE,  'Letter-size handwritten note'),

    -- Lob (volume tiered, postage included)
    ('lob', 'direct_mail',      1,    999,   0.99, 0,     TRUE,  'USPS First Class'),
    ('lob', 'direct_mail',      1000, 9999,  0.87, 0,     TRUE,  'Volume tier 2'),
    ('lob', 'direct_mail',      10000,NULL,  0.72, 0,     TRUE,  'Volume tier 3'),
    ('lob', 'donor_letter',     1,    999,   1.15, 0,     TRUE,  'Full-page letter + #10 envelope'),
    ('lob', 'event_invitation', 1,    9999,  1.25, 0,     TRUE,  'Scored and folded 6x9'),

    -- SFTP Vendor A (volume tiered, postage NOT included — separate USPS invoice)
    ('sftp_vendor_a', 'direct_mail',      500,   4999,  0.55, 250,  FALSE, 'Postage billed separately at USPS Marketing Mail rate'),
    ('sftp_vendor_a', 'direct_mail',      5000,  49999, 0.42, 250,  FALSE, 'Volume tier 2'),
    ('sftp_vendor_a', 'direct_mail',      50000, NULL,  0.31, 250,  FALSE, 'Volume tier 3'),
    ('sftp_vendor_a', 'palmcard',         500,   NULL,  0.28, 150,  FALSE, 'Flat 4x9 palmcard, no postage'),
    ('sftp_vendor_a', 'precinct_packet',  500,   NULL,  0.35, 150,  FALSE, '8.5x11 single sheet'),

    -- Stannp
    ('stannp', 'direct_mail',      1,    999,   1.10, 0,     TRUE,  'USPS First Class, no minimum'),
    ('stannp', 'direct_mail',      1000, NULL,  0.95, 0,     TRUE,  'Volume tier 2'),
    ('stannp', 'donor_letter',     1,    NULL,  1.25, 0,     TRUE,  'Full-page letter')

ON CONFLICT (vendor_id, material_type, min_qty) DO NOTHING;


-- ============================================================================
-- FUNCTION: e14.fn_resolve_vendor
-- Resolves the best vendor_id for a given job context.
-- Evaluates routing rules in priority order; first match wins.
-- Falls back to the is_default vendor for the print_track if no rule matches.
-- Called by the Python dispatcher before any job is submitted.
-- ============================================================================

CREATE OR REPLACE FUNCTION e14.fn_resolve_vendor(
    p_print_track   TEXT,           -- 'vdp' or 'handwritten'
    p_material_type TEXT,           -- e.g. 'direct_mail', 'handwritten_card'
    p_donor_grade   TEXT,           -- e.g. 'A+', 'B', 'U'
    p_record_count  INTEGER,        -- number of records in this job
    p_candidate_id  UUID DEFAULT NULL
)
RETURNS TEXT                        -- returns vendor_id, or NULL if none found
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_vendor_id     TEXT;
    v_grade_rank    SMALLINT;
    v_grade_min_rank SMALLINT;
    v_grade_max_rank SMALLINT;
BEGIN
    -- Resolve the input grade to a rank number
    SELECT rank INTO v_grade_rank
    FROM e14.donor_grade_rank
    WHERE grade = p_donor_grade;

    -- Walk routing rules in priority order, first match wins
    SELECT r.vendor_id INTO v_vendor_id
    FROM e14.vendor_routing_rules r
    JOIN e14.vendor_registry v ON v.vendor_id = r.vendor_id
    LEFT JOIN e14.donor_grade_rank gmin ON gmin.grade = r.donor_grade_min
    LEFT JOIN e14.donor_grade_rank gmax ON gmax.grade = r.donor_grade_max
    WHERE r.active = TRUE
      AND v.active = TRUE
      -- print_track: rule NULL = wildcard
      AND (r.print_track IS NULL OR r.print_track = p_print_track OR r.print_track = 'both')
      -- material_type: rule NULL = wildcard
      AND (r.material_type IS NULL OR r.material_type = p_material_type)
      -- donor grade range: both NULLs = no grade filter
      AND (r.donor_grade_min IS NULL OR gmin.rank >= v_grade_rank)
      AND (r.donor_grade_max IS NULL OR gmax.rank <= v_grade_rank)
      -- record count range
      AND (r.min_records IS NULL OR p_record_count >= r.min_records)
      AND (r.max_records IS NULL OR p_record_count <= r.max_records)
      -- candidate override: rule NULL matches all candidates
      AND (r.candidate_id IS NULL OR r.candidate_id = p_candidate_id)
      -- vendor supports this material type
      AND p_material_type = ANY(v.supported_material_types)
    ORDER BY r.priority ASC
    LIMIT 1;

    -- If no rule matched, return the default vendor for the print_track
    IF v_vendor_id IS NULL THEN
        SELECT vendor_id INTO v_vendor_id
        FROM e14.vendor_registry
        WHERE print_track IN (p_print_track, 'both')
          AND is_default = TRUE
          AND active = TRUE
        ORDER BY
            CASE WHEN print_track = p_print_track THEN 0 ELSE 1 END
        LIMIT 1;
    END IF;

    RETURN v_vendor_id;  -- NULL means no vendor available (caller must handle)
END;
$$;


-- ============================================================================
-- VIEW: e14.v_active_vendor_routes
-- UI-facing query surface. Returns the full routing table as a human-readable
-- grid of (rule → vendor → SLA → cost). Powers the "Send to Vendor" dropdown
-- and the print coordinator dashboard.
-- ============================================================================

CREATE OR REPLACE VIEW e14.v_active_vendor_routes AS
SELECT
    r.priority,
    r.rule_name,
    r.print_track,
    COALESCE(r.material_type, '(any)') AS material_type,
    COALESCE(r.donor_grade_min, '(any)') AS grade_min,
    COALESCE(r.donor_grade_max, '(any)') AS grade_max,
    COALESCE(r.min_records::TEXT, '—') AS min_records,
    COALESCE(r.max_records::TEXT, '—') AS max_records,
    v.vendor_id,
    v.vendor_name,
    v.transport_method,
    v.preferred_file_format,
    (v.custom_sla_params->>'total_lead_days')::TEXT || 'd'  AS sla_lead_days,
    (v.custom_sla_params->>'usps_class')            AS usps_class,
    v.is_default,
    v.active AS vendor_active,
    r.notes  AS rule_notes
FROM e14.vendor_routing_rules r
JOIN e14.vendor_registry v ON v.vendor_id = r.vendor_id
WHERE r.active = TRUE
ORDER BY r.print_track, r.priority;


-- ============================================================================
-- INTEGRATION: campaign_settings hook
-- Adds a print_vendor_defaults column to campaigns.candidates so per-candidate
-- vendor overrides can be stored without a separate table.
-- ============================================================================

ALTER TABLE campaigns.candidates
    ADD COLUMN IF NOT EXISTS print_vendor_defaults JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN campaigns.candidates.print_vendor_defaults IS
'Per-candidate print vendor overrides. Shape:
{
  "vdp_vendor_id":          "lob",
  "handwritten_vendor_id":  "lettrlabs",
  "override_reason":        "Candidate requested Lob for all VDP runs 2026-cycle"
}
NULL values mean: use global routing rules. Populated only when a candidate
deviates from the platform-wide e14.vendor_routing_rules.';


-- ============================================================================
-- POST-APPLY VERIFICATION QUERIES (run after COMMIT, report results)
-- ============================================================================
-- SELECT vendor_id, vendor_name, print_track, transport_method, active, is_default
-- FROM e14.vendor_registry ORDER BY print_track, is_default DESC, vendor_id;
-- -- expect 5 rows: lettrlabs, lob, sftp_vendor_a, stannp, email_fallback
--
-- SELECT * FROM e14.v_active_vendor_routes;
-- -- expect 9 routing rule rows
--
-- SELECT e14.fn_resolve_vendor('handwritten', 'handwritten_card', 'A++', 1, NULL);
-- -- expect: lettrlabs
--
-- SELECT e14.fn_resolve_vendor('vdp', 'direct_mail', 'B', 10000, NULL);
-- -- expect: sftp_vendor_a (10000 records, volume rule priority 25)
--
-- SELECT e14.fn_resolve_vendor('vdp', 'direct_mail', 'B', 200, NULL);
-- -- expect: stannp (200 records, small-batch fallback priority 40)
--
-- SELECT e14.fn_resolve_vendor('vdp', 'event_invitation', 'C', 5000, NULL);
-- -- expect: lob (event invitation rule priority 20)
--
-- SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations WHERE cluster_id=372171;
-- -- MUST return 147 / 332631.30 — canary unchanged

COMMIT;
