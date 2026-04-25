CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  event_name text NOT NULL,
  event_props jsonb NOT NULL DEFAULT '{}'::jsonb,
  thread_id uuid,
  manuscript_id uuid,
  client_kind text,
  platform text CHECK (platform IS NULL OR platform IN ('ios','android','macos','windows','linux','other')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_user_time ON public.analytics_events(user_id, occurred_at DESC);
CREATE INDEX idx_analytics_events_name_time ON public.analytics_events(event_name, occurred_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Egen läsning + admin
CREATE POLICY "analytics_events_select_own_or_admin"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Inloggad insert: egen user_id eller null
CREATE POLICY "analytics_events_insert_authenticated"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Anonym insert: bara med user_id null (för t.ex. landing-events innan login)
CREATE POLICY "analytics_events_insert_anon"
  ON public.analytics_events FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);