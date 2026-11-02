-- =============================================================================
-- 309_e59_taxonomy_extension_queue.sql
-- E59 — Taxonomy Extension Queue (new issue tag proposals)
-- =============================================================================
-- DRY-RUN ONLY. Requires 305-308. Source: MSG-182 (Nexus E51, 2026-06-16)
-- Staff-submitted taxonomy extension requests.
-- Any staff member can propose a new issue tag → Nexus reviews → live in 24hrs.
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

CREATE TABLE IF NOT EXISTS e59.taxonomy_extension_queue (
    proposal_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_by             TEXT        NOT NULL,   -- staff name or system
    proposed_at             TIMESTAMPTZ DEFAULT NOW(),

    -- The proposed tag
    proposed_tag            TEXT        NOT NULL,   -- new microsegment_key or issue_code
    proposed_display_name   TEXT        NOT NULL,
    tag_type                TEXT        NOT NULL CHECK (tag_type IN (
                                'microsegment',     -- new microsegment to add to e59
                                'issue_code',       -- new issue to add to issues.canonical
                                'community_type',   -- new community identity type
                                'news_keyword'      -- new keyword for news_tag_mapping
                            )),

    -- Rationale
    rationale               TEXT,       -- why is this needed?
    example_news_headline   TEXT,       -- a recent headline that triggered this
    example_donor_count     INTEGER,    -- rough count of donors this would cover

    -- Parent linkage
    parent_microsegment     TEXT,       -- which existing segment is this under
    parent_issue_code       TEXT,       -- which issues.canonical is parent

    -- Review workflow
    status                  TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','deferred')),
    reviewed_by             TEXT,       -- 'nexus' or staff name
    reviewed_at             TIMESTAMPTZ,
    review_notes            TEXT,

    -- Promotion (when approved)
    promoted_to_tag         TEXT,       -- final tag name (may differ from proposed)
    promoted_at             TIMESTAMPTZ,
    promoted_to_table       TEXT,       -- which table it was added to

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS e59_teq_status   ON e59.taxonomy_extension_queue(status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS e59_teq_type     ON e59.taxonomy_extension_queue(tag_type, status);
CREATE INDEX IF NOT EXISTS e59_teq_pending  ON e59.taxonomy_extension_queue(proposed_at DESC)
    WHERE status = 'pending';

COMMENT ON TABLE e59.taxonomy_extension_queue IS
    'Governs dynamic vocabulary growth. Any staff member proposes a new microsegment, '
    'issue tag, community type, or news keyword. Nexus reviews (24hr SLA). '
    'Approved proposals are promoted to their target tables and tag added to controlled vocabulary. '
    'No hard-coded tags — all vocabulary changes go through this queue. '
    'Companion to vocabulary-extension-protocol skill.';

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
