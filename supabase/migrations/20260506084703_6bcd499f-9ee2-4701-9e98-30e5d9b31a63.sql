
-- Promo codes table
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  mode text NOT NULL CHECK (mode IN ('rolling','fixed')),
  duration_days integer,
  fixed_starts_at timestamptz,
  fixed_ends_at timestamptz,
  usage_type text NOT NULL CHECK (usage_type IN ('unique','shared')),
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (mode = 'rolling' AND duration_days IS NOT NULL AND duration_days > 0)
    OR
    (mode = 'fixed' AND fixed_ends_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX promo_codes_code_lower_idx ON public.promo_codes (lower(code));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_all_promo_codes ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_promo_codes_updated
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Redemptions table
CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (promo_code_id, user_id)
);

CREATE INDEX promo_redemptions_user_active_idx
  ON public.promo_redemptions (user_id, expires_at);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_select_promo_redemptions ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY users_select_own_promo_redemptions ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Active promo helper
CREATE OR REPLACE FUNCTION public.has_active_promo_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.promo_redemptions
    WHERE user_id = _user_id AND expires_at > now()
  );
$$;

-- Update tier resolver to include promo
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'pro') THEN 'pro'::public.app_role
    WHEN public.has_active_affiliate_pro(_user_id) THEN 'pro'::public.app_role
    WHEN public.has_active_promo_pro(_user_id) THEN 'pro'::public.app_role
    ELSE 'free'::public.app_role
  END
$$;

-- Redeem function (any authenticated user)
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS TABLE(expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_promo public.promo_codes%ROWTYPE;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes
   WHERE lower(code) = lower(trim(_code))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'promo_invalid';
  END IF;

  IF NOT v_promo.active THEN
    RAISE EXCEPTION 'promo_inactive';
  END IF;

  IF v_promo.mode = 'fixed' THEN
    IF v_promo.fixed_starts_at IS NOT NULL AND now() < v_promo.fixed_starts_at THEN
      RAISE EXCEPTION 'promo_not_started';
    END IF;
    IF v_promo.fixed_ends_at <= now() THEN
      RAISE EXCEPTION 'promo_expired';
    END IF;
    v_expires := v_promo.fixed_ends_at;
  ELSE
    v_expires := now() + make_interval(days => v_promo.duration_days);
  END IF;

  IF EXISTS (SELECT 1 FROM public.promo_redemptions
             WHERE promo_code_id = v_promo.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'promo_already_redeemed';
  END IF;

  IF v_promo.usage_type = 'unique' AND v_promo.redemption_count >= 1 THEN
    RAISE EXCEPTION 'promo_already_used';
  END IF;

  IF v_promo.max_redemptions IS NOT NULL
     AND v_promo.redemption_count >= v_promo.max_redemptions THEN
    RAISE EXCEPTION 'promo_max_reached';
  END IF;

  INSERT INTO public.promo_redemptions (promo_code_id, user_id, expires_at)
  VALUES (v_promo.id, v_user, v_expires);

  UPDATE public.promo_codes
     SET redemption_count = redemption_count + 1,
         updated_at = now()
   WHERE id = v_promo.id;

  RETURN QUERY SELECT v_expires;
END;
$$;

-- Admin: create
CREATE OR REPLACE FUNCTION public.admin_create_promo_code(
  _code text,
  _description text,
  _mode text,
  _duration_days integer,
  _fixed_starts_at timestamptz,
  _fixed_ends_at timestamptz,
  _usage_type text,
  _max_redemptions integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  INSERT INTO public.promo_codes(
    code, description, mode, duration_days,
    fixed_starts_at, fixed_ends_at, usage_type, max_redemptions, created_by
  ) VALUES (
    trim(_code), coalesce(_description,''), _mode, _duration_days,
    _fixed_starts_at, _fixed_ends_at, _usage_type, _max_redemptions, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Admin: list codes
CREATE OR REPLACE FUNCTION public.admin_list_promo_codes()
RETURNS SETOF public.promo_codes
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY SELECT * FROM public.promo_codes ORDER BY created_at DESC;
END;
$$;

-- Admin: list redemptions for a code
CREATE OR REPLACE FUNCTION public.admin_list_promo_redemptions(_promo_id uuid)
RETURNS TABLE(user_id uuid, email text, redeemed_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY
    SELECT r.user_id, p.email, r.redeemed_at, r.expires_at
    FROM public.promo_redemptions r
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.promo_code_id = _promo_id
    ORDER BY r.redeemed_at DESC;
END;
$$;

-- Admin: toggle active
CREATE OR REPLACE FUNCTION public.admin_set_promo_active(_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  UPDATE public.promo_codes SET active = _active, updated_at = now() WHERE id = _id;
END;
$$;

-- Admin: delete
CREATE OR REPLACE FUNCTION public.admin_delete_promo_code(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  DELETE FROM public.promo_codes WHERE id = _id;
END;
$$;
