import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";

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
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [threadState, setThreadState] = useState<ThreadState | null>(null);
  const [loading, setLoading] = useState(true);
  const initSentRef = useRef(false);
  const pendingSendStartRef = useRef<number | null>(null);

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
          if (m.role === "assistant") {
            // Analytics: first-token-latens för senaste send
            if (pendingSendStartRef.current !== null) {
              const latency_ms = Math.round(performance.now() - pendingSendStartRef.current);
              pendingSendStartRef.current = null;
              void trackEvent(
                ANALYTICS_EVENTS.GENERATION_FIRST_TOKEN,
                { latency_ms },
                { thread_id: threadId },
              );
            }
            void loadThread();
            const meta = (m.metadata as {
              tools?: Array<{ name: string }>;
              navigate_to_manuscript?: string;
            } | undefined) || {};
            // Notify editor to refetch cards if generation tools ran
            const tools = meta.tools || [];
            if (tools.some((t) => t.name === "generate_speech_cards" || t.name === "generate_rebuttal_cards" || t.name === "_cards_updated")) {
              window.dispatchEvent(new CustomEvent("debate-cards-generated", { detail: { threadId } }));
            }
            // Navigera till nytt genmäle-manus om edge-funktionen skapade ett
            const navTo = meta.navigate_to_manuscript;
            if (navTo && !location.pathname.includes(`/manus/${navTo}`)) {
              navigate(`/manus/${navTo}?debattbuddy=${threadId}`);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user, loadThread, navigate, location.pathname]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!threadId || sending) return;
      setSending(true);
      pendingSendStartRef.current = performance.now();
      try {
        const { data, error } = await supabase.functions.invoke("debate-chat", {
          body: { thread_id: threadId, user_message: text },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } catch (e) {
        pendingSendStartRef.current = null;
        const msg = e instanceof Error ? e.message : "Något gick fel";
        toast({ title: "Debatt-buddy", description: msg, variant: "destructive" });
      } finally {
        setSending(false);
      }
    },
    [threadId, sending],
  );

  const retryLastAssistant = useCallback(async () => {
    if (!threadId || sending) return;
    setSending(true);
    pendingSendStartRef.current = performance.now();
    try {
      // Ta bort senaste error-meddelande lokalt direkt så UI känns snabbt.
      setMessages((prev) => {
        const lastIdx = [...prev].reverse().findIndex(
          (m) => m.role === "assistant" && (m.metadata as { error_kind?: string } | undefined)?.error_kind,
        );
        if (lastIdx === -1) return prev;
        const realIdx = prev.length - 1 - lastIdx;
        return prev.filter((_, i) => i !== realIdx);
      });
      const { data, error } = await supabase.functions.invoke("debate-chat", {
        body: { thread_id: threadId, retry: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    } catch (e) {
      pendingSendStartRef.current = null;
      const msg = e instanceof Error ? e.message : "Något gick fel";
      toast({ title: "Debatt-buddy", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [threadId, sending]);

  const uploadBrief = useCallback(
    async (file: File) => {
      if (!threadId || uploading) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Ej inloggad");

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-issue-document`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        });
        const result = await resp.json();
        if (!resp.ok) {
          throw new Error(result?.error || "Kunde inte läsa filen");
        }
        const summary: string = result.summary || "";
        const fullText: string = result.full_text || "";

        // Skicka in i chatten som ett user-meddelande som boten kan analysera
        const briefMessage = `[BRIEF UPPLADDAD: ${file.name}]\n\nSammanfattning:\n${summary}\n\n---\nFulltext (${fullText.length} tecken):\n${fullText.slice(0, 6000)}${fullText.length > 6000 ? "\n…[förkortad]" : ""}`;
        await sendMessage(briefMessage);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Något gick fel vid uppladdning";
        toast({ title: "Underlag", description: msg, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [threadId, uploading, sendMessage],
  );

  // Skicka initialt välkomstmeddelande om chatten är tom
  useEffect(() => {
    if (loading || !threadId || initSentRef.current) return;
    if (messages.length === 0) {
      initSentRef.current = true;
      void sendMessage("");
    }
  }, [loading, threadId, messages.length, sendMessage]);

  // Snabbstart auto-trigger: när user landar i editorn med ett färdigt thread
  // (phase=drafting_speech eller generating_rebuttal) och boten ännu inte
  // har börjat generera. Trigga EN gång per thread via bot_state-flagga.
  useEffect(() => {
    if (loading || !threadId || !threadState || initSentRef.current) return;
    const phase = threadState.bot_state?.phase;
    const autostartPhases = ["drafting_speech", "generating_rebuttal"];
    if (!autostartPhases.includes(phase || "")) return;

    // deno-lint-ignore no-explicit-any
    const bs = threadState.bot_state as any;
    // pending_generate är auktoritativ signal från backend om att generering ska ske.
    // snabbstart_autostarted används bara för att undvika auto-greeting på återbesök.
    if (!bs?.pending_generate && bs?.snabbstart_autostarted) return;

    // Inga user-meddelanden ännu? (scripted assistant-msg räknas inte)
    const hasUserMsg = messages.some((m) => m.role === "user");
    if (hasUserMsg) return;

    initSentRef.current = true;
    (async () => {
      // Sätt flaggan FÖRST så omladdning inte triggar igen
      await supabase
        .from("debate_threads")
        .update({ bot_state: { ...bs, snabbstart_autostarted: true } })
        .eq("id", threadId);
      void sendMessage("");
    })();
  }, [loading, threadId, threadState, messages, sendMessage]);

  // Efter avslutad presentation: trigga post_perform_check-frågan
  useEffect(() => {
    if (loading || !threadId || !user) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("from") !== "presentation") return;
    // Rensa flaggan så det bara körs en gång
    url.searchParams.delete("from");
    window.history.replaceState({}, "", url.toString());

    (async () => {
      // Sätt fas + skriv scripted assistant-meddelande direkt
      const { data: t } = await supabase
        .from("debate_threads")
        .select("bot_state")
        .eq("id", threadId)
        .maybeSingle();
      const botState = (t?.bot_state as Record<string, unknown>) || {};
      await supabase
        .from("debate_threads")
        .update({ bot_state: { ...botState, phase: "post_perform_check" } })
        .eq("id", threadId);
      await supabase.from("debate_chat_messages").insert({
        thread_id: threadId,
        user_id: user.id,
        role: "assistant",
        content: "Bra jobbat med anförandet! Fick du några repliker som du behöver bemöta?",
        metadata: { scripted: true, quick_replies: ["Ja", "Nej, klart"] },
      });
    })();
  }, [loading, threadId, user]);

  return { messages, sending, uploading, sendMessage, retryLastAssistant, uploadBrief, threadState, loading };
}
