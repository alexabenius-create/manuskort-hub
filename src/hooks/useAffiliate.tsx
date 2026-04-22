import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AffiliateStats {
  signups: number;
  conversions: number;
  total_months: number;
  active_until: string | null;
}

export function useAffiliate() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCode(null);
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [codeRes, statsRes] = await Promise.all([
      supabase.rpc("get_or_create_affiliate_code"),
      supabase.rpc("get_affiliate_stats", { _user_id: user.id }),
    ]);
    if (!codeRes.error && codeRes.data) setCode(codeRes.data as string);
    if (!statsRes.error && statsRes.data && statsRes.data.length > 0) {
      const r = statsRes.data[0] as any;
      setStats({
        signups: Number(r.signups ?? 0),
        conversions: Number(r.conversions ?? 0),
        total_months: Number(r.total_months ?? 0),
        active_until: r.active_until ?? null,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const link = code ? `https://manuskort.se/affiliate/${code}` : "";

  return { code, link, stats, loading, refresh };
}

/**
 * Registrerar en affiliate-värvning baserat på localStorage 'affiliate_pending'.
 * Anropas efter lyckad signup.
 */
export async function registerPendingReferral(): Promise<void> {
  try {
    const raw = localStorage.getItem("affiliate_pending");
    if (!raw) return;
    const { code } = JSON.parse(raw);
    if (!code || !/^\d{8}$/.test(code)) {
      localStorage.removeItem("affiliate_pending");
      return;
    }
    await supabase.rpc("register_affiliate_referral", { _code: code });
    localStorage.removeItem("affiliate_pending");
  } catch (e) {
    console.error("registerPendingReferral failed:", e);
  }
}
