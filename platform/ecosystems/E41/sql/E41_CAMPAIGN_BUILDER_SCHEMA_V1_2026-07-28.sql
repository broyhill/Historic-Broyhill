-- =============================================================================
-- E41_CAMPAIGN_BUILDER_SCHEMA_V1_2026-07-28.sql
-- E41 — Campaign Builder / Journey Designer
-- =============================================================================
-- DRY-RUN ONLY. Nothing applies without Ed's exact phrase: I AUTHORIZE THIS ACTION
--
-- Author: Claude · 2026-07-28
-- Design source: docs/canonical/seamless-research/ITERABLE_FULL_CAPABILITY_INVENTORY_2026-06-13.md §9
--   "Journey Tiles + 4 entry sources + Tilesets -> the E41 waterfall designer blueprint;
--    entry sources = your 3-type trigger spine; Tilesets = reusable waterfall templates."
--
-- BOUNDARY (Iterable teardown §10, unchanged):
--   E41 BUILDS journeys. E20 DECIDES. The constrained portfolio decision
--   (budget/capacity/FEC/fatigue + shadow prices) stays in the LP. E41 never
--   selects donors and never fires a weapon — it defines the sequence and hands
--   each step to E20 as a proposal.
--
-- ML BOUNDARY (Ed Ruling Option A, 2026-07-25, ABSOLUTE):
--   E41 writes outcome signals to outcome.* ONLY.
--   E41 NEVER writes ml.donor_fingerprint. That updates via derived view only.
--
-- Canary: cluster 372171 = 147 txns / $332,631.30 — asserted before and after.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- CANARY — BEFORE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL before apply: % / % — ABORT', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS before: % / $%', v_txns, v_total;
END $$;

CREATE SCHEMA IF NOT EXISTS e41;
COMMENT ON SCHEMA e41 IS
  'E41 Campaign Builder — journey/waterfall designer. Builds sequences; never decides '
  'targeting and never fires. All execution proposals route through E20 Brain.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. TILESETS — reusable waterfall templates
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.tileset (
    tileset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tileset_code      TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    description       TEXT,
    -- 'waterfall' = the 5-step default; 'fox_hunter' = event-triggered cascade
    pattern_kind      TEXT NOT NULL DEFAULT 'waterfall'
                      CHECK (pattern_kind IN ('waterfall','fox_hunter','nurture','reactivation','custom')),
    is_system         BOOLEAN NOT NULL DEFAULT FALSE,   -- system templates are not editable
    created_by        TEXT NOT NULL DEFAULT 'e41',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. JOURNEY DEFINITION — the built artifact
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.journey_definition (
    journey_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_code      TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    -- PARENT: which candidate silo owns this journey. NULL = platform template.
    candidate_id      INTEGER,
    silo_id           TEXT,
    -- PARENT: built from which tileset (nullable — journeys can be built from scratch)
    tileset_id        UUID REFERENCES e41.tileset(tileset_id) ON DELETE SET NULL,
    -- authored by E68 Wizard (candidate will) or by campaign manager
    authored_by       TEXT NOT NULL DEFAULT 'e68'
                      CHECK (authored_by IN ('e68','campaign_manager','e41_template','claude')),
    version           INTEGER NOT NULL DEFAULT 1,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','review','approved','archived')),
    -- E68 Wizard authorization — Tier 1. No journey activates without it.
    wizard_approved   BOOLEAN NOT NULL DEFAULT FALSE,
    wizard_approved_by TEXT,
    wizard_approved_at TIMESTAMPTZ,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_e41_journey_candidate ON e41.journey_definition(candidate_id);
CREATE INDEX IF NOT EXISTS ix_e41_journey_status    ON e41.journey_definition(status);


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. ENTRY SOURCE — the 3-type trigger spine (Iterable's 4 entry sources)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.entry_source (
    entry_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PARENT
    journey_id        UUID NOT NULL REFERENCES e41.journey_definition(journey_id) ON DELETE CASCADE,
    entry_kind        TEXT NOT NULL
                      CHECK (entry_kind IN ('brain_trigger','segment_membership','manual_list','api_call')),
    -- CHILD-OF-E20: which brain.triggers row starts this journey
    brain_trigger_id  TEXT,
    -- CHILD-OF-E59: which microsegment membership starts this journey
    microsegment_key  TEXT,
    -- optional filter predicate applied on top of the entry set
    filter_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_e41_entry_journey ON e41.entry_source(journey_id);
CREATE INDEX IF NOT EXISTS ix_e41_entry_trigger ON e41.entry_source(brain_trigger_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. JOURNEY TILE — one step in the sequence
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.journey_tile (
    tile_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- PARENT
    journey_id        UUID NOT NULL REFERENCES e41.journey_definition(journey_id) ON DELETE CASCADE,
    -- SELF-PARENT: tiles form a DAG. NULL parent = entry tile.
    parent_tile_id    UUID REFERENCES e41.journey_tile(tile_id) ON DELETE CASCADE,
    -- which branch of the parent this tile hangs off ('yes'/'no'/'default'/'timeout')
    branch_label      TEXT NOT NULL DEFAULT 'default',
    step_order        INTEGER NOT NULL,
    tile_kind         TEXT NOT NULL
                      CHECK (tile_kind IN ('weapon','wait','split','filter','webhook','exit')),

    -- ── weapon tiles: which cannon. CHILD-OF the weapon ecosystem. ──
    weapon_code       TEXT,          -- 'email' | 'sms' | 'rvm' | 'mail' | 'social' | 'call'
    ecosystem_code    TEXT,          -- 'E30' | 'E31' | 'E17' | 'E33' | 'E19' | 'E32'
    -- E20 executor this tile proposes to. Resolved at runtime, stored for audit.
    executor_code     TEXT,

    -- ── wait tiles ──
    wait_seconds      INTEGER,

    -- ── split/filter tiles ──
    predicate_json    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- ── content binding (E09 content / E48 comms DNA) ──
    munition_ref      TEXT,          -- munition library key; data not code
    ask_tier          TEXT,

    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_e41_tile_weapon_fields
      CHECK (tile_kind <> 'weapon' OR (weapon_code IS NOT NULL AND ecosystem_code IS NOT NULL)),
    CONSTRAINT ck_e41_tile_wait_fields
      CHECK (tile_kind <> 'wait' OR wait_seconds IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_e41_tile_journey ON e41.journey_tile(journey_id, step_order);
CREATE INDEX IF NOT EXISTS ix_e41_tile_parent  ON e41.journey_tile(parent_tile_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. CONTROL PANEL STATE — off / on / timer, per journey
--    Ed requirement 2026-07-28: toggle buttons off/on/timer reporting back to E20
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.control_state (
    control_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id        UUID NOT NULL UNIQUE
                      REFERENCES e41.journey_definition(journey_id) ON DELETE CASCADE,

    -- THE TOGGLE. Three positions, exactly as specified.
    mode              TEXT NOT NULL DEFAULT 'off'
                      CHECK (mode IN ('off','on','timer')),

    -- timer mode only
    timer_cron        TEXT,                       -- e.g. '0 9 * * 1-5'
    timer_window_start TIME,                      -- do not run outside this window
    timer_window_end   TIME,
    timer_timezone    TEXT NOT NULL DEFAULT 'America/New_York',
    next_run_at       TIMESTAMPTZ,
    last_run_at       TIMESTAMPTZ,

    -- rate limiting at the journey level, independent of executor max_per_hour
    max_entries_per_run INTEGER NOT NULL DEFAULT 500,
    max_runs_per_day    INTEGER NOT NULL DEFAULT 4,

    -- ── E20 REPORT-BACK (Ed requirement) ──
    -- Every mode change writes an event to brain.event_queue so E20 knows the
    -- journey's state without polling. Last acknowledgement recorded here.
    e20_last_reported_mode TEXT,
    e20_last_reported_at   TIMESTAMPTZ,
    e20_ack_trace_id       TEXT,

    -- who flipped it and when — every toggle is attributable
    changed_by        TEXT NOT NULL DEFAULT 'e41',
    changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_reason     TEXT,

    CONSTRAINT ck_e41_timer_needs_cron
      CHECK (mode <> 'timer' OR timer_cron IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_e41_control_mode    ON e41.control_state(mode) WHERE mode <> 'off';
CREATE INDEX IF NOT EXISTS ix_e41_control_nextrun ON e41.control_state(next_run_at) WHERE mode = 'timer';

COMMENT ON TABLE e41.control_state IS
  'Journey run control. mode=off halts entry, mode=on runs on entry-source trigger, '
  'mode=timer runs on schedule. Every change emits to brain.event_queue for E20.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. CONTROL AUDIT — every toggle, forever
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.control_audit (
    audit_id          BIGSERIAL PRIMARY KEY,
    journey_id        UUID NOT NULL,
    from_mode         TEXT,
    to_mode           TEXT NOT NULL,
    changed_by        TEXT NOT NULL,
    change_reason     TEXT,
    e20_notified      BOOLEAN NOT NULL DEFAULT FALSE,
    e20_trace_id      TEXT,
    changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_e41_audit_journey ON e41.control_audit(journey_id, changed_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. JOURNEY RUN — one execution instance
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.journey_run (
    run_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id        UUID NOT NULL REFERENCES e41.journey_definition(journey_id) ON DELETE CASCADE,
    triggered_by      TEXT NOT NULL
                      CHECK (triggered_by IN ('entry_source','timer','manual','e20_request')),
    entry_id          UUID REFERENCES e41.entry_source(entry_id) ON DELETE SET NULL,
    bgop_trace_id     TEXT,
    status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','completed','halted','failed')),
    entries_count     INTEGER NOT NULL DEFAULT 0,
    proposals_sent    INTEGER NOT NULL DEFAULT 0,   -- how many went to E20
    proposals_accepted INTEGER NOT NULL DEFAULT 0,  -- how many E20 queued
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at       TIMESTAMPTZ,
    error_message     TEXT
);
CREATE INDEX IF NOT EXISTS ix_e41_run_journey ON e41.journey_run(journey_id, started_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. STEP LOG — per-donor position in a journey
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.journey_step_log (
    step_log_id       BIGSERIAL PRIMARY KEY,
    run_id            UUID NOT NULL REFERENCES e41.journey_run(run_id) ON DELETE CASCADE,
    journey_id        UUID NOT NULL,
    tile_id           UUID NOT NULL,
    cluster_id        INTEGER NOT NULL,            -- the donor. INTEGER per platform constant.
    -- ── HANDOFF TO E20 ──
    -- E41 does not fire. It writes a proposal and records what E20 did with it.
    proposed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    e20_weapon_id     UUID,                        -- brain.weapon_queue.weapon_id if accepted
    e20_decision      TEXT NOT NULL DEFAULT 'proposed'
                      CHECK (e20_decision IN ('proposed','accepted','rejected','suppressed','expired')),
    e20_reason        TEXT,                        -- e.g. 'suppression: deceased'
    -- ── ML FEEDBACK (outcome.* ONLY — never ml.donor_fingerprint) ──
    outcome_id        UUID,                        -- outcome.weapon_outcome.outcome_id
    outcome_written   BOOLEAN NOT NULL DEFAULT FALSE,
    bgop_trace_id     TEXT
);
CREATE INDEX IF NOT EXISTS ix_e41_steplog_run     ON e41.journey_step_log(run_id);
CREATE INDEX IF NOT EXISTS ix_e41_steplog_cluster ON e41.journey_step_log(cluster_id);
CREATE INDEX IF NOT EXISTS ix_e41_steplog_weapon  ON e41.journey_step_log(e20_weapon_id);

COMMENT ON COLUMN e41.journey_step_log.e20_decision IS
  'E41 proposes; E20 disposes. suppressed = blocked by ConstitutionalResolver '
  '(opt-out, deceased, fatigue, FEC limit).';


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. CONNECTION REGISTRY — every parent/child edge, declared
--    Ed requirement 2026-07-28: identify all child-parent and parent-child connections
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS e41.connection_registry (
    connection_id     SERIAL PRIMARY KEY,
    direction         TEXT NOT NULL CHECK (direction IN ('E41_IS_CHILD_OF','E41_IS_PARENT_OF','PEER')),
    counterpart_eco   TEXT NOT NULL,
    relationship      TEXT NOT NULL,
    contract_object   TEXT,               -- the schema.table or endpoint that carries it
    required          BOOLEAN NOT NULL DEFAULT TRUE,
    live_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT
);

INSERT INTO e41.connection_registry
    (direction, counterpart_eco, relationship, contract_object, required, notes) VALUES
-- ── E41 IS CHILD OF (upstream — these govern or feed E41) ─────────────────────
('E41_IS_CHILD_OF','E68','Wizard authorizes the journey. Tier 1. Nothing activates without wizard_approved.',
   'e41.journey_definition.wizard_approved', TRUE,
   'Constitution Tier 1 — candidate will overrides E41 and E20'),
('E41_IS_CHILD_OF','E20','Brain accepts or rejects every step proposal. E41 never fires.',
   'brain.weapon_queue + brain.action_executors', TRUE,
   'E41 writes proposals; E20 owns the go/no-go and the constrained portfolio decision'),
('E41_IS_CHILD_OF','E10','Compliance floor. TCPA/CAN-SPAM/10DLC/FEC evaluated inside the socket.',
   'ConstitutionalResolver in brain_worker', TRUE,
   'Constitution Tier 2 — no exceptions'),
('E41_IS_CHILD_OF','E59','Microsegment membership supplies entry sets.',
   'e59.donor_segment_assignment', TRUE, 'entry_kind = segment_membership'),
('E41_IS_CHILD_OF','E01','Donor grades gate tier-restricted tiles (phone bank B+ only, etc.)',
   'core.donor_profile grade fields', TRUE, NULL),
('E41_IS_CHILD_OF','E64','Heavy/Farm sort determines which journeys a donor is eligible for.',
   'e64.* funnel tables', FALSE, 'blocked — e64 schema is empty'),
('E41_IS_CHILD_OF','E09','Content supplies munition bodies referenced by weapon tiles.',
   'munition library (data, not code)', TRUE, 'munition_ref is a key, never inline content'),
('E41_IS_CHILD_OF','E48','Communication DNA supplies tone/variant selection per segment.',
   'e48 tone tables', FALSE, 'no schema yet'),
-- ── E41 IS PARENT OF (downstream — E41 governs these at runtime) ──────────────
('E41_IS_PARENT_OF','E30','Email tile proposes to the email executor.',
   '/api/e30/send-email', FALSE, 'executor exists, enabled=FALSE'),
('E41_IS_PARENT_OF','E31','SMS tile proposes to the SMS executor.',
   '/api/e31/send-sms', FALSE, 'first-fire weapon per Ed ruling'),
('E41_IS_PARENT_OF','E17','RVM tile proposes to the RVM executor.',
   '/api/e17/drop-rvm', FALSE, 'no carrier integration exists yet'),
('E41_IS_PARENT_OF','E33','Direct mail tile.', '/api/e16/queue-mail', FALSE, NULL),
('E41_IS_PARENT_OF','E19','Social tile.', '/api/e19/queue-post', FALSE, NULL),
('E41_IS_PARENT_OF','E32','Phone bank tile. Grade-gated to B+ and above.',
   '/api/e18/queue-call', FALSE, NULL),
-- ── PEER (bidirectional, neither governs) ────────────────────────────────────
('PEER','E22','A/B variants assigned per tile; results returned to E22.',
   'e22 experiment tables', FALSE, NULL),
('PEER','E60','Cost per proposed step emitted for LP optimization.',
   'emit_send_cost_to_e60()', TRUE, NULL),
('PEER','E42','News shock can trigger a fox_hunter journey out of cycle.',
   'brain.event_queue', FALSE, NULL),
('PEER','E73','Self-regulation reads e41.control_state and run health as a sensor.',
   'e73.sense_bus', FALSE, 'e73 schema exists, 0 rows')
ON CONFLICT DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 10. E20 REGISTRATION — E41 as a Brain-visible executor
--     enabled = FALSE. The endpoint does not exist yet.
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO brain.action_executors (
    executor_code, ecosystem_code, weapon, event_class,
    handler_kind, handler_endpoint, enabled,
    requires_observe_pass, requires_go_nogo, requires_compliance,
    is_vendor, de_identified_only, max_per_hour
) VALUES (
    'EXEC_E41_JOURNEY_STEP',
    'E41', 'journey', 'journey.step_ready',
    'http', '/api/e41/propose-step',
    FALSE,          -- DARK until the endpoint is live and Ed authorizes
    TRUE,           -- requires_observe_pass
    TRUE,           -- requires_go_nogo
    TRUE,           -- requires_compliance
    FALSE,          -- is_vendor
    FALSE,          -- de_identified_only
    1000            -- max_per_hour
)
ON CONFLICT (executor_code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_tables INTEGER; v_conns INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_tables
      FROM information_schema.tables WHERE table_schema = 'e41';
    SELECT COUNT(*) INTO v_conns FROM e41.connection_registry;
    IF v_tables < 8 THEN
        RAISE EXCEPTION 'Expected >=8 e41 tables, found %', v_tables;
    END IF;
    RAISE NOTICE 'e41 schema: % tables, % declared connections', v_tables, v_conns;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CANARY — AFTER
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL after apply: % / % — ROLLBACK', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS after: % / $%', v_txns, v_total;
END $$;

ROLLBACK;   -- ← DRY-RUN. Change to COMMIT only under Ed's exact phrase.
