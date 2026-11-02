-- ============================================================
-- E59 MICROSEGMENT ASSIGNMENT — SIC WATERFALL (24 segments)
-- Date:     2026-06-30
-- Author:   Claude (Anthropic)
-- Executor: Nexus via direct Hetzner SSH
-- Source:   core.donor_profile.sic_code → donor_intelligence.sic_divisions
-- Join:     LEFT(dp.sic_code, 2) = sd.sic_division
-- Coverage: ~53,224 of 180,412 donors (29.5% have SIC code)
-- ============================================================

-- CANARY — ABORT IF VIOLATED
DO $$
DECLARE
  v_txns  INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), SUM(norm_amount::numeric)
  INTO v_txns, v_total
  FROM raw.ncboe_donations
  WHERE cluster_id = 372171;

  IF v_txns <> 147 OR ROUND(v_total, 2) <> 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL: % / %', v_txns, v_total;
  END IF;
  RAISE NOTICE 'CANARY OK: % / %', v_txns, v_total;
END $$;

-- ============================================================
-- SEGMENT 1: farmers_ag
-- SIC divisions 01 (Crops), 02 (Livestock), 07 (Ag Services),
--              08 (Forestry) — TIER1_PATRIOT + TIER2_LOYALIST
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'farmers_ag'   AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.80           AS confidence_score,
  NOW()          AS assigned_at
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('01','02','07','08')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 2: dairy_farmers
-- SIC 02 (Livestock) — TIER1_PATRIOT
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'dairy_farmers' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.75            AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '02'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 3: hog_farmers
-- SIC 02 (Livestock) — TIER1_PATRIOT
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'hog_farmers'  AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.70           AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '02'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 4: tobacco_farmers
-- SIC 01 (Crops) — TIER1_PATRIOT
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'tobacco_farmers' AS segment_code,
  'sic_waterfall'   AS assignment_method,
  0.75              AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '01'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 5: auto_dealers
-- SIC 55 (Auto Dealers) + 59 (Retail Misc) — TIER2_LOYALIST + TIER1_PATRIOT
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'auto_dealers' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.82           AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('55','59')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 6: realtors_real_estate
-- SIC 65 (Real Estate) — TIER2_LOYALIST
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'realtors_real_estate' AS segment_code,
  'sic_waterfall'        AS assignment_method,
  0.80                   AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '65'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 7: construction
-- SIC 15 (General), 16 (Heavy), 17 (Special Trade) — TIER2_LOYALIST
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'construction' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.80           AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('15','16','17')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 8: trucking_transport
-- SIC 42 (Motor Freight), 45 (Air Transport) — TIER2_LOYALIST + TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'trucking_transport' AS segment_code,
  'sic_waterfall'      AS assignment_method,
  0.78                 AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('42','45')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 9: bankers_finance
-- SIC 60 (Banks), 61 (Credit), 62 (Securities), 63 (Insurance Carriers),
--     64 (Insurance Agents), 67 (Holding Companies) — TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'bankers_finance' AS segment_code,
  'sic_waterfall'   AS assignment_method,
  0.72              AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('60','61','62','63','64','67')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 10: law_enforcement
-- SIC 92 (Justice/Public Order), 97 (National Security/Defense)
-- TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'law_enforcement' AS segment_code,
  'sic_waterfall'   AS assignment_method,
  0.72              AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('92','97')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 11: small_biz_owners
-- SIC 87 (Engineering/Management Services) — TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'small_biz_owners' AS segment_code,
  'sic_waterfall'    AS assignment_method,
  0.70               AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '87'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 12: manufacturers
-- SIC 20-39 (all manufacturing divisions) — TIER3_RELIABLE
-- Use range cast since no clean column
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'manufacturers' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.70            AS confidence_score,
  NOW()
FROM core.donor_profile dp
WHERE dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
  AND LEFT(dp.sic_code, 2) ~ '^[0-9]+$'
  AND CAST(LEFT(dp.sic_code, 2) AS INTEGER) BETWEEN 20 AND 39
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 13: lumber_timber
-- SIC 24 (Lumber/Wood) — TIER2_LOYALIST
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'lumber_timber' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.80            AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '24'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 14: mining_energy
-- SIC 10-14 (Mining, Coal, Oil/Gas) — TIER1_PATRIOT
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'mining_energy' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.90            AS confidence_score,
  NOW()
FROM core.donor_profile dp
WHERE dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
  AND LEFT(dp.sic_code, 2) ~ '^[0-9]+$'
  AND CAST(LEFT(dp.sic_code, 2) AS INTEGER) BETWEEN 10 AND 14
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 15: electric_gas_utilities
-- SIC 49 (Electric/Gas/Sanitary) — TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'electric_gas_utilities' AS segment_code,
  'sic_waterfall'          AS assignment_method,
  0.72                     AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '49'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 16: doctors_physicians
-- SIC 80 (Health Services 8011-8049) — TIER5_MARGINAL
-- Narrowed to physician SIC range 80
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'doctors_physicians' AS segment_code,
  'sic_waterfall'      AS assignment_method,
  0.55                 AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '80'
  AND dp.sic_code ~ '^80[0-4]'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 17: nurses_healthcare
-- SIC 80 (Health Services 8049-8099) — TIER5_MARGINAL
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'nurses_healthcare' AS segment_code,
  'sic_waterfall'     AS assignment_method,
  0.50                AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '80'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 18: healthcare_admin
-- SIC 80 (Health Services — hospitals, nursing, admin)
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'healthcare_admin' AS segment_code,
  'sic_waterfall'    AS assignment_method,
  0.50               AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '80'
  AND dp.sic_code ~ '^80[5-9]'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 19: lawyers_legal
-- SIC 81 (Legal Services) — TIER5_MARGINAL
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'lawyers_legal' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.50            AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '81'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 20: teachers_edu
-- SIC 82 (Educational Services) — TIER5_MARGINAL
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'teachers_edu' AS segment_code,
  'sic_waterfall' AS assignment_method,
  0.45            AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '82'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 21: insurance_industry
-- SIC 63 (Insurance Carriers), 64 (Insurance Agents) — TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'insurance_industry' AS segment_code,
  'sic_waterfall'      AS assignment_method,
  0.72                 AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('63','64')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 22: retail_merchants
-- SIC 52-59 (all retail) — TIER1/2
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'retail_merchants' AS segment_code,
  'sic_waterfall'    AS assignment_method,
  0.75               AS confidence_score,
  NOW()
FROM core.donor_profile dp
WHERE dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
  AND LEFT(dp.sic_code, 2) ~ '^[0-9]+$'
  AND CAST(LEFT(dp.sic_code, 2) AS INTEGER) BETWEEN 52 AND 59
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 23: food_beverage_industry
-- SIC 20 (Food/Kindred Products) — TIER3_RELIABLE
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'food_beverage_industry' AS segment_code,
  'sic_waterfall'          AS assignment_method,
  0.68                     AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division = '20'
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- SEGMENT 24: hospitality_tourism
-- SIC 70 (Hotels), 58 (Eating/Drinking Places) — TIER3/4
-- ============================================================
INSERT INTO e59.donor_segment_assignment
  (cluster_id, segment_code, assignment_method, confidence_score, assigned_at)
SELECT DISTINCT
  dp.cluster_id,
  'hospitality_tourism' AS segment_code,
  'sic_waterfall'       AS assignment_method,
  0.62                  AS confidence_score,
  NOW()
FROM core.donor_profile dp
JOIN donor_intelligence.sic_divisions sd
  ON sd.sic_division = LEFT(dp.sic_code, 2)
WHERE sd.sic_division IN ('70','58')
  AND dp.cluster_id IS NOT NULL
  AND dp.sic_code IS NOT NULL
ON CONFLICT (cluster_id, segment_code) DO NOTHING;

-- ============================================================
-- POST-RUN VERIFICATION
-- ============================================================
SELECT
  segment_code,
  COUNT(*)            AS assignments,
  MIN(confidence_score) AS min_conf,
  MAX(confidence_score) AS max_conf
FROM e59.donor_segment_assignment
WHERE assignment_method = 'sic_waterfall'
GROUP BY segment_code
ORDER BY assignments DESC;

-- Total new + existing
SELECT
  assignment_method,
  COUNT(*)          AS total_rows,
  COUNT(DISTINCT cluster_id) AS unique_donors
FROM e59.donor_segment_assignment
GROUP BY assignment_method
ORDER BY total_rows DESC;

-- CANARY RE-CHECK
DO $$
DECLARE
  v_txns  INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), SUM(norm_amount::numeric)
  INTO v_txns, v_total
  FROM raw.ncboe_donations
  WHERE cluster_id = 372171;

  IF v_txns <> 147 OR ROUND(v_total, 2) <> 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL AFTER WRITE: % / %', v_txns, v_total;
  END IF;
  RAISE NOTICE 'CANARY OK AFTER WRITE: % / %', v_txns, v_total;
END $$;
