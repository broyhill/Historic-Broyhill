-- Recovered from Supabase legacy DB (isbgjpnbocdkeslofota), inventory 2026-07-23.
-- Never previously committed to the repo. Read-only recovery; not applied anywhere.

CREATE OR REPLACE FUNCTION public.update_e17_ai_script_generator_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
            BEGIN
              NEW.updated_at = now();
              RETURN NEW;
            END;
            $function$

