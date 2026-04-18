import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tier } from "@/lib/tierLimits";

interface TierCtx {
  tier: Tier;
  loading: boolean;
  isFree: boolean;
  isPro: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<TierCtx>({
  tier: "free",
  loading: true,
  isFree: true,
  isPro: false,
  isAdmin: false,
  refresh: async () => {},
});

export function TierProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTier("free");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_user_tier", { _user_id: user.id });
    if (!error && data) {
      setTier(data as Tier);
    } else {
      setTier("free");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    refresh();
  }, [authLoading, refresh]);

  return (
    <Ctx.Provider
      value={{
        tier,
        loading,
        isFree: tier === "free",
        isPro: tier === "pro",
        isAdmin: tier === "admin",
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useTier = () => useContext(Ctx);
