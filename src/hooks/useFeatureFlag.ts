import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Lättviktig feature-flag-hook.
 * Frågar databasens is_feature_enabled(flag, user) och cachar inte i minnet
 * — hooken körs en gång per (user, flagName).
 *
 * Standardläge när användaren saknas eller anropet misslyckas: false (av).
 */
export function useFeatureFlag(flagName: string): { enabled: boolean; loading: boolean } {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("is_feature_enabled", { _flag_name: flagName, _user_id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useFeatureFlag] Failed to load flag", flagName, error);
          setEnabled(false);
        } else {
          setEnabled(data === true);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, flagName]);

  return { enabled, loading };
}
