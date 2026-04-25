-- Tabell
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text NOT NULL UNIQUE,
  description text,
  enabled_globally boolean NOT NULL DEFAULT false,
  enabled_for_user_ids uuid[] NOT NULL DEFAULT '{}',
  enabled_for_tiers text[] NOT NULL DEFAULT '{}',
  rollout_percentage integer NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Endast admins ser & ändrar
CREATE POLICY "feature_flags_admin_select"
  ON public.feature_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "feature_flags_admin_insert"
  ON public.feature_flags FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "feature_flags_admin_update"
  ON public.feature_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "feature_flags_admin_delete"
  ON public.feature_flags FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger (återanvänder befintlig funktion)
CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Funktion: använder projektets get_user_tier (app_role enum) i stället för profiles.tier
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_flag_name text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flag_row public.feature_flags%ROWTYPE;
  user_tier public.app_role;
BEGIN
  SELECT * INTO flag_row FROM public.feature_flags WHERE flag_name = _flag_name;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF flag_row.enabled_globally THEN
    RETURN true;
  END IF;

  IF _user_id IS NOT NULL AND _user_id = ANY(flag_row.enabled_for_user_ids) THEN
    RETURN true;
  END IF;

  IF _user_id IS NOT NULL THEN
    user_tier := public.get_user_tier(_user_id);
    IF user_tier::text = ANY(flag_row.enabled_for_tiers) THEN
      RETURN true;
    END IF;
  END IF;

  IF flag_row.rollout_percentage > 0 AND _user_id IS NOT NULL THEN
    IF (abs(hashtext(_user_id::text)) % 100) < flag_row.rollout_percentage THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- Seed
INSERT INTO public.feature_flags (flag_name, description, enabled_for_tiers) VALUES
  ('snabbstart', 'Snabbstart-flödet (en-textruta intake) — Sprint 1', ARRAY['admin']),
  ('streaming', 'SSE-streaming av LLM-svar — Sprint 1', ARRAY['admin']),
  ('style_preferences', 'Stilinställningar-questionnaire — Sprint 2', ARRAY['admin']),
  ('snippets', 'Snippet-bibliotek — Sprint 2', ARRAY['admin']),
  ('sparring', 'Sparring mot arketyper (4x5-matris) — Sprint 3', ARRAY['admin']),
  ('post_debate_reflection', 'Efter-debatt-reflektion — Sprint 4', ARRAY['admin']);