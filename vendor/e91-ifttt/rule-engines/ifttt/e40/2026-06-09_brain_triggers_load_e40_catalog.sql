-- ============================================================================
-- MIGRATION: Load E40 trigger catalog into brain.triggers
-- File: database/migrations/2026-06-09_brain_triggers_load_e40_catalog.sql
-- Author: Claude (execution lane)  |  Authority: J. Edgar Broyhill (sole)
-- Source: ecosystems/ecosystem_40_automation_control_panel_complete.py
--         TRIGGERS (65) + NEWS_INTELLIGENCE_TRIGGERS (19)
--         merged exactly as runtime does (panel.triggers.update(news))
-- Loads: 83 unique trigger definitions
-- Target schema: brain.triggers — DAEMON-CANONICAL DDL
--   (verbatim from brain_worker.py BRAIN_SCHEMA_DDL; see
--    docs/handoffs/BRAIN_SCHEMA_RECONCILIATION_PATCH_2026-05-22.sql)
--
-- TWO-PHASE PROTOCOL:
--   PHASE 1 (DRY RUN): run STEP 0 only, report column list + current count to Ed.
--   PHASE 2 (EXECUTE): after Ed says "I authorize this action", run STEP 1-3.
--
-- IDEMPOTENT: ON CONFLICT (trigger_id) DO NOTHING. Re-running is safe and will
--   only add triggers that are missing. Existing rows (incl. the live 16) are
--   never modified or deleted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0  ·  DRY-RUN INSPECTION  (run this FIRST, report back, do not write)
-- ----------------------------------------------------------------------------
-- 0a. Confirm the live table shape:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='brain' AND table_name='triggers' ORDER BY ordinal_position;
-- 0b. Confirm current row count (expected ~16 before load):
--   SELECT count(*) AS triggers_before FROM brain.triggers;
-- 0c. Show the existing rows so we never clobber them:
--   SELECT trigger_id, name, trigger_family FROM brain.triggers ORDER BY trigger_id;

-- ----------------------------------------------------------------------------
-- STEP 1  ·  SAFETY GUARD  (aborts if table is NOT the daemon-canonical shape)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='brain' AND table_name='triggers'
      AND column_name='trigger_family'
  ) THEN
    RAISE EXCEPTION
      'brain.triggers is NOT in daemon-canonical shape (no trigger_family column). '
      'STOP. The live table is the legacy UUID/category/conditions/actions shape. '
      'Run BRAIN_SCHEMA_RECONCILIATION_PATCH_2026-05-22.sql first (Ed must authorize), '
      'then re-run this migration.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2  ·  LOAD  (83 triggers, idempotent)
-- ----------------------------------------------------------------------------
BEGIN;

INSERT INTO brain.triggers
  (trigger_id, trigger_class, trigger_family, name, description,
   condition_event_code, action_type, action_params, affected_ecosystems)
VALUES
  ('contact.created','event','contact','Contact Created','','contact.created','log','{"source_ecosystem":"E0","event_code":"contact.created"}'::jsonb, ARRAY['E0']::text[]),
  ('contact.updated','event','contact','Contact Updated','','contact.updated','log','{"source_ecosystem":"E0","event_code":"contact.updated"}'::jsonb, ARRAY['E0']::text[]),
  ('contact.tag_added','event','contact','Tag Added to Contact','','contact.tag_added','log','{"source_ecosystem":"E0","event_code":"contact.tag_added"}'::jsonb, ARRAY['E0']::text[]),
  ('contact.tag_removed','event','contact','Tag Removed from Contact','','contact.tag_removed','log','{"source_ecosystem":"E0","event_code":"contact.tag_removed"}'::jsonb, ARRAY['E0']::text[]),
  ('contact.merged','event','contact','Contacts Merged','','contact.merged','log','{"source_ecosystem":"E0","event_code":"contact.merged"}'::jsonb, ARRAY['E0']::text[]),
  ('donor.grade_changed','event','donor','Donor Grade Changed','','donor.grade_changed','log','{"source_ecosystem":"E1","event_code":"donor.grade_changed"}'::jsonb, ARRAY['E1']::text[]),
  ('donor.became_major','event','donor','Became Major Donor','','donor.became_major','log','{"source_ecosystem":"E1","event_code":"donor.became_major"}'::jsonb, ARRAY['E1']::text[]),
  ('donor.became_lapsed','event','donor','Donor Lapsed','','donor.became_lapsed','log','{"source_ecosystem":"E1","event_code":"donor.became_lapsed"}'::jsonb, ARRAY['E1']::text[]),
  ('donor.reactivated','event','donor','Lapsed Donor Reactivated','','donor.reactivated','log','{"source_ecosystem":"E1","event_code":"donor.reactivated"}'::jsonb, ARRAY['E1']::text[]),
  ('donor.upgrade_potential','event','donor','Upgrade Potential Detected','','donor.upgrade_potential','log','{"source_ecosystem":"E1","event_code":"donor.upgrade_potential"}'::jsonb, ARRAY['E1']::text[]),
  ('donation.received','event','donation','Donation Received','','donation.received','log','{"source_ecosystem":"E2","event_code":"donation.received"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.first','event','donation','First-Time Donation','','donation.first','log','{"source_ecosystem":"E2","event_code":"donation.first"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.recurring_started','event','donation','Recurring Donation Started','','donation.recurring_started','log','{"source_ecosystem":"E2","event_code":"donation.recurring_started"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.recurring_cancelled','event','donation','Recurring Cancelled','','donation.recurring_cancelled','log','{"source_ecosystem":"E2","event_code":"donation.recurring_cancelled"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.failed','event','donation','Donation Failed','','donation.failed','log','{"source_ecosystem":"E2","event_code":"donation.failed"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.refunded','event','donation','Donation Refunded','','donation.refunded','log','{"source_ecosystem":"E2","event_code":"donation.refunded"}'::jsonb, ARRAY['E2']::text[]),
  ('donation.threshold','event','donation','Donation Amount Threshold','','donation.threshold','log','{"source_ecosystem":"E2","event_code":"donation.threshold"}'::jsonb, ARRAY['E2']::text[]),
  ('email.sent','event','email','Email Sent','','email.sent','log','{"source_ecosystem":"E30","event_code":"email.sent"}'::jsonb, ARRAY['E30']::text[]),
  ('email.delivered','event','email','Email Delivered','','email.delivered','log','{"source_ecosystem":"E30","event_code":"email.delivered"}'::jsonb, ARRAY['E30']::text[]),
  ('email.opened','event','email','Email Opened','','email.opened','log','{"source_ecosystem":"E30","event_code":"email.opened"}'::jsonb, ARRAY['E30']::text[]),
  ('email.clicked','event','email','Email Link Clicked','','email.clicked','log','{"source_ecosystem":"E30","event_code":"email.clicked"}'::jsonb, ARRAY['E30']::text[]),
  ('email.bounced','event','email','Email Bounced','','email.bounced','log','{"source_ecosystem":"E30","event_code":"email.bounced"}'::jsonb, ARRAY['E30']::text[]),
  ('email.unsubscribed','event','email','Unsubscribed','','email.unsubscribed','log','{"source_ecosystem":"E30","event_code":"email.unsubscribed"}'::jsonb, ARRAY['E30']::text[]),
  ('email.replied','event','email','Email Replied','','email.replied','log','{"source_ecosystem":"E30","event_code":"email.replied"}'::jsonb, ARRAY['E30']::text[]),
  ('email.not_opened','event','email','Email Not Opened (after X days)','','email.not_opened','log','{"source_ecosystem":"E30","event_code":"email.not_opened"}'::jsonb, ARRAY['E30']::text[]),
  ('sms.received','event','sms','SMS Received','','sms.received','log','{"source_ecosystem":"E31","event_code":"sms.received"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.keyword','event','sms','Keyword Matched','','sms.keyword','log','{"source_ecosystem":"E31","event_code":"sms.keyword"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.opt_out','event','sms','SMS Opt-Out','','sms.opt_out','log','{"source_ecosystem":"E31","event_code":"sms.opt_out"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.opt_in','event','sms','SMS Opt-In','','sms.opt_in','log','{"source_ecosystem":"E31","event_code":"sms.opt_in"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.clicked','event','sms','SMS Link Clicked','','sms.clicked','log','{"source_ecosystem":"E31","event_code":"sms.clicked"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.delivered','event','sms','SMS Delivered','','sms.delivered','log','{"source_ecosystem":"E31","event_code":"sms.delivered"}'::jsonb, ARRAY['E31']::text[]),
  ('sms.failed','event','sms','SMS Failed','','sms.failed','log','{"source_ecosystem":"E31","event_code":"sms.failed"}'::jsonb, ARRAY['E31']::text[]),
  ('phone.call_completed','event','phone','Call Completed','','phone.call_completed','log','{"source_ecosystem":"E32","event_code":"phone.call_completed"}'::jsonb, ARRAY['E32']::text[]),
  ('phone.voicemail_left','event','phone','Voicemail Left','','phone.voicemail_left','log','{"source_ecosystem":"E35","event_code":"phone.voicemail_left"}'::jsonb, ARRAY['E35']::text[]),
  ('phone.callback_requested','event','phone','Callback Requested','','phone.callback_requested','log','{"source_ecosystem":"E35","event_code":"phone.callback_requested"}'::jsonb, ARRAY['E35']::text[]),
  ('phone.ivr_selection','event','phone','IVR Option Selected','','phone.ivr_selection','log','{"source_ecosystem":"E35","event_code":"phone.ivr_selection"}'::jsonb, ARRAY['E35']::text[]),
  ('phone.call_transferred','event','phone','Call Transferred','','phone.call_transferred','log','{"source_ecosystem":"E35","event_code":"phone.call_transferred"}'::jsonb, ARRAY['E35']::text[]),
  ('phone.positive_call','event','phone','Positive Call Disposition','','phone.positive_call','log','{"source_ecosystem":"E32","event_code":"phone.positive_call"}'::jsonb, ARRAY['E32']::text[]),
  ('phone.negative_call','event','phone','Negative Call Disposition','','phone.negative_call','log','{"source_ecosystem":"E32","event_code":"phone.negative_call"}'::jsonb, ARRAY['E32']::text[]),
  ('social.post_published','event','social','Post Published','','social.post_published','log','{"source_ecosystem":"E19","event_code":"social.post_published"}'::jsonb, ARRAY['E19']::text[]),
  ('social.engagement_threshold','event','social','Engagement Threshold Reached','','social.engagement_threshold','log','{"source_ecosystem":"E19","event_code":"social.engagement_threshold"}'::jsonb, ARRAY['E19']::text[]),
  ('social.mention','event','social','Brand Mentioned','','social.mention','log','{"source_ecosystem":"E19","event_code":"social.mention"}'::jsonb, ARRAY['E19']::text[]),
  ('social.comment','event','social','Comment Received','','social.comment','log','{"source_ecosystem":"E19","event_code":"social.comment"}'::jsonb, ARRAY['E19']::text[]),
  ('social.share','event','social','Post Shared','','social.share','log','{"source_ecosystem":"E19","event_code":"social.share"}'::jsonb, ARRAY['E19']::text[]),
  ('event.rsvp','event','event','Event RSVP','','event.rsvp','log','{"source_ecosystem":"E34","event_code":"event.rsvp"}'::jsonb, ARRAY['E34']::text[]),
  ('event.rsvp_cancelled','event','event','RSVP Cancelled','','event.rsvp_cancelled','log','{"source_ecosystem":"E34","event_code":"event.rsvp_cancelled"}'::jsonb, ARRAY['E34']::text[]),
  ('event.checked_in','event','event','Checked In to Event','','event.checked_in','log','{"source_ecosystem":"E34","event_code":"event.checked_in"}'::jsonb, ARRAY['E34']::text[]),
  ('event.no_show','event','event','No-Show Detected','','event.no_show','log','{"source_ecosystem":"E34","event_code":"event.no_show"}'::jsonb, ARRAY['E34']::text[]),
  ('event.reminder_due','event','event','Event Reminder Due','','event.reminder_due','log','{"source_ecosystem":"E34","event_code":"event.reminder_due"}'::jsonb, ARRAY['E34']::text[]),
  ('event.post_event','event','event','Event Ended','','event.post_event','log','{"source_ecosystem":"E34","event_code":"event.post_event"}'::jsonb, ARRAY['E34']::text[]),
  ('mail.sent','event','direct_mail','Mail Piece Sent','','mail.sent','log','{"source_ecosystem":"E33","event_code":"mail.sent"}'::jsonb, ARRAY['E33']::text[]),
  ('mail.delivered','event','direct_mail','Mail Delivered','','mail.delivered','log','{"source_ecosystem":"E33","event_code":"mail.delivered"}'::jsonb, ARRAY['E33']::text[]),
  ('mail.returned','event','direct_mail','Mail Returned','','mail.returned','log','{"source_ecosystem":"E33","event_code":"mail.returned"}'::jsonb, ARRAY['E33']::text[]),
  ('mail.responded','event','direct_mail','Mail Response Received','','mail.responded','log','{"source_ecosystem":"E33","event_code":"mail.responded"}'::jsonb, ARRAY['E33']::text[]),
  ('news.mention','event','news','News Mention Detected','','news.mention','log','{"source_ecosystem":"E42","event_code":"news.mention"}'::jsonb, ARRAY['E42']::text[]),
  ('news.sentiment_alert','event','news','Sentiment Alert','','news.sentiment_alert','log','{"source_ecosystem":"E42","event_code":"news.sentiment_alert"}'::jsonb, ARRAY['E42']::text[]),
  ('news.competitor_mention','event','news','Competitor Mentioned','','news.competitor_mention','log','{"source_ecosystem":"E42","event_code":"news.competitor_mention"}'::jsonb, ARRAY['E42']::text[]),
  ('news.issue_trending','event','news','Issue Trending in News','Specific issue gaining media traction','news.issue_trending','log','{"source_ecosystem":"E42","event_code":"news.issue_trending","config_options":["issue_keywords","trending_threshold","timeframe_hours"]}'::jsonb, ARRAY['E42']::text[]),
  ('time.schedule','schedule','time','Scheduled Time','','time.schedule','log','{"source_ecosystem":"CORE","event_code":"time.schedule"}'::jsonb, ARRAY['CORE']::text[]),
  ('time.recurring','schedule','time','Recurring Schedule','','time.recurring','log','{"source_ecosystem":"CORE","event_code":"time.recurring"}'::jsonb, ARRAY['CORE']::text[]),
  ('time.delay','schedule','time','After Delay','','time.delay','log','{"source_ecosystem":"CORE","event_code":"time.delay"}'::jsonb, ARRAY['CORE']::text[]),
  ('time.date_field','schedule','time','Date Field Reached','','time.date_field','log','{"source_ecosystem":"CORE","event_code":"time.date_field"}'::jsonb, ARRAY['CORE']::text[]),
  ('webhook.received','webhook','webhook','Webhook Received','','webhook.received','log','{"source_ecosystem":"CORE","event_code":"webhook.received"}'::jsonb, ARRAY['CORE']::text[]),
  ('webhook.actblue','webhook','webhook','ActBlue Webhook','','webhook.actblue','log','{"source_ecosystem":"E2","event_code":"webhook.actblue"}'::jsonb, ARRAY['E2']::text[]),
  ('webhook.winred','webhook','webhook','WinRed Webhook','','webhook.winred','log','{"source_ecosystem":"E2","event_code":"webhook.winred"}'::jsonb, ARRAY['E2']::text[]),
  ('news.breaking_mention','event','news','Breaking News Mention','Candidate mentioned in breaking news','news.breaking_mention','log','{"source_ecosystem":"E42","event_code":"news.breaking_mention","config_options":["candidate_id","min_reach","source_tier"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.crisis_detected','event','news','Crisis/Negative Coverage Detected','Negative coverage exceeds threshold','news.crisis_detected','log','{"source_ecosystem":"E42","event_code":"news.crisis_detected","config_options":["candidate_id","sentiment_threshold","volume_threshold"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.competitor_attack','event','news','Competitor Attack Coverage','Opponent mentioned attacking candidate','news.competitor_attack','log','{"source_ecosystem":"E42","event_code":"news.competitor_attack","config_options":["candidate_id","opponent_id"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.issue_spike','event','news','Issue Mention Spike','Sudden increase in issue coverage','news.issue_spike','log','{"source_ecosystem":"E42","event_code":"news.issue_spike","config_options":["issue_id","spike_multiplier","baseline_period"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.hot_issue_local','event','news','Hot Issue in Local News','Issue trending in local/regional coverage','news.hot_issue_local','log','{"source_ecosystem":"E42","event_code":"news.hot_issue_local","config_options":["issue_keywords","counties","min_sources"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.issue_sentiment_shift','event','news','Issue Sentiment Shift','Public sentiment on issue changing','news.issue_sentiment_shift','log','{"source_ecosystem":"E42","event_code":"news.issue_sentiment_shift","config_options":["issue_id","sentiment_change_threshold","direction"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.positive_coverage','event','news','Positive Coverage Received','Positive media coverage detected','news.positive_coverage','log','{"source_ecosystem":"E42","event_code":"news.positive_coverage","config_options":["candidate_id","min_sentiment_score"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.endorsement_coverage','event','news','Endorsement in News','Endorsement mentioned in coverage','news.endorsement_coverage','log','{"source_ecosystem":"E42","event_code":"news.endorsement_coverage","config_options":["candidate_id","endorser_keywords"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.event_coverage','event','news','Event Received Coverage','Campaign event covered in media','news.event_coverage','log','{"source_ecosystem":"E42","event_code":"news.event_coverage","config_options":["candidate_id","event_id"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.opponent_gaffe','event','news','Opponent Gaffe/Mistake','Negative coverage of opponent','news.opponent_gaffe','log','{"source_ecosystem":"E42","event_code":"news.opponent_gaffe","config_options":["opponent_id","sentiment_threshold"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.opponent_policy','event','news','Opponent Policy Announcement','Opponent announced new policy position','news.opponent_policy','log','{"source_ecosystem":"E42","event_code":"news.opponent_policy","config_options":["opponent_id","policy_keywords"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.race_update','event','news','Race/Poll Update','New polling or race analysis published','news.race_update','log','{"source_ecosystem":"E42","event_code":"news.race_update","config_options":["race_id","source_tier"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.county_issue','event','news','Issue Hot in Specific County','Issue trending in target county','news.county_issue','log','{"source_ecosystem":"E42","event_code":"news.county_issue","config_options":["county_fips","issue_keywords"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.district_coverage','event','news','District-Specific Coverage','Coverage specifically about district','news.district_coverage','log','{"source_ecosystem":"E42","event_code":"news.district_coverage","config_options":["district_id","min_relevance"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.alert_critical','event','news','Critical Alert Triggered','Critical news alert (immediate action)','news.alert_critical','log','{"source_ecosystem":"E42","event_code":"news.alert_critical","config_options":["candidate_id"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.alert_high','event','news','High Priority Alert','High priority news situation','news.alert_high','log','{"source_ecosystem":"E42","event_code":"news.alert_high","config_options":["candidate_id"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.media_opportunity','event','news','Media Opportunity Detected','Opportunity to insert into news cycle','news.media_opportunity','log','{"source_ecosystem":"E42","event_code":"news.media_opportunity","config_options":["issue_keywords","opportunity_type"]}'::jsonb, ARRAY['E42']::text[]),
  ('news.reporter_interest','event','news','Reporter Showing Interest','Reporter covering relevant topic','news.reporter_interest','log','{"source_ecosystem":"E42","event_code":"news.reporter_interest","config_options":["reporter_id","topic_keywords"]}'::jsonb, ARRAY['E42']::text[])
ON CONFLICT (trigger_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- STEP 3  ·  VERIFY  (then COMMIT if counts look right, else ROLLBACK)
-- ----------------------------------------------------------------------------
SELECT count(*) AS triggers_after FROM brain.triggers;          -- expect ~16 + new
SELECT trigger_family, count(*) FROM brain.triggers
  GROUP BY trigger_family ORDER BY 2 DESC;

COMMIT;
-- ROLLBACK;  -- <- use instead of COMMIT if STEP 3 numbers look wrong
-- ============================================================================
-- END MIGRATION
-- ============================================================================
