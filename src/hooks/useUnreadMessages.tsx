import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Räknar antal olästa meddelanden i inloggad användares "Mina meddelanden":
 * - Olästa admin-svar i trådar man äger (`read_by_user = false`).
 * - För admins: olästa user-svar i trådar man själv har startat (`read_by_admin = false`).
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
      // 1) Egna trådar — räkna olästa admin-svar
      const { data: ownThreads } = await supabase
        .from("feedback_threads")
        .select("id")
        .eq("user_id", user.id);

      let ownUnread = 0;
      if (ownThreads && ownThreads.length > 0) {
        const ids = ownThreads.map((t) => t.id);
        const { count: c } = await supabase
          .from("feedback_messages")
          .select("id", { count: "exact", head: true })
          .in("thread_id", ids)
          .eq("sender_role", "admin")
          .eq("read_by_user", false);
        ownUnread = c ?? 0;
      }

      // 2) Trådar där jag har skickat som admin — räkna olästa user-svar.
      // Säkert även för icke-admins: RLS hindrar dem från att se icke-egna trådar,
      // så frågan ger 0 om man inte har admin-roll.
      const { data: sentMsgs } = await supabase
        .from("feedback_messages")
        .select("thread_id")
        .eq("sender_user_id", user.id)
        .eq("sender_role", "admin");

      let adminUnread = 0;
      const sentThreadIds = Array.from(new Set((sentMsgs ?? []).map((m) => m.thread_id)));
      if (sentThreadIds.length > 0) {
        const { count: c } = await supabase
          .from("feedback_messages")
          .select("id", { count: "exact", head: true })
          .in("thread_id", sentThreadIds)
          .eq("sender_role", "user")
          .eq("read_by_admin", false);
        adminUnread = c ?? 0;
      }

      if (!cancelled) setCount(ownUnread + adminUnread);
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
