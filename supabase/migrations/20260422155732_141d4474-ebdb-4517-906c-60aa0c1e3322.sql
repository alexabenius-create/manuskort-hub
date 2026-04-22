-- Add last_seen_at to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC);

-- Function for users to update their own last_seen_at
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET last_seen_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Update admin_list_users to include last_seen_at
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  first_name text,
  last_name text,
  company text,
  tier app_role,
  manuscript_count bigint,
  created_at timestamp with time zone,
  last_seen_at timestamp with time zone
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
    p.created_at,
    p.last_seen_at
  FROM public.profiles p
  ORDER BY
    CASE WHEN p.last_seen_at > now() - interval '2 minutes' THEN 0 ELSE 1 END,
    p.last_seen_at DESC NULLS LAST,
    p.created_at DESC;
END;
$$;