
-- 1) Harden manuscript_share_requests: restrict what end-users may change.
-- Users can only respond to pending requests (grant/deny) or revoke an active grant.
-- They cannot change ownership, thread, or arbitrary fields.

CREATE OR REPLACE FUNCTION public.guard_manuscript_share_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  -- Admin updates pass through unchanged.
  IF v_is_admin AND NEW.requested_by = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Non-admin: must be the subject user.
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Immutable fields for the responding user.
  IF NEW.user_id     IS DISTINCT FROM OLD.user_id
  OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
  OR NEW.thread_id    IS DISTINCT FROM OLD.thread_id
  OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'immutable_field_changed';
  END IF;

  -- Allowed transitions for the subject user:
  --   pending  -> granted (must pick a manuscript they own)
  --   pending  -> denied
  --   granted  -> revoked
  IF OLD.status = 'pending' AND NEW.status = 'granted' THEN
    IF NEW.manuscript_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.manuscripts m
         WHERE m.id = NEW.manuscript_id AND m.user_id = auth.uid()
       ) THEN
      RAISE EXCEPTION 'invalid_manuscript';
    END IF;
    NEW.granted_at := now();
    RETURN NEW;
  ELSIF OLD.status = 'pending' AND NEW.status = 'denied' THEN
    RETURN NEW;
  ELSIF OLD.status = 'granted' AND NEW.status = 'revoked' THEN
    NEW.revoked_at := now();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_status_transition';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_manuscript_share_request_update ON public.manuscript_share_requests;
CREATE TRIGGER trg_guard_manuscript_share_request_update
BEFORE UPDATE ON public.manuscript_share_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_manuscript_share_request_update();

-- 2) Revoke EXECUTE from anon on internal SECURITY DEFINER role/tier helpers
-- so unauthenticated callers cannot probe role membership.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_tier(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_share(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_affiliate_pro(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_promo_pro(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_beta_access(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_this_month(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_affiliate_stats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_user_manuscripts(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_promo_codes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_promo_redemptions(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_create_promo_code(text, text, text, integer, timestamptz, timestamptz, text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_promo_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_promo_active(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_tier(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.register_affiliate_referral(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_or_create_affiliate_code() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_last_seen() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.import_manuscript(jsonb, jsonb, jsonb) FROM anon, public;
