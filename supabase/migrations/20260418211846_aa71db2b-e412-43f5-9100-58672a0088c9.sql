CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'sandbox'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Authorization: only the owner or an admin may query subscription status
    CASE
      WHEN auth.uid() IS NULL THEN NULL
      WHEN auth.uid() <> user_uuid AND NOT public.has_role(auth.uid(), 'admin') THEN NULL
      ELSE EXISTS (
        SELECT 1
        FROM public.subscriptions
        WHERE user_id = user_uuid
          AND environment = check_env
          AND status IN ('active', 'trialing')
          AND (current_period_end IS NULL OR current_period_end > now())
      )
    END;
$function$;

-- Restrict execution to authenticated callers (the body still enforces owner/admin)
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;