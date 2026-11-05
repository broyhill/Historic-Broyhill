-- E14 Migration 400 — extracted from E14_LETTRLABS_WEBHOOK_HANDLER_TDD_2026-06-20.md
BEGIN;

DO $$
DECLARE
    v_canary_count BIGINT;
    v_canary_sum   NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount), 0)
      INTO v_canary_count, v_canary_sum
      FROM raw.ncboe_donations
     WHERE cluster_id = 372171;

    IF v_canary_count <> 147 OR v_canary_sum <> 332631.30 THEN
        RAISE EXCEPTION 'ABORT: Sacred canary drift — got % / %', v_canary_count, v_canary_sum;
    END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS e14;

CREATE TABLE IF NOT EXISTS e14.print_job_log (
    id                    BIGSERIAL    PRIMARY KEY,
    lettrlabs_job_id      TEXT         NOT NULL UNIQUE,
    cluster_id            INTEGER      NOT NULL,
    candidate_id          UUID         NOT NULL,
    donor_uid             TEXT         NOT NULL,
    trigger_id            TEXT         NOT NULL,
    ask_amount            NUMERIC(10,2),
    race_name             TEXT,
    job_status            TEXT         NOT NULL DEFAULT 'accepted'
                              CHECK (job_status IN ('accepted','produced','mailed','failed')),
    accepted_at           TIMESTAMPTZ,
    produced_at           TIMESTAMPTZ,
    mailed_at             TIMESTAMPTZ,
    tracking_number       TEXT,
    usps_class            TEXT,
    estimated_mail_date   DATE,
    raw_accepted_payload  JSONB,
    raw_produced_payload  JSONB,
    raw_mailed_payload    JSONB,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e14_print_job_cluster
    ON e14.print_job_log (cluster_id);
CREATE INDEX IF NOT EXISTS idx_e14_print_job_candidate
    ON e14.print_job_log (candidate_id);
CREATE INDEX IF NOT EXISTS idx_e14_print_job_status
    ON e14.print_job_log (job_status);
CREATE INDEX IF NOT EXISTS idx_e14_print_job_mailed_at
    ON e14.print_job_log (mailed_at)
    WHERE mailed_at IS NOT NULL;

COMMIT;
