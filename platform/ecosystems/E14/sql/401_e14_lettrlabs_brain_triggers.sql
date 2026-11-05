-- E14 Migration 401 — LettrLabs print triggers (active=FALSE per Batch B doctrine)
BEGIN;

INSERT INTO brain.triggers
  (trigger_id, trigger_class, trigger_family, name, description,
   condition_event_code, action_type, action_params,
   priority, cooldown_seconds, phase_relevance, affected_ecosystems,
   constitutional_layer, active, fire_count)
VALUES
  ('print.handwritten.thankyou_first_major_gift',
   'event', 'print',
   'First Major Gift Handwritten Thank-You',
   'donor.became_major or donation.first where tier=major → LettrLabs thank-you card',
   'donation.first',
   'lettrlabs_job',
   '{"template_id":"thankyou_major","channel":"print.handwritten","cooldown_hours":8760}'::jsonb,
   10, 31536000, '{1,2,3,4}'::int[], ARRAY['E14']::text[], 2, FALSE, 0),
  ('print.handwritten.host_confirmation',
   'event', 'print',
   'Host Confirmed — Handwritten Candidate Note',
   'event.host_confirmed → personal note from candidate to confirmed host',
   'event.host_confirmed',
   'lettrlabs_job',
   '{"template_id":"host_confirmation","channel":"print.handwritten","cooldown_hours":168}'::jsonb,
   10, 604800, '{1,2,3,4}'::int[], ARRAY['E14','E27']::text[], 2, FALSE, 0),
  ('print.handwritten.lapsed_major_reactivation',
   'event', 'print',
   'Lapsed Major Donor Reactivation Card',
   'donor.became_lapsed where last_tier=major, 90+ day gap → reactivation handwritten card',
   'donor.became_lapsed',
   'lettrlabs_job',
   '{"template_id":"lapsed_reactivation","channel":"print.handwritten","cooldown_hours":2160}'::jsonb,
   20, 7776000, '{1,2,3,4}'::int[], ARRAY['E14']::text[], 2, FALSE, 0),
  ('print.handwritten.post_event_upgrade',
   'event', 'print',
   'Post-Event Gift Upgrade Stewardship',
   'donation.received within 24h of event attendance with upgrade_at_event=true → stewardship card',
   'event.donation_at_event',
   'lettrlabs_job',
   '{"template_id":"post_event_upgrade","channel":"print.handwritten","cooldown_hours":720}'::jsonb,
   15, 2592000, '{1,2,3,4}'::int[], ARRAY['E14','E27']::text[], 2, FALSE, 0),
  ('print.handwritten.annual_loyalty',
   'event', 'print',
   'Annual Loyalty Recognition Card',
   'calendar.year_end for donors with years_of_giving >= 3 and gave_this_year=true',
   'calendar.year_end_loyalty_check',
   'lettrlabs_job',
   '{"template_id":"annual_loyalty","channel":"print.handwritten","cooldown_hours":8000}'::jsonb,
   30, 28800000, '{1,2,3,4}'::int[], ARRAY['E14']::text[], 3, FALSE, 0)
ON CONFLICT (trigger_id) DO NOTHING;

COMMIT;
