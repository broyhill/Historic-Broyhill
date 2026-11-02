-- =============================================================================
-- 310_e59_wizard_launch_context.sql
-- E59 — Wizard Launch Context (pre-loaded context from microsegment → E68)
-- =============================================================================
-- DRY-RUN ONLY. Requires 307-308. Source: MSG-184 (Nexus E51, 2026-06-16)
-- When staff clicks [LAUNCH WIZARD] on a microsegment page, this table stores
-- the pre-built AI context object passed to E68 Wizard of Oz.
-- cluster_id = INTEGER. candidate_id = UUID FK core.candidates.
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

CREATE TABLE IF NOT EXISTS e59.wizard_launch_context (
    context_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source microsegment (what was the candidate looking at when they clicked)
    hierarchy_node_id       UUID        NOT NULL
                                REFERENCES e59.microsegment_hierarchy(node_id),
    microsegment_key        TEXT        NOT NULL,
    candidate_id            UUID        NOT NULL
                                REFERENCES core.candidates(candidate_id),

    -- Quadrant — determines entire Wizard strategy
    quadrant                TEXT        NOT NULL CHECK (quadrant IN (
                                'STRIKE_NOW',       -- act within 48hrs, urgent ask
                                'CULTIVATE_NOW',    -- relationship building, no ask yet
                                'INFORM_ONLY',      -- amplification, not direct ask
                                'MONITOR_BENCH'     -- dormant, no launch allowed
                            )),

    -- AI pre-selections passed to E68 Wizard
    recommended_funnel      TEXT        NOT NULL CHECK (recommended_funnel IN (
                                'personal_call',
                                'email_sequence',
                                'sms_blast',
                                'rvm_drop',
                                'event_invitation',
                                'direct_mail',
                                'social_media',
                                'multi_channel_waterfall'
                            )),
    recommended_message_frame   TEXT,   -- 'bear_attack_safety','property_rights','tax_relief'
    recommended_subject_line_a  TEXT,   -- A/B test option A
    recommended_subject_line_b  TEXT,   -- A/B test option B
    recommended_ask_amount      DECIMAL(10,2),  -- default ask (overridden per donor grade)
    recommended_urgency_window_days INTEGER,    -- hours before opportunity closes

    -- Ask amounts by donor grade (pre-filled by E13 capacity tier)
    ask_a_plus_plus         DECIMAL(10,2),  -- A++ donors
    ask_a_plus              DECIMAL(10,2),  -- A+ donors
    ask_a                   DECIMAL(10,2),  -- A donors
    ask_b                   DECIMAL(10,2),  -- B donors
    ask_c                   DECIMAL(10,2),  -- C donors

    -- Pre-loaded donor list
    pre_loaded_cluster_ids  INTEGER[],  -- cluster_id values (INTEGER per canon)
    donor_count             INTEGER,
    total_headroom          DECIMAL(14,2),  -- capped at $6,800/election NC law

    -- AI content brief (passed to E09 content engine)
    ai_content_brief        JSONB       DEFAULT '{}',
    -- Structure: {
    --   "lead_event": "bear attack Hyde County",
    --   "candidate_position": "NCWRC accountability + rural safety",
    --   "talking_points": ["point1","point2","point3"],
    --   "urgency": "Window closes in 48 hours",
    --   "tone": "authoritative_concerned",
    --   "avoid": ["fabricated urgency","antagonism"]
    -- }

    -- Funnel steps (multi-channel waterfall detail)
    funnel_steps            JSONB       DEFAULT '[]',
    -- Array of: {"step": 1, "channel": "personal_call",
    --            "target_grade": "A++", "timing": "now",
    --            "talking_point": "..."}

    -- Compliance pre-check
    compliance_cleared      BOOLEAN     DEFAULT FALSE,
    compliance_checked_at   TIMESTAMPTZ,
    compliance_flags        TEXT[],     -- any issues flagged by E10

    -- Status
    launched_at             TIMESTAMPTZ,
    campaign_id             UUID,           -- wizard.campaigns.campaign_id when created
    status                  TEXT        DEFAULT 'pending'
                                CHECK (status IN ('pending','launched','cancelled','expired')),

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    expires_at              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
                                -- STRIKE_NOW contexts expire after 48hrs
);

CREATE INDEX IF NOT EXISTS e59_wlc_candidate
    ON e59.wizard_launch_context(candidate_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS e59_wlc_node
    ON e59.wizard_launch_context(hierarchy_node_id);
CREATE INDEX IF NOT EXISTS e59_wlc_pending
    ON e59.wizard_launch_context(created_at DESC)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS e59_wlc_quadrant
    ON e59.wizard_launch_context(candidate_id, quadrant)
    WHERE status = 'pending';

COMMENT ON TABLE e59.wizard_launch_context IS
    'Pre-built AI context object created when staff clicks [LAUNCH WIZARD] on a '
    'microsegment page. Passed to E68 Wizard of Oz for pre-loaded campaign composition. '
    'quadrant determines entire strategy: STRIKE_NOW=immediate ask, '
    'CULTIVATE_NOW=relationship sequence, INFORM_ONLY=amplify, MONITOR_BENCH=no launch. '
    'ai_content_brief is consumed by E09 content engine to generate draft messages. '
    'pre_loaded_cluster_ids are INTEGER[] per canon ruling 2026-06-15. '
    'Expires 48hrs after creation (STRIKE_NOW window). '
    'wizard.campaigns FK set when E68 creates the campaign from this context.';

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
