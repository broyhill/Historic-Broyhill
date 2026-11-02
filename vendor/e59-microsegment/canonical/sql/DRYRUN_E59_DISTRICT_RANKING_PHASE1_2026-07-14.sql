-- =============================================================================
-- DRYRUN_E59_DISTRICT_RANKING_PHASE1_2026-07-14.sql
-- E59 Phase 1 — District Microsegment Ranking (READ-ONLY dry-run)
-- =============================================================================
-- SELECT-ONLY inside BEGIN/ROLLBACK. No writes, no queueing, no sends.
-- Target (live, 0 rows): e59.district_microsegment_ranking (migration 312 DDL live)
-- Sources (READ ONLY):
--   e59.donor_segment_assignment  (198,353 rows, 32 segment keys, FK-valid)
--   core.donor_profile            (state_house_district, READ ONLY)
--   e77.voter_donor_conversion_scores (2,324,239 R voters — deploy 35, district totals)
-- Dominance components available in Phase 1 (honest scope):
--   donor_share_pct (35%), donor counts, estimated_cycle_value (sum predicted_net_value),
--   donor_density per 1,000 R voters (from E77 universe).
--   voter_share_pct / volunteer_share_pct / turnout_rate = NULL (no voter-segment
--   or volunteer mapping exists live yet — left for later phases, per recompute fn
--   which COALESCEs nulls to 0).
-- dominance_score (Phase 1) = donor_share_pct * 0.35
-- =============================================================================
BEGIN;

SELECT COUNT(*) AS canary_count, SUM(norm_amount) AS canary_sum
  FROM raw.ncboe_donations WHERE cluster_id = 372171;

WITH donor_district AS (
    SELECT dp.cluster_id,
           CASE WHEN dp.state_house_district BETWEEN 1 AND 120
                THEN 'HD-' || lpad(dp.state_house_district::text, 3, '0') END AS district_id
    FROM core.donor_profile dp
), seg AS (
    SELECT dd.district_id, a.microsegment_key,
           COUNT(DISTINCT a.cluster_id) AS donors_in_segment,
           SUM(a.predicted_net_value)   AS estimated_cycle_value
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
           round(100.0 * s.donors_in_segment / NULLIF(t.total_donors,0) * 0.35, 2) AS dominance_score,
           round(1000.0 * s.donors_in_segment / NULLIF(v.r_voters,0), 2) AS donor_density,
           s.estimated_cycle_value,
           ROW_NUMBER() OVER (PARTITION BY s.district_id
                              ORDER BY s.donors_in_segment DESC) AS district_rank
    FROM seg s
    JOIN dtot t USING (district_id)
    LEFT JOIN vtot v USING (district_id)
)
SELECT 'projected_rows' AS metric, COUNT(*)::text AS value FROM scored
UNION ALL
SELECT 'districts_covered', COUNT(DISTINCT district_id)::text FROM scored
UNION ALL
SELECT 'segments_used', COUNT(DISTINCT microsegment_key)::text FROM scored
UNION ALL
SELECT 'rows_with_cycle_value', COUNT(*)::text FROM scored WHERE estimated_cycle_value IS NOT NULL
UNION ALL
SELECT 'rows_with_donor_density', COUNT(*)::text FROM scored WHERE donor_density IS NOT NULL
UNION ALL
SELECT 'avg_segments_per_district', round(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT district_id),0),1)::text FROM scored
ORDER BY 1;

-- Sample: top segment per district for 10 districts
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
), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY district_id
                                 ORDER BY donors_in_segment DESC) AS rnk
    FROM seg
)
SELECT district_id, microsegment_key, donors_in_segment
FROM ranked WHERE rnk = 1
ORDER BY donors_in_segment DESC LIMIT 10;

SELECT COUNT(*) AS canary_count, SUM(norm_amount) AS canary_sum
  FROM raw.ncboe_donations WHERE cluster_id = 372171;

ROLLBACK;
