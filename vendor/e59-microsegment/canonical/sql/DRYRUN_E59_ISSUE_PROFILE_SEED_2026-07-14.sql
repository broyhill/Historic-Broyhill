-- DRYRUN_E59_ISSUE_PROFILE_SEED_2026-07-14.sql
-- Source: database/migrations/RING1_SCHEMA_DEPLOY_MIGRATION_v1_2026-06-30.sql §9 (issue taxonomy seed)
-- Adapted: core.candidates has no mandate_profile column — mandate_score defaults 50 / tier SECONDARY.
-- Seeds one row per active candidate x 43 issue domains; scores 0 until daily 06:14 refresh fills.
-- Dry-run: ROLLBACK at end. Live run replaces ROLLBACK with COMMIT.

BEGIN;

DO $$ DECLARE v_txns INT; v_total NUMERIC;
BEGIN
  SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2) INTO v_txns, v_total
  FROM raw.ncboe_donations WHERE cluster_id = 372171;
  IF v_txns != 147 OR v_total != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL PRE: %/%', v_txns, v_total;
  END IF;
END $$;

INSERT INTO e59.issue_district_profile (
  candidate_id, issue_domain, issue_label, issue_category,
  district_affinity, donor_intensity, heat_score, forecast_state,
  forecast_sample_n, mandate_score, mandate_tier, computed_at
)
SELECT
  c.candidate_id,
  t.issue_domain, t.issue_label, t.issue_category,
  0, 0, 0,
  'NO_FORECAST_TEST_AVAILABLE',
  0, 50, 'SECONDARY',
  now()
FROM core.candidates c
CROSS JOIN (VALUES
  ('PROPERTY_TAX',         'Property Taxes',                         'Fiscal'),
  ('STATE_TAX',            'State Income & Sales Tax',               'Fiscal'),
  ('FEDERAL_TAX',          'Federal Tax Policy',                     'Fiscal'),
  ('PUBLIC_SPENDING_WASTE','Government Waste & Spending',            'Fiscal'),
  ('FISCAL_FRAUD',         'Public Funds Fraud & Misuse',            'Fiscal'),
  ('BUDGET_APPROPRIATIONS','Government Budget & Appropriations',     'Fiscal'),
  ('LAW_ENFORCEMENT_OPS',  'Law Enforcement & Public Safety',        'Law Enforcement'),
  ('CRIMINAL_PROSECUTION', 'Criminal Prosecution & Courts',          'Law Enforcement'),
  ('INCARCERATION',        'Jail & Prison Policy',                   'Law Enforcement'),
  ('DRUG_ENFORCEMENT',     'Drug Enforcement & Fentanyl',            'Law Enforcement'),
  ('PUBLIC_CORRUPTION',    'Public Corruption & Ethics',             'Law Enforcement'),
  ('HUMAN_TRAFFICKING',    'Human Trafficking',                      'Law Enforcement'),
  ('K12_CURRICULUM',       'K-12 Curriculum & Standards',            'Education'),
  ('SCHOOL_SAFETY',        'School Safety & Security',               'Education'),
  ('SCHOOL_PERSONNEL',     'Teacher Hiring, Pay & Accountability',   'Education'),
  ('SCHOOL_BUDGET',        'School System Finances',                 'Education'),
  ('SCHOOL_FISCAL_FRAUD',  'School Funds Fraud & Scandal',           'Education'),
  ('PARENTAL_RIGHTS',      'Parental Rights in Education',           'Education'),
  ('SPECIAL_EDUCATION',    'Special Education & IEP Services',       'Education'),
  ('SCHOOL_CHOICE',        'Charter Schools, Vouchers & Choice',     'Education'),
  ('LOCAL_ECON_DEV',       'Local Business & Job Creation',          'Economic'),
  ('STATE_ECON_DEV',       'Statewide Business Climate',             'Economic'),
  ('SMALL_BUSINESS',       'Small Business Regulation & Taxation',   'Economic'),
  ('AGRICULTURE',          'Farming, Agriculture & Rural Economy',   'Economic'),
  ('WORKFORCE_DEVELOPMENT','Job Training & Apprenticeships',         'Economic'),
  ('FAITH_COMMUNITY',      'Faith & Religious Community',            'Community'),
  ('CIVIC_ORGS',           'Civic Organizations',                    'Community'),
  ('VETERANS',             'Veterans & Military Community',          'Community'),
  ('FAMILY_VALUES',        'Family & Community Values',              'Community'),
  ('PUBLIC_EVENTS',        'Parades, Festivals & Public Events',     'Community'),
  ('NEIGHBORHOOD_QUALITY', 'Neighborhood Quality & Services',        'Community'),
  ('LOCAL_INFRASTRUCTURE', 'Local Roads, Water & Sewer',             'Infrastructure'),
  ('STATE_INFRASTRUCTURE', 'State Highways & Facilities',            'Infrastructure'),
  ('ENVIRONMENTAL_LOCAL',  'Local Water Quality & Land Use',         'Infrastructure'),
  ('ENVIRONMENTAL_STATE',  'Statewide Environmental Regulation',     'Infrastructure'),
  ('PUBLIC_HEALTH',        'Public Health & Disease Response',       'Health'),
  ('MENTAL_HEALTH',        'Mental Health & Crisis Response',        'Health'),
  ('OPIOID_CRISIS',        'Opioid Crisis & Addiction Treatment',    'Health'),
  ('HEALTHCARE_ACCESS',    'Healthcare Access & Insurance',          'Health'),
  ('SECOND_AMENDMENT',     'Second Amendment & Gun Rights',          'Rights'),
  ('FIRST_AMENDMENT',      'Free Speech & Religious Liberty',        'Rights'),
  ('PROPERTY_RIGHTS',      'Property Rights & Eminent Domain',       'Rights'),
  ('JUDICIAL_INDEPENDENCE','Judicial Integrity & Rule of Law',       'Rights')
) AS t(issue_domain, issue_label, issue_category)
WHERE c.status = 'active'
ON CONFLICT (candidate_id, issue_domain) DO NOTHING;

SELECT COUNT(*) AS seeded_rows FROM e59.issue_district_profile;

DO $$ DECLARE v_txns INT; v_total NUMERIC;
BEGIN
  SELECT COUNT(*), ROUND(SUM(norm_amount)::numeric,2) INTO v_txns, v_total
  FROM raw.ncboe_donations WHERE cluster_id = 372171;
  IF v_txns != 147 OR v_total != 332631.30 THEN
    RAISE EXCEPTION 'CANARY FAIL POST: %/%', v_txns, v_total;
  END IF;
  RAISE NOTICE 'CANARY PASS POST — E59 issue profile seed complete';
END $$;

ROLLBACK;
