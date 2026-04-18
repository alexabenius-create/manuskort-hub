-- Allow admins to read all profiles
CREATE POLICY "admins_select_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all manuscripts (for counting)
CREATE POLICY "admins_select_all_manuscripts"
ON public.manuscripts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Security definer function: only allows free <-> pro changes
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(
  _target_user_id uuid,
  _new_tier app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user tiers';
  END IF;

  -- Block changing to/from admin via this function
  IF _new_tier = 'admin' THEN
    RAISE EXCEPTION 'Cannot grant admin role through this function';
  END IF;

  -- Block modifying existing admin users
  IF public.has_role(_target_user_id, 'admin') THEN
    RAISE EXCEPTION 'Cannot modify admin users through this function';
  END IF;

  -- Remove all existing free/pro roles for this user
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND role IN ('free', 'pro');

  -- Insert the new role (only if pro; free is the default absence-of-role)
  IF _new_tier = 'pro' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, 'pro');
  END IF;
END;
$$;