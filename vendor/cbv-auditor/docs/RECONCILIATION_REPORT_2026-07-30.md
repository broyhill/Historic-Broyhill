# Reconciliation report — 2026-07-30

generated: 2026-07-30 20:39 UTC by `scripts/reconcile.py` (safeguard G9)
commit: f709e1c9
canary: cluster 372171 = 147 / $332631.30

**461 findings, 121 blocking.**

Blocking means the work stops until the table exists or the artifact is marked DDL-first.
Not an alert to read past — Claude's G9 design, 2026-07-30: "Not alert and continue.
Block. The block needs to be before execution, not during."

## MIGRATION NOT APPLIED — 318

Committed to main outside dryrun/, with no ops.deploy_log row. Either it was applied and never logged, or it was never applied and something downstream assumes it was.

- `database/e19_integration_schema.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_01_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_02_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_03_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_04_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_05_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_06_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_07_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_08_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_09_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_10_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_11_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_12_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_13_of_14.sql`
- `database/fix_scripts/fix08_prestep_c/chunk_14_of_14.sql`
- `database/fix_scripts/fix08_prestep_c_fast/chunk_10_fast.sql`
- `database/fix_scripts/fix08_prestep_c_fast/chunk_11_fast.sql`
- `database/fix_scripts/fix08_prestep_c_fast/chunk_12_fast.sql`
- `database/fix_scripts/fix08_prestep_c_fast/chunk_13_fast.sql`
- `database/fix_scripts/fix08_prestep_c_fast/chunk_14_fast.sql`
- `database/fix_scripts/fix_08b_remove_democratic_donors.sql`
- `database/fix_scripts/fix_09/fix09_chunk_01.sql`
- `database/fix_scripts/fix_09/fix09_chunk_02.sql`
- `database/fix_scripts/fix_09/fix09_chunk_03.sql`
- `database/fix_scripts/fix_09/fix09_chunk_04.sql`
- `database/fix_scripts/fix_10_party_filter_spine.sql`
- `database/hetzner/100_HETZNER_PLATFORM_SCHEMA.sql`
- `database/hetzner/101_HETZNER_CANDIDATE_DATA_FLOW.sql`
- `database/hetzner/102_HETZNER_ECOSYSTEM_REGISTRY.sql`
- `database/migrations/001_sic_naics_scoring_v2.sql`
- `database/migrations/002_intelligence_district_tag_matrix.sql`
- `database/migrations/003_industry_partisan_score_full.sql`
- `database/migrations/003_local_issue_intelligence_schema.sql`
- `database/migrations/003_signal_taxonomy_and_charity_ddl.sql`
- `database/migrations/004_brain_event_queue_event_class_fix.sql`
- `database/migrations/004_e72_campaign_investment_engine.sql`
- `database/migrations/006_donor_charity_intelligence_schema.sql`
- `database/migrations/008_retired_prior_industry_resolution.sql`
- `database/migrations/01_export_donors_for_geocodio.sql`
- `database/migrations/051_NEXUS_SOCIAL_EXTENSION.sql`
- …and 278 more

## ORPHAN DEPLOY — 22

Applied to live, artifact no longer in the repo. The change cannot be reviewed or reversed from what is committed.

- `deploy 1 → database/migrations/dryrun/OPS_GOVERNANCE_SAFEGUARDS_V1_2026-07-13.sql`
- `deploy 10 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_VIP_BOARD_NETWORK_2026-07-13.sql`
- `deploy 11 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_NTEE_MISSION_DECODE_2026-07-13.sql`
- `deploy 12 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_CHARITY_INFLUENCE_SCORE_2026-07-13.sql`
- `deploy 13 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_OFFICER_VARIANT_REMATCH_2026-07-13.sql`
- `deploy 14 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_DUP_MERGE_GOLD_TIER_2026-07-13.sql`
- `deploy 15 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_FOUND_A_VET_A_WELD_2026-07-13.sql`
- `deploy 16 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_KEYLESS_GOLD_ENTITY_RESOLUTION/EXEC_WINRED_ER_WELD_2026-07-13.sql`
- `deploy 17 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_KEYLESS_GOLD_ENTITY_RESOLUTION/EXEC_KEYLESS_GOLD_ER_ALL_2026-07-13.sql`
- `deploy 18 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_KEYLESS_GOLD_ENTITY_RESOLUTION/EXEC_NC_PAC_INDIVIDUAL_WELD_2026-07-14.sql`
- `deploy 19 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_KEYLESS_GOLD_ENTITY_RESOLUTION/EXEC_DT_PHONE_ENRICHMENT_2026-07-14.sql`
- `deploy 2 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_REGID_KEY_PROPAGATION/EXEC_REGID_KEY_PROPAGATION_2026-07-13.sql`
- `deploy 20 → database/migrations/117_brain_triggers_gearbox_seed_2026-07-14.sql`
- `deploy 3 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_PARTY_COMMITTEE_WELD/EXEC_PARTY_COMMITTEE_WELD_2026-07-13.sql`
- `deploy 38 → https://github.com/broyhill/BroyhillGOP/pull/247`
- `deploy 4 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_PAC_A_EMPLOYER_PAC_WELD_2026-07-13.sql`
- `deploy 42 → BGOP_OUTCOME_MEASUREMENT_DDL_2026-07-25.sql`
- `deploy 5 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_FEC_RAW_SPINE_LOAD/EXEC_FEC_RAW_SPINE_LOAD_2026-07-13.sql`
- `deploy 6 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_PARTY_COMMITTEE_WELD/EXEC_PARTY_WELD_SYNTHETIC_IDS_2026-07-13.sql`
- `deploy 7 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_527_A_GIVING_TOTAL_WELD_2026-07-13.sql`
- `deploy 8 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_527_B_DISCLOSURE_LOAD_2026-07-13.sql`
- `deploy 9 → UNDEPLOYED BROYHILLGOP CODE/database/2026-07-13_ENRICHMENT_WELDS_PAC_527_CHARITY/EXEC_CHAR_A_DONOR_CHARITY_WELD_2026-07-13.sql`

## DEAD REFERENCE — BLOCKING — 109

References a table that does not exist live, in a schema that does. This is the March 17 premise: the work assumes state that is not there.

- `database/migrations/001_sic_naics_scoring_v2.sql → state_legislature.employer_naics_classification`
- `database/migrations/002_intelligence_district_tag_matrix.sql → social_intelligence.scraping_targets`
- `database/migrations/006_donor_charity_intelligence_schema.sql → public.person_board_memberships, staging.staging_claude_nc_foundations`
- `database/migrations/055_DONATION_SEARCH_VIEW.sql → public.nc_boe_donations_raw`
- `database/migrations/056_VOTER_PROFILE_DATATRUST.sql → public.nc_datatrust`
- `database/migrations/057_DONOR_ANALYSIS_VIEW.sql → public.nc_boe_donations_raw, public.nc_datatrust`
- `database/migrations/059_FEC_SEPARATE_COMMITTEES.sql → norm.fec_individual`
- `database/migrations/060_DATATRUST_DONOR_CANDIDATE_AFFINITY.sql → public.nc_boe_donations_raw, public.nc_datatrust`
- `database/migrations/061_DATATRUST_AFFINITY_EXTENDED.sql → public.nc_datatrust, public.vw_donor_datatrust_base`
- `database/migrations/062_DATATRUST_FULL_2500_AFFINITY.sql → public.acxiom_consumer_data, public.nc_datatrust, public.vw_donor_datatrust_base`
- `database/migrations/063_NCBOE_GENERAL_FUND_INGESTION.sql → public.nc_boe_donations_raw`
- `database/migrations/064_NCBOE_GENERAL_TYPE_RENORMALIZE.sql → public.nc_boe_donations_raw`
- `database/migrations/066_PHASE1_SPINE_DEDUP.sql → core.person_spine, staging.spine_clusters`
- `database/migrations/067_PHASE1B_EXECUTE_MERGES.sql → core.person_spine, staging.spine_clusters`
- `database/migrations/068_PHASE2_VOTER_MATCHING.sql → core.person_spine, staging.spine_canonical`
- `database/migrations/069_PHASE3_FEC_DONATIONS_MAPPING.sql → core.person_spine, staging.spine_canonical`
- `database/migrations/070_PHASE4_BRIDGE_AND_AGGREGATES.sql → core.person_spine`
- `database/migrations/071_identity_rollup_revised.sql → public.name_nickname_map, public.nc_boe_donations_raw, public.person_master`
- `database/migrations/075_fec_donor_person_matching.sql → core.person_spine, public.fec_donations`
- `database/migrations/076_golden_record_spine_bridge.sql → core.person_spine, public.donor_contribution_map`
- `database/migrations/077_populate_contribution_map.sql → core.contribution_map, core.fec_donation_person_map, core.golden_record_person_map, public.donor_contribution_map, public.fec_donations`
- `database/migrations/078_recalculate_spine_aggregates.sql → core.contribution_map, core.person_spine`
- `database/migrations/079_pass2_identity_resolution.sql → core.contribution_map, core.fec_donation_person_map, core.person_spine, public.fec_donations`
- `database/migrations/080_spine_dedup_five_pass.sql → core.contribution_map, core.fec_donation_person_map, core.identity_clusters, core.person_spine, public.fec_donations, public.name_variants`
- `database/migrations/080b_repair_golden_bridges.sql → core.golden_record_person_map, core.person_spine, staging.spine_clusters`
- `database/migrations/080c_rebuild_fec_from_raw.sql → public.fec_donations`
- `database/migrations/081_normalize_fec_donations.sql → public.fec_donations, public.name_variants`
- `database/migrations/083_match_fec_to_spine.sql → core.person_spine, public.fec_donations`
- `database/migrations/083_match_fec_to_spine_v2.sql → core.person_spine, public.fec_donations, public.name_variants`
- `database/migrations/083_match_fec_to_spine_v3.sql → core.person_spine, public.fec_donations, public.name_variants`
- `database/migrations/084_match_party_to_spine.sql → core.contribution_map, core.person_spine, public.fec_party_committee_donations, public.name_variants`
- `database/migrations/085_rebuild_contribution_map.sql → core.contribution_map, core.person_spine, public.fec_donations`
- `database/migrations/086_completion_fixes.sql → core.contribution_map, core.fec_donation_person_map, core.golden_record_person_map, core.person_spine, public.fec_committees, public.fec_donations`
- `database/migrations/087_exec_and_remaining_fixes.sql → core.contribution_map, core.fec_donation_person_map, core.golden_record_person_map, core.person_spine, public.fec_committees, public.fec_donations`
- `database/migrations/088_WAVE1_VOTER_DATATRUST_FOUNDATION.sql → public.nc_datatrust, public.nc_voters, staging.spine_clusters, staging.spine_merge_candidates`
- `database/migrations/089_WAVE1_REFRESH_SPINE_VOTER_FLAGS.sql → core.person_spine, public.nc_voters`
- `database/migrations/090_WAVE1_DONOR_VOTER_LINKS_ORPHAN_TAG.sql → public.donor_contacts, public.donor_voter_links`
- `database/migrations/091_REF_DONOR_VOTER_LINKS_TRUSTED_VIEW.sql → public.donor_voter_links`
- `database/migrations/093_REF_NC_VOTERS_ACTIVE_VIEW.sql → public.nc_voters`
- `database/migrations/093_fec_candidate_id_backfill.sql → public.committee_party_map, public.fec_donations`
- …and 69 more

## SCHEMA ABSENT — BLOCKING — 12

SQL scoped to an ecosystem with no live schema. DDL comes first, or the lane number is wrong.

- `database/migrations/004_e72_campaign_investment_engine.sql → e34, e38, e61`
- `database/migrations/201_e39_fundraiser_pipeline.sql → e39`
- `database/migrations/2026-07-01_affinity_reminder_donor_profile.sql → e01`
- `database/migrations/319_canon15_channel_registry.sql → e41`
- `database/migrations/320_canon15_movement_patterns.sql → e41`
- `database/migrations/321_canon15_campaign_stops.sql → e41, e72`
- `database/migrations/322_canon15_compliance_gate_log.sql → e41`
- `database/migrations/MOMENTUM_SCORING_ENGINE_v1.0.sql → e63`
- `database/migrations/dryrun/201_e39_fundraiser_pipeline_DRYRUN.sql → e39`
- `database/migrations/dryrun/2026-07-05_DRYRUN_E22_WHATS_WORKING.sql → e22`
- `database/migrations/dryrun/E41_CAMPAIGN_BUILDER_SCHEMA_V1_2026-07-28.sql → e41`
- `database/migrations/unified_messaging_taxonomy.sql → e41`

## Classification of the unlogged migrations

| | count | reading |
|---|---:|---|
| at least one created object exists live | 72 | ran, never logged — the audit trail has a hole |
| no created object exists live | 69 | never ran here — anything downstream assuming it is writing against nothing |
| creates no object (ALTER/INSERT only) | 177 | undecidable by object existence; needs a data-level check |

The dichotomy in the question was false, and the largest group is the one neither branch
covers. Note also that 'never ran here' is not 'never ran' -- several reference
`public.nc_datatrust` and `public.nc_boe_donations_raw`, which were Supabase objects. Those
migrations very likely ran, against a database that no longer exists.

### Ran, never logged — 72

- `database/hetzner/100_HETZNER_PLATFORM_SCHEMA.sql (21 of 22 objects live)`
- `database/hetzner/101_HETZNER_CANDIDATE_DATA_FLOW.sql (11 of 12 objects live)`
- `database/hetzner/102_HETZNER_ECOSYSTEM_REGISTRY.sql (8 of 8 objects live)`
- `database/migrations/002_intelligence_district_tag_matrix.sql (1 of 1 objects live)`
- `database/migrations/003_industry_partisan_score_full.sql (1 of 1 objects live)`
- `database/migrations/003_signal_taxonomy_and_charity_ddl.sql (1 of 3 objects live)`
- `database/migrations/006_donor_charity_intelligence_schema.sql (1 of 3 objects live)`
- `database/migrations/099_raw_ncboe_donations_gold_hetzner.sql (2 of 3 objects live)`
- `database/migrations/101_committee_enrichment_views.sql (2 of 2 objects live)`
- `database/migrations/117_race_competitive_state.sql (2 of 2 objects live)`
- `database/migrations/118_race_shared_donor.sql (2 of 2 objects live)`
- `database/migrations/200_e60_nervous_net.sql (3 of 3 objects live)`
- `database/migrations/200_private_contact_vault_schema.sql (5 of 5 objects live)`
- `database/migrations/201_e31_sms_enterprise_schema.sql (12 of 12 objects live)`
- `database/migrations/2026-06-28_ORG_INTELLIGENCE_EXECUTE.sql (15 of 15 objects live)`
- `database/migrations/2026-06-28_match_dark_donor_EXECUTE.sql (1 of 1 objects live)`
- `database/migrations/2026-07-01_employer_sic_master_link.sql (1 of 1 objects live)`
- `database/migrations/2026-07-01_geocodio_queue_and_zip9_trigger.sql (1 of 1 objects live)`
- `database/migrations/2026-07-01_ibe2360_sic_crosswalk.sql (1 of 1 objects live)`
- `database/migrations/2026-07-01_master_unified_donor_profile_link.sql (1 of 1 objects live)`
- `database/migrations/2026-07-02_party_spine_xref.sql (1 of 1 objects live)`
- `database/migrations/2026-07-10_session_discoveries_closet.sql (1 of 1 objects live)`
- `database/migrations/202_donor_search_infrastructure.sql (6 of 6 objects live)`
- `database/migrations/210_data_governance_schema.sql (5 of 5 objects live)`
- `database/migrations/220_donor_monitoring_schema.sql (4 of 4 objects live)`
- `database/migrations/230_prospect_file_schema.sql (4 of 4 objects live)`
- `database/migrations/240_acquisition_engine_schema.sql (6 of 6 objects live)`
- `database/migrations/323_e30_consent_send_suppression.sql (5 of 5 objects live)`
- `database/migrations/ANSWER_ENGINE_ENABLEMENT_SCHEMA_EXECUTED_2026-07-08.sql (11 of 11 objects live)`
- `database/migrations/CREATE_APPOINTMENT_CHAIN_SCHEMA_2026-06-04.sql (3 of 3 objects live)`
- …and 42 more

### Never ran here — 69

- `database/migrations/003_local_issue_intelligence_schema.sql → geo.nc_jurisdictions, social_intelligence.county_heat_summary, social_intelligence.eddie_approval_queue`
- `database/migrations/004_e72_campaign_investment_engine.sql → e61.action_benefits, e61.action_costs, e61.action_selections`
- `database/migrations/053_NEXUS_PLATFORM_INTEGRATION.sql → intelligence_brain.nexus_decisions, intelligence_brain.nexus_trigger_types`
- `database/migrations/055_DONATION_SEARCH_VIEW.sql → public.donation_search_ncboe, public.nc_zip_county`
- `database/migrations/057_DONOR_ANALYSIS_VIEW.sql → public.vw_donor_analysis_consolidated`
- `database/migrations/058_FEC_VOTER_MATCHES.sql → public.fec_voter_matches`
- `database/migrations/059_FEC_SEPARATE_COMMITTEES.sql → staging.fec_non_individual_contributions`
- `database/migrations/060_DATATRUST_DONOR_CANDIDATE_AFFINITY.sql → public.vw_donor_datatrust_base`
- `database/migrations/063_NCBOE_GENERAL_FUND_INGESTION.sql → staging.staging_general_fund`
- `database/migrations/066_PHASE1_SPINE_DEDUP.sql → staging.spine_canonical, staging.spine_merge_candidates`
- `database/migrations/068_PHASE2_VOTER_MATCHING.sql → staging.voter_canonical`
- `database/migrations/075_fec_donor_person_matching.sql → core.fec_donation_person_map, public.migration_075_audit, public.migration_075_snapshot`
- `database/migrations/076_golden_record_spine_bridge.sql → core.golden_record_person_map, public.migration_076_audit, public.migration_076_snapshot`
- `database/migrations/077_populate_contribution_map.sql → public.migration_077_audit`
- `database/migrations/078_recalculate_spine_aggregates.sql → public.migration_078_audit, public.migration_078_snapshot`
- `database/migrations/080b_repair_golden_bridges.sql → public.repair_orphans_log`
- `database/migrations/080c_rebuild_fec_from_raw.sql → staging.fec_person_linkages`
- `database/migrations/083_match_fec_to_spine.sql → public.fec_spine_match_candidates`
- `database/migrations/083_match_fec_to_spine_v3.sql → staging.fec_canonical, staging.spine_canonical`
- `database/migrations/084_match_party_to_spine.sql → staging.party_canonical, staging.spine_canonical`
- `database/migrations/088_WAVE1_VOTER_DATATRUST_FOUNDATION.sql → pipeline.wave1_source_snapshots, ref.v_datatrust_registration, ref.v_nc_voter_canonical`
- `database/migrations/091_REF_DONOR_VOTER_LINKS_TRUSTED_VIEW.sql → ref.v_donor_voter_links_trusted`
- `database/migrations/093_REF_NC_VOTERS_ACTIVE_VIEW.sql → ref.v_nc_voters_active`
- `database/migrations/094_REF_PERSON_SPINE_SBE_ENRICHED_VIEW.sql → ref.v_person_spine_sbe_enriched`
- `database/migrations/095_REF_PIPELINE_NCBOE_LOADS_VIEW.sql → ref.v_pipeline_ncboe_loads`
- `database/migrations/095_create_pipeline_loaded_fec_files.sql → pipeline.loaded_fec_files`
- `database/migrations/096_REF_CONTRIBUTION_MAP_PARTY_SUMMARY.sql → ref.v_contribution_map_party_summary`
- `database/migrations/097_INTEGRATION_DATATRUST_CONTACT_LINK.sql → integration.datatrust_contact_link`
- `database/migrations/098_UNIFIED_CONTACTS_STUB_AND_DATATRUST_BACKFILL.sql → public.unified_contacts`
- `database/migrations/100_public_views_golden_records.sql → public.donor_golden_records, public.donor_master`
- …and 39 more

## What this does not do

Catches dead references after they are written, not before. Claude's own point, and it is
the honest limit: the upstream fix is the DESIGN ONLY tag plus a snapshot citation in every
spec, so a dead reference never leaves the author's hands. This check is the backstop for
when that discipline lapses -- and it will, which is why the backstop is a script.

