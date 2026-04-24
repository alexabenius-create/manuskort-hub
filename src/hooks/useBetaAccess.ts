import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";

export type BetaFeatureKey = "debate_buddy";

/**
 * Returnerar `hasAccess` om användaren fått tillgång till en BETA-funktion.
 * Admin har alltid tillgång till alla BETA-funktioner.
 */
export function useBetaAccess(feature: BetaFeatureKey) {
  const { user } = useAuth();
  const { isAdmin, loading: tierLoading } = useTier();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    if (isAdmin) {
      setHasAccess(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("beta_features")
      .select("id")
      .eq("user_id", user.id)
      .eq("feature", feature)
      .maybeSingle();
    setLoading(false);
    setHasAccess(!error && !!data);
  }, [user, isAdmin, feature]);

  useEffect(() => {
    if (tierLoading) return;
    refresh();
  }, [tierLoading, refresh]);

  return { hasAccess, loading: loading || tierLoading, refresh };
}
