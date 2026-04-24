-- AI usage tracking table for monthly cap
CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX idx_ai_usage_user_month ON public.ai_usage(user_id, month);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "users_select_own_ai_usage"
ON public.ai_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Writes only via edge function (service role bypasses RLS) - no insert/update policy

-- RPC for current-month usage
CREATE OR REPLACE FUNCTION public.get_ai_usage_this_month(_user_id uuid)
RETURNS TABLE(used integer, "limit" integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_used integer;
  v_limit integer := 200;
  v_tier app_role;
BEGIN
  -- Only the user themselves or admin
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT public.get_user_tier(_user_id) INTO v_tier;
  IF v_tier = 'free' THEN
    v_limit := 0;
  END IF;

  SELECT COALESCE(count, 0) INTO v_used
  FROM public.ai_usage
  WHERE user_id = _user_id AND month = v_month;

  RETURN QUERY SELECT COALESCE(v_used, 0), v_limit;
END;
$$;