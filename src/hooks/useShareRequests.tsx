import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ShareRequest {
  id: string;
  thread_id: string;
  requested_by: string;
  user_id: string;
  manuscript_id: string | null;
  status: "pending" | "granted" | "revoked" | "denied";
  requested_at: string;
  granted_at: string | null;
  revoked_at: string | null;
}

/** Alla delningar för en specifik tråd (live). */
export function useThreadShareRequests(threadId: string | null) {
  const [items, setItems] = useState<ShareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("manuscript_share_requests")
        .select("*")
        .eq("thread_id", threadId)
        .order("requested_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as ShareRequest[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`share-requests-thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manuscript_share_requests", filter: `thread_id=eq.${threadId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  return { items, loading };
}

/** Aktiva (granted) delningar som DEN INLOGGADE användaren har gett bort. */
export function useMyActiveShares() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShareRequest[]>([]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("manuscript_share_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "granted");
      if (!cancelled) setItems((data ?? []) as ShareRequest[]);
    };
    load();

    const channel = supabase
      .channel(`my-active-shares-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manuscript_share_requests", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return items;
}

/** Live-status för EN delningsrad (för support-editor watcher). */
export function useShareRequestStatus(shareId: string | null) {
  const [status, setStatus] = useState<ShareRequest["status"] | null>(null);

  useEffect(() => {
    if (!shareId) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("manuscript_share_requests")
        .select("status")
        .eq("id", shareId)
        .maybeSingle();
      if (!cancelled) setStatus((data?.status as ShareRequest["status"]) ?? null);
    };
    load();

    const channel = supabase
      .channel(`share-status-${shareId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "manuscript_share_requests", filter: `id=eq.${shareId}` },
        (payload) => {
          const newStatus = (payload.new as { status: ShareRequest["status"] }).status;
          setStatus(newStatus);
        },
      )
      .subscribe();

    // Polling-fallback var 5e sekund
    const poll = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [shareId]);

  return status;
}
