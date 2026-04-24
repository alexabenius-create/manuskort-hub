import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AiUsage {
  used: number;
  limit: number;
  remaining: number;
}

export function useAiUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsage(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ai_usage_this_month", { _user_id: user.id });
    setLoading(false);
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      setUsage(null);
      return;
    }
    const row = data[0] as { used: number; limit: number };
    setUsage({
      used: row.used ?? 0,
      limit: row.limit ?? 0,
      remaining: Math.max(0, (row.limit ?? 0) - (row.used ?? 0)),
    });
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, loading, refresh };
}
