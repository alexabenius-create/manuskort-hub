-- Affiliate program tables

-- 1. affiliate_codes: 1 rad per användare med unik 8-siffrig kod
CREATE TABLE public.affiliate_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_affiliate_code"
  ON public.affiliate_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_affiliate_code"
  ON public.affiliate_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. affiliate_referrals: registrerar värvningar
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  reward_months int,
  subscription_interval text,
  CONSTRAINT no_self_referral CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX idx_affiliate_referrals_referrer ON public.affiliate_referrals(referrer_user_id);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_referrals"
  ON public.affiliate_referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 3. affiliate_rewards: PRO-tid intjänad
CREATE TABLE public.affiliate_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  months int NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idx_affiliate_rewards_user ON public.affiliate_rewards(user_id);
CREATE INDEX idx_affiliate_rewards_expires ON public.affiliate_rewards(expires_at);

ALTER TABLE public.affiliate_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_rewards"
  ON public.affiliate_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Genererar en unik 8-siffrig kod (10000000–99999999)
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');
    IF NOT EXISTS (SELECT 1 FROM public.affiliate_codes WHERE code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique affiliate code';
    END IF;
  END LOOP;
END;
$$;

-- 5. Hämta eller skapa användarens affiliate-kod
CREATE OR REPLACE FUNCTION public.get_or_create_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT code INTO v_code FROM public.affiliate_codes WHERE user_id = v_user_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generate_affiliate_code();
  INSERT INTO public.affiliate_codes (user_id, code) VALUES (v_user_id, v_code)
  ON CONFLICT (user_id) DO UPDATE SET code = affiliate_codes.code
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

-- 6. Slå upp referrer från kod (publikt — används vid signup)
CREATE OR REPLACE FUNCTION public.lookup_affiliate_referrer(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.affiliate_codes WHERE code = _code LIMIT 1;
$$;

-- 7. Aktiv affiliate-PRO?
CREATE OR REPLACE FUNCTION public.has_active_affiliate_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliate_rewards
    WHERE user_id = _user_id
      AND expires_at > now()
  );
$$;

-- 8. Uppdatera get_user_tier till att inkludera affiliate-PRO
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN 'admin'::public.app_role
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'pro') THEN 'pro'::public.app_role
    WHEN public.has_active_affiliate_pro(_user_id) THEN 'pro'::public.app_role
    ELSE 'free'::public.app_role
  END
$$;

-- 9. Statistik för UI
CREATE OR REPLACE FUNCTION public.get_affiliate_stats(_user_id uuid)
RETURNS TABLE(
  signups bigint,
  conversions bigint,
  total_months bigint,
  active_until timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.affiliate_referrals WHERE referrer_user_id = _user_id),
    (SELECT COUNT(*) FROM public.affiliate_referrals WHERE referrer_user_id = _user_id AND rewarded_at IS NOT NULL),
    COALESCE((SELECT SUM(months) FROM public.affiliate_rewards WHERE user_id = _user_id), 0),
    (SELECT MAX(expires_at) FROM public.affiliate_rewards WHERE user_id = _user_id AND expires_at > now())
  WHERE auth.uid() = _user_id;
$$;

-- 10. Registrera referral (anropas efter signup av den nye användaren)
CREATE OR REPLACE FUNCTION public.register_affiliate_referral(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_referrer FROM public.affiliate_codes WHERE code = _code;
  IF v_referrer IS NULL OR v_referrer = v_user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.affiliate_referrals (referrer_user_id, referred_user_id, code)
  VALUES (v_referrer, v_user_id, _code)
  ON CONFLICT (referred_user_id) DO NOTHING;
END;
$$;