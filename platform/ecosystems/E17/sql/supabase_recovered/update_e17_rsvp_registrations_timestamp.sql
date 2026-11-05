-- Recovered from Supabase legacy DB (isbgjpnbocdkeslofota), inventory 2026-07-23.
-- Never previously committed to the repo. Read-only recovery; not applied anywhere.

CREATE OR REPLACE FUNCTION public.update_e17_rsvp_registrations_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $function$

