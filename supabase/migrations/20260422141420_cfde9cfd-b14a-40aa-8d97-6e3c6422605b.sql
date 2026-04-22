
-- =========================================================
-- 1. STOPPA LÄCKAN: Droppa breda admin-SELECT-policyer
-- =========================================================
DROP POLICY IF EXISTS "admins_select_all_manuscripts" ON public.manuscripts;
DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_select_all_subscriptions" ON public.subscriptions;

-- =========================================================
-- 2. Ny tabell: manuscript_share_requests
-- =========================================================
CREATE TABLE public.manuscript_share_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.feedback_threads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  user_id uuid NOT NULL,
  manuscript_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','revoked','denied')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_requests_thread ON public.manuscript_share_requests(thread_id);
CREATE INDEX idx_share_requests_user ON public.manuscript_share_requests(user_id);
CREATE INDEX idx_share_requests_admin ON public.manuscript_share_requests(requested_by);
CREATE INDEX idx_share_requests_active ON public.manuscript_share_requests(manuscript_id, requested_by, status) WHERE status = 'granted';

ALTER TABLE public.manuscript_share_requests ENABLE ROW LEVEL SECURITY;

-- Trigger för updated_at
CREATE TRIGGER update_share_requests_updated_at
BEFORE UPDATE ON public.manuscript_share_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Admin
CREATE POLICY "admins_select_share_requests"
ON public.manuscript_share_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_insert_share_requests"
ON public.manuscript_share_requests FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND requested_by = auth.uid());

CREATE POLICY "admins_update_share_requests"
ON public.manuscript_share_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND requested_by = auth.uid());

-- RLS: Användaren (manus-ägaren)
CREATE POLICY "users_select_own_share_requests"
ON public.manuscript_share_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_share_requests"
ON public.manuscript_share_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- =========================================================
-- 3. has_active_share — kontrollerar aktiv delning
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_active_share(_manuscript_id uuid, _admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manuscript_share_requests
    WHERE manuscript_id = _manuscript_id
      AND requested_by = _admin_id
      AND status = 'granted'
  );
$$;

-- =========================================================
-- 4. Smala admin-policyer på manuscripts/cards/panelists
--    via aktiv delning
-- =========================================================
CREATE POLICY "admins_select_shared_manuscripts"
ON public.manuscripts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(id, auth.uid())
);

CREATE POLICY "admins_update_shared_manuscripts"
ON public.manuscripts FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(id, auth.uid())
);

CREATE POLICY "admins_select_shared_cards"
ON public.cards FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
);

CREATE POLICY "admins_update_shared_cards"
ON public.cards FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
);

CREATE POLICY "admins_select_shared_panelists"
ON public.panelists FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
);

CREATE POLICY "admins_update_shared_panelists"
ON public.panelists FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.has_active_share(manuscript_id, auth.uid())
);

-- =========================================================
-- 5. admin_list_users — säker användarlista för Admin-panelen
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  first_name text,
  last_name text,
  company text,
  tier app_role,
  manuscript_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can list users';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    p.first_name,
    p.last_name,
    p.company,
    public.get_user_tier(p.user_id) AS tier,
    (SELECT COUNT(*) FROM public.manuscripts m WHERE m.user_id = p.user_id) AS manuscript_count,
    p.created_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

-- =========================================================
-- 6. admin_list_user_manuscripts — för Admin att se en användares manus-titlar
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_user_manuscripts(_target_user_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz,
  updated_at timestamptz,
  card_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can list user manuscripts';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.title, m.created_at, m.updated_at,
    (SELECT COUNT(*) FROM public.cards c WHERE c.manuscript_id = m.id) AS card_count
  FROM public.manuscripts m
  WHERE m.user_id = _target_user_id
  ORDER BY m.updated_at DESC;
END;
$$;

-- =========================================================
-- 7. Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.manuscript_share_requests;
