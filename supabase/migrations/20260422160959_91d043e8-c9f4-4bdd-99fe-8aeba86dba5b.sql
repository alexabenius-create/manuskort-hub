CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL DEFAULT '/',
  ip_hash text NOT NULL,
  country text,
  referrer text,
  user_agent text,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visits_ip_created ON public.site_visits (ip_hash, created_at DESC);
CREATE INDEX idx_site_visits_created ON public.site_visits (created_at DESC);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_site_visits"
ON public.site_visits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));