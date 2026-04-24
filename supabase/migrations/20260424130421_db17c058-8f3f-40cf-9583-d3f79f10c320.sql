-- 1. Lägg till 'debate' i manuscript_mode-enumen
ALTER TYPE public.manuscript_mode ADD VALUE IF NOT EXISTS 'debate';

-- 2. beta_features-tabell
CREATE TABLE public.beta_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

CREATE INDEX idx_beta_features_user_feature ON public.beta_features(user_id, feature);

ALTER TABLE public.beta_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_beta_features"
ON public.beta_features FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_beta_features"
ON public.beta_features FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_insert_beta_features"
ON public.beta_features FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_update_beta_features"
ON public.beta_features FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_delete_beta_features"
ON public.beta_features FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. has_beta_access helper
CREATE OR REPLACE FUNCTION public.has_beta_access(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.beta_features
      WHERE user_id = _user_id AND feature = _feature
    );
$$;

-- 4. debate_sessions-tabell
CREATE TABLE public.debate_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  manuscript_id UUID,
  kind TEXT NOT NULL DEFAULT 'speech',
  parent_session_id UUID,
  issue_text TEXT NOT NULL DEFAULT '',
  original_text TEXT NOT NULL DEFAULT '',
  improved_text TEXT NOT NULL DEFAULT '',
  card_split JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_length_percent INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_sessions_user ON public.debate_sessions(user_id);
CREATE INDEX idx_debate_sessions_parent ON public.debate_sessions(parent_session_id);

ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debate_sessions_select_own"
ON public.debate_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "debate_sessions_insert_own"
ON public.debate_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debate_sessions_update_own"
ON public.debate_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "debate_sessions_delete_own"
ON public.debate_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_debate_sessions"
ON public.debate_sessions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_debate_sessions_updated_at
BEFORE UPDATE ON public.debate_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Länk-kolumn på manuscripts
ALTER TABLE public.manuscripts ADD COLUMN IF NOT EXISTS debate_session_id UUID;