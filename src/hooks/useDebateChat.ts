import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface ThreadState {
  bot_state: { phase?: string; mode?: string };
  topic_area: string;
  issue_text: string;
  current_opponent_label: string;
  manuscript_id: string | null;
}

export function useDebateChat(threadId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [threadState, setThreadState] = useState<ThreadState | null>(null);
  const [loading, setLoading] = useState(true);
  const initSentRef = useRef(false);

  const loadThread = useCallback(async () => {
    if (!threadId) return;
    const { data } = await supabase
      .from("debate_threads")
      .select("bot_state, topic_area, issue_text, current_opponent_label, manuscript_id")
      .eq("id", threadId)
      .maybeSingle();
    if (data) setThreadState(data as ThreadState);
  }, [threadId]);

  useEffect(() => {
    if (!threadId || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("debate_chat_messages")
        .select("id, role, content, created_at, metadata")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      setMessages((data || []) as ChatMessage[]);
      await loadThread();
      setLoading(false);
    })();

    const channel = supabase
      .channel(`debate-chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debate_chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.role === "assistant") void loadThread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user, loadThread]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!threadId || sending) return;
      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke("debate-chat", {
          body: { thread_id: threadId, user_message: text },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Något gick fel";
        toast({ title: "Debatt-buddy", description: msg, variant: "destructive" });
      } finally {
        setSending(false);
      }
    },
    [threadId, sending],
  );

  // Skicka initialt välkomstmeddelande om chatten är tom
  useEffect(() => {
    if (loading || !threadId || initSentRef.current) return;
    if (messages.length === 0) {
      initSentRef.current = true;
      void sendMessage("");
    }
  }, [loading, threadId, messages.length, sendMessage]);

  return { messages, sending, sendMessage, threadState, loading };
}
