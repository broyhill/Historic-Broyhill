-- ============================================================================
-- E17 RINGLESS VOICEMAIL (RVM) ECOSYSTEM — CORE SCHEMA v1 (DRY RUN — DO NOT EXECUTE)
-- ============================================================================
-- Migration:  E17_RVM_SCHEMA_V1
-- Author:     Devin (session e02dfbc6)
-- Date:       2026-07-07
-- Canary:     cluster_id 372171 = 147 / $332,631.30 (verify BEFORE and AFTER)
-- Protocol:   Two-phase. Awaits Ed's exact phrase `I AUTHORIZE THIS ACTION`.
-- Depends:    E32_CALL_CENTER_SCHEMA_V1 (shares e32.phone_consent_ledger)
-- Sacred:     No sacred-table writes. cluster_id = INTEGER.
--
-- COMPLIANCE NOTE (supersedes the Dec-2024 header in ecosystem_17_rvm.py):
-- The old module claims RVM "isn't a call" and is broadly exempt. That is
-- OUTDATED LAW. FCC's 2022 ringless-voicemail ruling (VoApps/AVEM petition
-- denied) holds that RVM delivered to a WIRELESS number IS a call under TCPA,
-- and prerecorded/AI voice to cells requires prior express consent — political
-- included. Landline mailboxes retain the political prerecorded carve-out
-- (47 CFR 64.1200(a)(3)). E17 therefore rides the SAME consent lanes as E32:
--   mobile -> consent_ai_voice / autodial consent in e32.phone_consent_ledger
--   landline VM -> no-consent political lane
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS e17;

-- ============================================================================
-- 1. TAXONOMIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.drop_status_taxonomy (
    status_code         TEXT        PRIMARY KEY,
    status_group        TEXT        NOT NULL CHECK (status_group IN
                        ('pending','delivered','failed','response','compliance')),
    is_terminal         BOOLEAN     NOT NULL DEFAULT FALSE,
    triggers_fatigue    BOOLEAN     NOT NULL DEFAULT TRUE,
    triggers_bpf        TEXT,
    retry_after_hours   INTEGER,
    description         TEXT
);

CREATE TABLE IF NOT EXISTS e17.purpose_taxonomy (
    purpose_code        TEXT        PRIMARY KEY,   -- fundraising|gotv|event_invite|rsvp_chase|thankyou|persuasion
    fec_disclaimer_required BOOLEAN NOT NULL DEFAULT TRUE,
    description         TEXT
);

-- ============================================================================
-- 2. VENDOR REGISTRY (Slybroadcast / Drop Cowboy / VoiceDrop class)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.vendor_registry (
    vendor_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name         TEXT        NOT NULL UNIQUE,
    adapter_module      TEXT        NOT NULL,        -- e.g. 'e17.adapters.slybroadcast'
    api_base_url        TEXT,
    webhook_signing_key_ref TEXT,                    -- secret NAME only
    cost_per_drop       NUMERIC(6,4),
    max_drops_per_hour  INTEGER     NOT NULL DEFAULT 10000,
    status              TEXT        NOT NULL DEFAULT 'inactive'
                        CHECK (status IN ('inactive','onboarding','active','paused','terminated')),
    kill_switch         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. AUDIO LIBRARY (E16/E48 voice factory output; versioned, approved)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.audio_assets (
    audio_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL,
    purpose_code        TEXT        REFERENCES e17.purpose_taxonomy(purpose_code),
    name                TEXT        NOT NULL,
    version             INTEGER     NOT NULL DEFAULT 1,
    source              TEXT        NOT NULL CHECK (source IN
                        ('candidate_recorded','e16_tts','e16_voice_clone')),
    voice_gate_score    NUMERIC(4,3),                -- E48 Communication DNA gate (>=0.85)
    storage_url         TEXT        NOT NULL,
    duration_seconds    INTEGER     NOT NULL CHECK (duration_seconds BETWEEN 15 AND 90),
    transcript          TEXT        NOT NULL,        -- required for QA + disclaimer check
    disclaimer_present  BOOLEAN     NOT NULL DEFAULT FALSE,  -- paid-for-by embedded in audio
    ai_generated        BOOLEAN     NOT NULL DEFAULT FALSE,
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','approved','retired')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (silo_id, name, version)
);

-- ============================================================================
-- 3a. CANDIDATE PHONE SYSTEM (dial-in: listen to messages, read scripts,
--     record RVM takes, A/B compare vs AI render, publish my-voice/AI-voice)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.candidate_dialin_config (
    config_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL UNIQUE,
    candidate_id        UUID        NOT NULL,
    dialin_number       TEXT        NOT NULL,        -- dedicated candidate DID
    pin_hash            TEXT        NOT NULL,        -- PIN auth (never plaintext)
    allowed_caller_ids  TEXT[],                      -- candidate's registered phones
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e17.script_requests (
    request_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL,
    script_text         TEXT        NOT NULL,        -- E09/E19 drafted, candidate reads on call-in
    purpose             TEXT        NOT NULL CHECK (purpose IN
                        ('voice_training','rvm_publication','tutorial')),
    target_seconds      INTEGER,                     -- desired final duration
    sent_via            TEXT        CHECK (sent_via IN ('sms','email','app_push')),
    status              TEXT        NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','recorded','published','expired')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e17.candidate_recordings (
    recording_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL,
    request_id          UUID        REFERENCES e17.script_requests(request_id),
    take_number         INTEGER     NOT NULL DEFAULT 1,
    storage_url         TEXT        NOT NULL,
    raw_duration_seconds NUMERIC(6,2) NOT NULL,
    fitted_duration_seconds NUMERIC(6,2),            -- after trim / time-stretch (pitch-preserved, <=10%)
    fit_method          TEXT        CHECK (fit_method IN
                        ('none','silence_trim','time_stretch','ai_rerender','script_revision')),
    ai_render_audio_id  UUID        REFERENCES e17.audio_assets(audio_id),  -- A/B comparison twin
    selected_version    TEXT        CHECK (selected_version IN ('my_voice','ai_voice')),  -- press 1 | press 2
    status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','kept','deleted','published')),
    published_audio_id  UUID        REFERENCES e17.audio_assets(audio_id),
    used_for_voice_training BOOLEAN NOT NULL DEFAULT FALSE,  -- feeds E16 clone corpus
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_e17_rec_silo ON e17.candidate_recordings(silo_id, status);

-- ============================================================================
-- 4. CAMPAIGN -> WAVE -> DROP (same parent-child shape as E32)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.rvm_campaigns (
    campaign_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL,
    candidate_id        UUID,
    wizard_run_id       UUID,                        -- E68 launch
    microsegment_id     TEXT,
    purpose_code        TEXT        NOT NULL REFERENCES e17.purpose_taxonomy(purpose_code),
    audio_id            UUID        NOT NULL REFERENCES e17.audio_assets(audio_id),
    ab_variant_audio_id UUID        REFERENCES e17.audio_assets(audio_id),  -- optional A/B
    callback_number     TEXT,                        -- dedicated per-candidate DID (silo boundary, Canon 18)
    callback_routing    TEXT        NOT NULL DEFAULT 'e35_ivr'
                        CHECK (callback_routing IN ('e35_ivr','e32_inbound','staff_line')),
    ivr_config          JSONB,                       -- Canon 18 per-candidate 7-button config
    status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending_authorization','authorized',
                                          'live','paused','completed','killed')),
    authorized_by       TEXT,
    authorized_at       TIMESTAMPTZ,
    fec_review_ref      TEXT,
    scheduled_start     TIMESTAMPTZ,
    scheduled_end       TIMESTAMPTZ,
    throttle_per_hour   INTEGER,                     -- match staff callback capacity
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e17.rvm_waves (
    wave_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID        NOT NULL REFERENCES e17.rvm_campaigns(campaign_id) ON DELETE CASCADE,
    wave_number         INTEGER     NOT NULL,
    heat_snapshot       JSONB,
    compiled_by         TEXT        NOT NULL DEFAULT 'brain_e20',
    drop_count          INTEGER     NOT NULL DEFAULT 0,
    dispatched_at       TIMESTAMPTZ,
    UNIQUE (campaign_id, wave_number)
);

CREATE TABLE IF NOT EXISTS e17.rvm_drops (
    drop_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wave_id             UUID        NOT NULL REFERENCES e17.rvm_waves(wave_id) ON DELETE CASCADE,
    campaign_id         UUID        NOT NULL REFERENCES e17.rvm_campaigns(campaign_id),
    silo_id             TEXT        NOT NULL,
    cluster_id          INTEGER     NOT NULL,
    phone_e164          TEXT        NOT NULL,
    line_type           TEXT,                        -- LRN-dipped; unknown -> treat as mobile
    carrier             TEXT,
    consent_id          UUID,                        -- FK -> e32.phone_consent_ledger (mobile lane)
    audio_id            UUID        NOT NULL REFERENCES e17.audio_assets(audio_id),
    vendor_id           UUID        REFERENCES e17.vendor_registry(vendor_id),
    deliver_window_start TIMESTAMPTZ,
    deliver_window_end  TIMESTAMPTZ,
    status              TEXT        NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','dispatched','delivered','mailbox_full',
                                          'failed','suppressed','expired')),
    status_detail       TEXT,
    dispatched_at       TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_e17_drop_status  ON e17.rvm_drops(status) WHERE status IN ('queued','dispatched');
CREATE INDEX IF NOT EXISTS idx_e17_drop_cluster ON e17.rvm_drops(cluster_id);

-- One in-flight drop per donor per campaign (cross-wave rail)
CREATE UNIQUE INDEX IF NOT EXISTS uq_e17_one_active_drop
    ON e17.rvm_drops(campaign_id, cluster_id)
    WHERE status IN ('queued','dispatched');

-- ============================================================================
-- 4a. AI DAILY CTA RECOMMENDATIONS (Brain-generated RVM campaign options)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.daily_cta_recommendations (
    rec_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    silo_id             TEXT        NOT NULL,
    rec_date            DATE        NOT NULL,
    rank                INTEGER     NOT NULL,        -- 1..10, best first
    trigger_type        TEXT        NOT NULL CHECK (trigger_type IN
                        ('news_heat','legislation','scheduled_event','pledge_chase','anniversary','gotv_window')),
    trigger_ref         TEXT,                        -- news event id / bill number / event id
    headline            TEXT        NOT NULL,        -- one-line CTA pitch shown on the card
    draft_script        TEXT        NOT NULL,        -- E09/E19 pre-drafted
    microsegment_id     TEXT,
    eligible_drop_count INTEGER,
    projected_callbacks INTEGER,
    projected_donations NUMERIC(12,2),
    expected_roi        NUMERIC(8,2),
    heat_snapshot       JSONB,
    status              TEXT        NOT NULL DEFAULT 'offered'
                        CHECK (status IN ('offered','accepted','dismissed','expired','launched')),
    campaign_id         UUID        REFERENCES e17.rvm_campaigns(campaign_id),  -- set on launch
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (silo_id, rec_date, rank)
);
CREATE INDEX IF NOT EXISTS idx_e17_cta_day ON e17.daily_cta_recommendations(silo_id, rec_date, status);

-- ============================================================================
-- 5. RESPONSES (callbacks + text replies -> unified thread + E32 inbound)
-- ============================================================================

CREATE TABLE IF NOT EXISTS e17.rvm_responses (
    response_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    drop_id             UUID        NOT NULL REFERENCES e17.rvm_drops(drop_id),
    response_type       TEXT        NOT NULL CHECK (response_type IN
                        ('callback','text_reply','opt_out','donation_click')),
    ivr_button          SMALLINT    CHECK (ivr_button BETWEEN 0 AND 7),  -- Canon 18: 1 yes|2 no|3 undecided|4 donate|5 staff msg|6 transfer|7 candidate msg|0 opt-out
    brain_event_code    TEXT,                        -- rvm_rsvp_yes .. rvm_candidate_message_left | s_rvm_stop
    e32_task_id         UUID,                        -- button 6 live transfer / button 3 human queue -> e32 task
    reply_text          TEXT,
    occurred_at         TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_e17_resp_drop ON e17.rvm_responses(drop_id);

-- ============================================================================
-- 6. SEEDS
-- ============================================================================

INSERT INTO e17.drop_status_taxonomy
    (status_code, status_group, is_terminal, triggers_fatigue, triggers_bpf, retry_after_hours, description) VALUES
    ('delivered',     'delivered',  TRUE,  TRUE,  NULL,       NULL, 'Deposited to voicemail box'),
    ('mailbox_full',  'failed',     FALSE, FALSE, NULL,       48,   'Retry after mailbox clears'),
    ('failed_carrier','failed',     TRUE,  FALSE, NULL,       NULL, 'Carrier rejected — flag spine'),
    ('bad_number',    'failed',     TRUE,  FALSE, NULL,       NULL, 'Invalid number — flag spine'),
    ('callback',      'response',   TRUE,  TRUE,  'Engaged',  NULL, 'Recipient called back'),
    ('text_reply',    'response',   TRUE,  TRUE,  'Engaged',  NULL, 'Recipient texted back'),
    ('opt_out',       'compliance', TRUE,  FALSE, NULL,       NULL, 'Opt-out — fatigue ledger within 5s'),
    ('suppressed',    'compliance', TRUE,  FALSE, NULL,       NULL, 'Blocked pre-send (consent/fatigue/DNC)')
ON CONFLICT (status_code) DO NOTHING;

INSERT INTO e17.purpose_taxonomy (purpose_code, fec_disclaimer_required, description) VALUES
    ('fundraising',  TRUE,  'Donation ask VM'),
    ('gotv',         TRUE,  'GOTV reminder VM'),
    ('event_invite', TRUE,  'Event invitation VM'),
    ('rsvp_chase',   TRUE,  'Invitation follow-up VM (pairs with E32 rsvp_chase)'),
    ('thankyou',     FALSE, 'Donor thank-you in candidate voice'),
    ('persuasion',   TRUE,  'Persuasion message VM')
ON CONFLICT (purpose_code) DO NOTHING;

COMMIT;

-- ============================================================================
-- POST-EXECUTION VERIFICATION (Codex runs after apply)
-- ============================================================================
-- 1. Canary: SELECT COUNT(*), SUM(norm_amount) FROM raw.ncboe_donations
--            WHERE cluster_id=372171;  -- must be 147 / 332631.30
-- 2. SELECT COUNT(*) FROM e17.drop_status_taxonomy;  -- expect 8
-- 3. SELECT COUNT(*) FROM e17.purpose_taxonomy;      -- expect 6
-- 4. \dt e17.*  -- expect 12 tables
