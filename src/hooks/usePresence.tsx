import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HEARTBEAT_MS = 60_000;

/**
 * Skickar heartbeat till `update_last_seen` RPC vid mount, var 60:e sekund
 * (medan fliken är synlig) och när fliken blir synlig igen.
 */
export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        await supabase.rpc("update_last_seen");
      } catch {
        // tyst — heartbeat ska aldrig krascha
      }
    };

    const start = () => {
      if (timer) return;
      ping();
      timer = setInterval(ping, HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        ping();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);
}
