import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge-funktion-helper för feature flags.
 * Anropa med en service-role-klient (eller user-klient) — RPC:n är SECURITY DEFINER.
 * Returnerar false vid fel så att inga nya features läcker ut oavsiktligt.
 */
export async function isFeatureEnabled(
  supabaseAdmin: ReturnType<typeof createClient>,
  flagName: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("is_feature_enabled", {
    _flag_name: flagName,
    _user_id: userId,
  });
  if (error) {
    console.error("[featureFlags] Failed", flagName, error);
    return false;
  }
  return data === true;
}
