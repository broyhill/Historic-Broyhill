-- =====================================================
-- ECOSYSTEM 19: UNIFIED PEOPLE INTELLIGENCE PLATFORM
-- MASTER DEPLOYMENT SCRIPT
-- =====================================================
-- Deploy all 6 tables + 1 function in correct order
-- Run this script in Supabase SQL Editor
-- =====================================================

-- ============================================================
-- DEPLOYMENT ORDER (Critical - respect dependencies)
-- ============================================================
-- 1. persons (master table - no dependencies)
-- 2. person_ideology_classification (depends on persons)
-- 3. donor_profile (depends on persons)
-- 4. volunteer_profile (depends on persons)
-- 5. volunteer_sources (standalone lookup table)
-- 6. person_candidate_matches (depends on persons)
-- 7. calculate_volunteer_value_score function
-- ============================================================

\echo '===================================================='
\echo 'ECOSYSTEM 19: UNIFIED PEOPLE INTELLIGENCE PLATFORM'
\echo 'DEPLOYMENT STARTING'
\echo '===================================================='

\echo 'Step 1/7: Creating persons table (master person record)...'
\i ecosystem_19_table_01_persons.sql
\echo 'Step 1/7: ✓ COMPLETE'

\echo 'Step 2/7: Creating person_ideology_classification table...'
\i ecosystem_19_table_02_person_ideology_classification.sql
\echo 'Step 2/7: ✓ COMPLETE'

\echo 'Step 3/7: Creating donor_profile table...'
\i ecosystem_19_table_03_donor_profile.sql
\echo 'Step 3/7: ✓ COMPLETE'

\echo 'Step 4/7: Creating volunteer_profile table...'
\i ecosystem_19_table_04_volunteer_profile.sql
\echo 'Step 4/7: ✓ COMPLETE'

\echo 'Step 5/7: Creating volunteer_sources table...'
\i ecosystem_19_table_05_volunteer_sources.sql
\echo 'Step 5/7: ✓ COMPLETE'

\echo 'Step 6/7: Creating person_candidate_matches table...'
\i ecosystem_19_table_06_person_candidate_matches.sql
\echo 'Step 6/7: ✓ COMPLETE'

\echo 'Step 7/7: Creating calculate_volunteer_value_score function...'
\i ecosystem_19_function_calculate_vvs.sql
\echo 'Step 7/7: ✓ COMPLETE'

\echo '===================================================='
\echo 'ECOSYSTEM 19 DEPLOYMENT COMPLETE!'
\echo '===================================================='
\echo ''
\echo 'DATABASE SUMMARY:'
\echo '  6 Tables Created'
\echo '  1 Function Created'
\echo '  30+ Volunteer Sources Pre-loaded'
\echo '  Ready for 112,609 person records'
\echo ''
\echo 'WHAT TO DO NEXT:'
\echo '  1. Import person data (donors + volunteers)'
\echo '  2. Calculate ideology classifications'
\echo '  3. Create donor profiles for is_donor=TRUE'
\echo '  4. Create volunteer profiles for is_volunteer=TRUE'
\echo '  5. Calculate VVS scores for all volunteers'
\echo '  6. Generate candidate matches'
\echo ''
\echo 'For detailed documentation, see: README_ECOSYSTEM_19.md'
\echo '===================================================='

