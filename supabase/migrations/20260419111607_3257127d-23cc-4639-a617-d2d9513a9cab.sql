-- Steg 5A.3 Del 1: datamodell för tidsmodell + time-cue-inställningar

-- 1) WPM per användare (talartid i ord/min). Default 140 = svensk normaltalartid.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wpm integer NOT NULL DEFAULT 140;

-- 2) target_seconds_is_manual: när TRUE betyder det att användaren själv satt
--    target_seconds. När FALSE räknas det om automatiskt från ord × WPM vid
--    sparande/visning. Default FALSE = auto.
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS target_seconds_is_manual boolean NOT NULL DEFAULT false;

-- 3) Visningstid för time-cues i presentationsläget (sekunder).
--    -1 = "tills nästa cue triggar". Default 15s enligt UX-spec.
ALTER TABLE public.manuscripts
  ADD COLUMN IF NOT EXISTS time_cue_display_seconds integer NOT NULL DEFAULT 15;

-- Sanity check: tillåt bara förnuftiga värden (5/15/30/-1) men håll det öppet
-- via trigger istället för CHECK (per project-regler om CHECK-restriktioner).
CREATE OR REPLACE FUNCTION public.validate_time_cue_display_seconds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.time_cue_display_seconds IS NOT NULL
     AND NEW.time_cue_display_seconds NOT IN (-1, 5, 15, 30) THEN
    RAISE EXCEPTION 'time_cue_display_seconds must be one of -1, 5, 15, 30';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_time_cue_display_seconds_trigger ON public.manuscripts;
CREATE TRIGGER validate_time_cue_display_seconds_trigger
  BEFORE INSERT OR UPDATE OF time_cue_display_seconds ON public.manuscripts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_time_cue_display_seconds();