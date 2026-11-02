-- =============================================================================
-- 2026-07-14_E59_DISTRICT_RANKING_PHASE2_LIVE.sql
-- E59 District Microsegment Ranking — Phase 2 LIVE population
-- =============================================================================
-- LIVE APPLY — authorized by Ed with exact phrase "I AUTHORIZE THIS ACTION"
-- (2026-07-14). Read-only Phase 1 dry-run executed clean same day (PR #184):
-- 3,188 projected rows / 120 districts / 32 segments, canary PASS pre & post.
--
-- Target: e59.district_microsegment_ranking (live via migration 312, 0 rows)
-- Sources (READ ONLY): e59.donor_segment_assignment, core.donor_profile,
--                      e77.voter_donor_conversion_scores (deploy 35)
-- Phase 1 scope: donor-share component only (35% weight). voter_share_pct /
-- volunteer_share_pct / turnout_rate left NULL (no live voter-segment or
-- volunteer mapping yet); estimated_cycle_value NULL (predicted_net_value
-- unpopulated in assignments). dominance_score = donor_share_pct * 0.35.
-- Idempotent: ON CONFLICT (district_id, microsegment_key) DO NOTHING.
-- =============================================================================

BEGIN;

DO $$
DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
      FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL: % / % — ABORT', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS (pre): % / $%', v_txns, v_total;
END $$;

WITH donor_district AS (
    SELECT dp.cluster_id,
           CASE WHEN dp.state_house_district BETWEEN 1 AND 120
                THEN 'HD-' || lpad(dp.state_house_district::text, 3, '0') END AS district_id
    FROM core.donor_profile dp
), seg AS (
    SELECT dd.district_id, a.microsegment_key,
           COUNT(DISTINCT a.cluster_id) AS donors_in_segment
    FROM e59.donor_segment_assignment a
    JOIN donor_district dd ON dd.cluster_id = a.cluster_id
    WHERE dd.district_id IS NOT NULL
    GROUP BY 1, 2
), dtot AS (
    SELECT district_id, COUNT(DISTINCT cluster_id) AS total_donors
    FROM (SELECT dd.district_id, a.cluster_id
            FROM e59.donor_segment_assignment a
            JOIN donor_district dd ON dd.cluster_id = a.cluster_id
           WHERE dd.district_id IS NOT NULL) x
    GROUP BY 1
), vtot AS (
    SELECT district_id, COUNT(*) AS r_voters
    FROM e77.voter_donor_conversion_scores
    WHERE district_id IS NOT NULL
    GROUP BY 1
), scored AS (
    SELECT s.district_id, s.microsegment_key,
           s.donors_in_segment,
           round(100.0 * s.donors_in_segment / NULLIF(t.total_donors,0), 2) AS donor_share_pct,
           LEAST(100, round(100.0 * s.donors_in_segment / NULLIF(t.total_donors,0) * 0.35, 2)) AS dominance_score,
           round(1000.0 * s.donors_in_segment / NULLIF(v.r_voters,0), 2) AS donor_density,
           ROW_NUMBER() OVER (PARTITION BY s.district_id
                              ORDER BY s.donors_in_segment DESC) AS district_rank
    FROM seg s
    JOIN dtot t USING (district_id)
    LEFT JOIN vtot v USING (district_id)
)
INSERT INTO e59.district_microsegment_ranking
    (district_id, microsegment_key, dominance_score, district_rank,
     donor_share_pct, donors_in_segment, donor_density, data_vintage)
SELECT district_id, microsegment_key, dominance_score, district_rank,
       donor_share_pct, donors_in_segment, donor_density,
       '2026_cycle_phase1_donor_component'
  FROM scored
ON CONFLICT (district_id, microsegment_key) DO NOTHING;

-- Verification
SELECT
    (SELECT COUNT(*) FROM e59.district_microsegment_ranking)                          AS total_rows,
    (SELECT COUNT(DISTINCT district_id) FROM e59.district_microsegment_ranking)       AS districts,
    (SELECT COUNT(DISTINCT microsegment_key) FROM e59.district_microsegment_ranking)  AS segments,
    (SELECT COUNT(*) FROM e59.district_microsegment_ranking WHERE district_rank = 1)  AS rank1_rows,
    (SELECT COUNT(*) FROM e59.district_microsegment_ranking WHERE donor_density IS NOT NULL) AS density_rows;

DO $$
DECLARE v_txns BIGINT; v_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(norm_amount),0) INTO v_txns, v_total
      FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns <> 147 OR round(v_total,2) <> 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAIL after apply: % / % — ROLLBACK', v_txns, v_total;
    END IF;
    RAISE NOTICE 'Canary PASS (post): % / $%', v_txns, v_total;
END $$;

COMMIT;
