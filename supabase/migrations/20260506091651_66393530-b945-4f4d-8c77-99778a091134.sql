CREATE OR REPLACE FUNCTION public.get_promo_code_preview(_code text)
RETURNS TABLE(
  code text,
  active boolean,
  mode text,
  duration_days integer,
  fixed_starts_at timestamptz,
  fixed_ends_at timestamptz,
  usage_type text,
  max_redemptions integer,
  redemption_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.code, p.active, p.mode, p.duration_days,
    p.fixed_starts_at, p.fixed_ends_at,
    p.usage_type, p.max_redemptions, p.redemption_count
  FROM public.promo_codes p
  WHERE lower(p.code) = lower(trim(_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_promo_code_preview(text) TO anon, authenticated;