-- ============================================================
-- STATUS: APPLY COPY — COMMIT
-- Source rehearsal: database/migrations/dryrun/DRYRUN_E87_VARIANCE_OBSERVE_SEAM_2026-09-23.sql
-- Source sha256: 3c828bb1001ccc986b6c7b6a4afa801dd64e7a4c9b5094722069ea88c124a37b
-- Ed 2026-09-23: Authorization confirmed. Run the live commit of this seam.
-- The dry-run file remains ROLLBACK.
--
-- What this is:
--   The E60/CBV emitter still inserts into e61.brain_signals.
--   That schema is not on Hetzner. E20 has no schema. The live bus is
--   brain.event_queue. The live spender tables are e60.lp_solver_runs
--   (1 row) and e60.lp_allocations. ops.variance_ledger exists and has
--   0 rows; its candidate_id is integer. e60.lp_solver_runs.candidate_id
--   is text. This file does not alter either of those.
--
-- What this file does, inside a transaction that ends in ROLLBACK:
--   1. Canary read of raw.ncboe_donations cluster 372171.
--   2. CREATE SCHEMA e87.
--   3. Three empty E87 tables from the 2026-08-11 freeze S7 names:
--      activity_cost_event, benefit_observation, variance_log.
--      candidate_id is text, matching e60.lp_solver_runs, not the
--      integer column on ops.variance_ledger.
--   4. RLS on, FORCE on. NOLOGIN role e87_recorder. No membership
--      in any e60 role. No GRANT to PUBLIC.
--   5. e87.read_variance(candidate). REVOKE from PUBLIC, then
--      GRANT EXECUTE to e60_optimizer_read (NOLOGIN, no table write).
--      Supersedes edbefde4012c80a31008a55188ec76074e4ada43498d2619bf2935dd239de5dd,
--      which revoked the function and granted it to nobody.
--      signal_emitter.py still inserts into e61.brain_signals. That
--      Python change is not this file.
--   6. e87.note_missing_variance(solve_id) — writes one
--      brain.observe_log row with actually_taken = false. It does
--      not update or delete e60.lp_solver_runs. This dry-run does
--      not call it.
--
-- What this file does not do:
--   - Does not create e61.brain_signals.
--   - Does not copy ECO_CANONICAL/E61/sql/004_E61_cost_benefit_variance.sql.
--   - Does not write ops.variance_ledger, e60.lp_solver_runs, or
--     e60.lp_allocations.
--   - Does not write sacred tables.
--   - Does not enqueue a live brain.event_queue row.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE c bigint; s numeric;
BEGIN
    SELECT COUNT(*), ROUND(COALESCE(SUM(norm_amount), 0), 2) INTO c, s
      FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF c <> 147 OR s <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL before: % / %', c, s;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('e61.brain_signals') IS NOT NULL THEN
        RAISE EXCEPTION 'precondition: e61.brain_signals appeared — re-read before applying';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'e87') THEN
        RAISE EXCEPTION 'precondition: schema e87 already exists';
    END IF;
END $$;

CREATE SCHEMA e87;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e87_recorder') THEN
        CREATE ROLE e87_recorder NOLOGIN NOSUPERUSER NOBYPASSRLS
            NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e60_optimizer_read') THEN
        CREATE ROLE e60_optimizer_read NOLOGIN NOSUPERUSER NOBYPASSRLS
            NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END $$;

GRANT USAGE ON SCHEMA e87 TO e87_recorder;
GRANT USAGE ON SCHEMA e87 TO e60_optimizer_read;

CREATE TABLE e87.activity_cost_event (
    cost_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id text NOT NULL,
    solve_id uuid,
    source_ecosystem text NOT NULL,
    cost_cents bigint NOT NULL CHECK (cost_cents >= 0),
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE e87.benefit_observation (
    benefit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id text NOT NULL,
    cost_event_id uuid NOT NULL REFERENCES e87.activity_cost_event (cost_event_id),
    benefit_cents bigint NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE e87.variance_log (
    variance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id text NOT NULL,
    cost_event_id uuid NOT NULL REFERENCES e87.activity_cost_event (cost_event_id),
    variance_cents bigint NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE e87.activity_cost_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE e87.benefit_observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE e87.variance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE e87.activity_cost_event FORCE ROW LEVEL SECURITY;
ALTER TABLE e87.benefit_observation FORCE ROW LEVEL SECURITY;
ALTER TABLE e87.variance_log FORCE ROW LEVEL SECURITY;

CREATE POLICY e87_cost_recorder ON e87.activity_cost_event
    FOR ALL TO e87_recorder
    USING (candidate_id = current_setting('app.current_candidate_id', true))
    WITH CHECK (candidate_id = current_setting('app.current_candidate_id', true));

CREATE POLICY e87_benefit_recorder ON e87.benefit_observation
    FOR ALL TO e87_recorder
    USING (candidate_id = current_setting('app.current_candidate_id', true))
    WITH CHECK (candidate_id = current_setting('app.current_candidate_id', true));

CREATE POLICY e87_variance_recorder ON e87.variance_log
    FOR ALL TO e87_recorder
    USING (candidate_id = current_setting('app.current_candidate_id', true))
    WITH CHECK (candidate_id = current_setting('app.current_candidate_id', true));

REVOKE ALL ON e87.activity_cost_event FROM PUBLIC;
REVOKE ALL ON e87.benefit_observation FROM PUBLIC;
REVOKE ALL ON e87.variance_log FROM PUBLIC;

GRANT SELECT, INSERT ON e87.activity_cost_event TO e87_recorder;
GRANT SELECT, INSERT ON e87.benefit_observation TO e87_recorder;
GRANT SELECT, INSERT ON e87.variance_log TO e87_recorder;

CREATE FUNCTION e87.read_variance(p_candidate text)
RETURNS TABLE(cost_event_id uuid, variance_cents bigint, recorded_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = e87, pg_temp
AS $$
    SELECT v.cost_event_id, v.variance_cents, v.recorded_at
      FROM e87.variance_log v
     WHERE v.candidate_id = p_candidate;
$$;

REVOKE ALL ON FUNCTION e87.read_variance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION e87.read_variance(text) TO e60_optimizer_read;

CREATE FUNCTION e87.note_missing_variance(p_solve uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = brain, e60, pg_temp
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_solve IS NULL THEN
        RAISE EXCEPTION 'e87.note_missing_variance: solve_id required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM e60.lp_solver_runs WHERE solve_id = p_solve) THEN
        RAISE EXCEPTION 'e87.note_missing_variance: no lp run %', p_solve;
    END IF;
    INSERT INTO brain.observe_log (
        executor_code, weapon, event_class, mode, actually_taken, observe_response, trace_id
    ) VALUES (
        'e87',
        'lp',
        'e87.variance',
        'observe',
        false,
        jsonb_build_object('solve_id', p_solve, 'quarantine', 'variance payload missing', 'action_taken', false),
        p_solve::text
    )
    RETURNING observe_id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION e87.note_missing_variance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION e87.note_missing_variance(uuid) TO e87_recorder;

DO $$
DECLARE c bigint; s numeric; n int;
BEGIN
    SELECT COUNT(*) INTO n FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'e87' AND c.relkind = 'r' AND c.relforcerowsecurity;
    IF n <> 3 THEN
        RAISE EXCEPTION 'verify: forced e87 tables = % (want 3)', n;
    END IF;
    IF has_table_privilege('e87_recorder', 'e60.lp_solver_runs', 'INSERT')
       OR has_table_privilege('e87_recorder', 'e60.lp_solver_runs', 'UPDATE')
       OR has_table_privilege('e87_recorder', 'ops.variance_ledger', 'INSERT') THEN
        RAISE EXCEPTION 'verify: e87_recorder can write the spender or the old ledger';
    END IF;
    IF NOT has_function_privilege('e60_optimizer_read', 'e87.read_variance(text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'verify: e60_optimizer_read cannot execute e87.read_variance';
    END IF;
    IF has_table_privilege('e60_optimizer_read', 'e87.variance_log', 'INSERT')
       OR has_table_privilege('e60_optimizer_read', 'e87.variance_log', 'UPDATE')
       OR has_table_privilege('e60_optimizer_read', 'e87.variance_log', 'DELETE')
       OR has_table_privilege('e60_optimizer_read', 'e60.lp_solver_runs', 'INSERT')
       OR has_table_privilege('e60_optimizer_read', 'e60.lp_solver_runs', 'UPDATE') THEN
        RAISE EXCEPTION 'verify: e60_optimizer_read can write the ledger or the spender';
    END IF;
    SELECT COUNT(*), ROUND(COALESCE(SUM(norm_amount), 0), 2) INTO c, s
      FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF c <> 147 OR s <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL after: % / %', c, s;
    END IF;
END $$;

-- Live apply. One transaction.
COMMIT;
