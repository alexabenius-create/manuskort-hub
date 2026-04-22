import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Räknar antal olästa admin-svar för inloggad användare.
 * Lyssnar på realtime-uppdateringar via supabase_realtime.
 */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      // Hämta alla trådar för användaren och räkna olästa admin-svar
      const { data: threads } = await supabase
        .from("feedback_threads")
        .select("id")
        .eq("user_id", user.id);
      if (!threads || threads.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }
      const ids = threads.map((t) => t.id);
      const { count: c } = await supabase
        .from("feedback_messages")
        .select("id", { count: "exact", head: true })
        .in("thread_id", ids)
        .eq("sender_role", "admin")
        .eq("read_by_user", false);
      if (!cancelled) setCount(c ?? 0);
    };

    refresh();

    const channel = supabase
      .channel(`feedback-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return count;
}

/**
 * Räknar olästa user-meddelanden för admin (alla trådar).
 */
export function useAdminUnreadMessages(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      const { count: c } = await supabase
        .from("feedback_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_role", "user")
        .eq("read_by_admin", false);
      if (!cancelled) setCount(c ?? 0);
    };

    refresh();

    const channel = supabase
      .channel("feedback-unread-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return count;
}
