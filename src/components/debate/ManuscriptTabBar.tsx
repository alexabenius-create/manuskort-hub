import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MessageSquare, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TabMeta {
  manuscript_id: string;
  kind: "speech" | "reply" | string;
  speaker_label: string;
  position: number;
  round_number: number;
  title: string;
}

interface Props {
  threadId: string;
  activeManuscriptId: string;
  /** Sätts till true när användaren själv klickade "+ Nytt genmäle" — då auto-aktiveras nya fliken. */
  onNewReplyClick?: () => Promise<void> | void;
  /** Phase i bot_state — för att disabla "+ Nytt genmäle" när reply_intake redan är öppen. */
  phase?: string;
  /** Skicka __NEW_REPLY__ via samma sendMessage som vanlig chat. */
  onSendNewReplyTrigger: () => Promise<void>;
}

function getTabLabel(t: TabMeta, replyIdx: number): string {
  if (t.kind === "speech" || t.position === 0) return "Anförande";
  const label = (t.speaker_label || "").trim();
  if (label && label !== "Motdebattör" && label !== "Du" && label !== "X") {
    const first = label.split(/\s+/)[0];
    return first.length <= 12 ? first : first.slice(0, 12);
  }
  return `Genmäle ${replyIdx}`;
}

export function ManuscriptTabBar({
  threadId,
  activeManuscriptId,
  phase,
  onSendNewReplyTrigger,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tabs, setTabs] = useState<TabMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingReply, setCreatingReply] = useState(false);

  const fetchTabs = useCallback(async () => {
    if (!threadId) return;
    const { data: turns } = await supabase
      .from("debate_turns")
      .select("manuscript_id, kind, speaker_label, position, round_number, created_at")
      .eq("thread_id", threadId)
      .not("manuscript_id", "is", null)
      .order("position", { ascending: true });

    // Dedup på manuscript_id (samma manus kan ha flera kopplade turns)
    const uniqueByManus = new Map<string, TabMeta>();
    for (const t of turns || []) {
      if (!t.manuscript_id) continue;
      if (uniqueByManus.has(t.manuscript_id)) continue;
      uniqueByManus.set(t.manuscript_id, {
        manuscript_id: t.manuscript_id as string,
        kind: t.kind as string,
        speaker_label: (t.speaker_label as string) || "",
        position: (t.position as number) || 0,
        round_number: (t.round_number as number) || 1,
        title: "",
      });
    }
    const ids = Array.from(uniqueByManus.keys());
    if (ids.length > 0) {
      const { data: manuscripts } = await supabase
        .from("manuscripts")
        .select("id, title")
        .in("id", ids)
        .is("archived_at", null);
      for (const m of manuscripts || []) {
        const tab = uniqueByManus.get(m.id as string);
        if (tab) tab.title = (m.title as string) || "";
      }
      // Filtrera bort flikar vars manuscript inte finns kvar (arkiverade etc)
      const liveIds = new Set((manuscripts || []).map((m) => m.id as string));
      for (const id of ids) {
        if (!liveIds.has(id)) uniqueByManus.delete(id);
      }
    }
    setTabs(Array.from(uniqueByManus.values()));
    setLoading(false);
  }, [threadId]);

  useEffect(() => {
    void fetchTabs();
  }, [fetchTabs]);

  // Realtime: nya turns dyker upp som nya flikar
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`tabbar-debate-turns-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "debate_turns",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void fetchTabs();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, fetchTabs]);

  const handleTabClick = useCallback(
    async (id: string) => {
      if (id === activeManuscriptId) return;
      const targetTab = tabs.find((t) => t.manuscript_id === id);

      // Logga + sync till bot_state
      void supabase.from("analytics_events").insert({
        user_id: user?.id ?? null,
        event_name: "tab_switched",
        event_props: {
          from_manuscript_id: activeManuscriptId,
          to_manuscript_id: id,
          kind: targetTab?.kind || "unknown",
        },
        thread_id: threadId,
        manuscript_id: id,
      });

      // Sync active_manuscript_id till bot_state så editing-routning vet
      void (async () => {
        const { data: t } = await supabase
          .from("debate_threads")
          .select("bot_state")
          .eq("id", threadId)
          .maybeSingle();
        const botState = (t?.bot_state as Record<string, unknown>) || {};
        await supabase
          .from("debate_threads")
          .update({ bot_state: { ...botState, active_manuscript_id: id } })
          .eq("id", threadId);
      })();

      navigate(`/manus/${id}?debattbuddy=${threadId}`, { replace: true });
    },
    [activeManuscriptId, navigate, tabs, threadId, user?.id],
  );

  // Auto-aktivera ny reply-flik om användaren själv just startat reply-flödet
  useEffect(() => {
    if (!creatingReply || tabs.length === 0) return;
    // Hitta den senaste reply-fliken som inte är aktiv just nu
    const replies = tabs.filter((t) => t.kind === "reply");
    const newest = replies[replies.length - 1];
    if (newest && newest.manuscript_id !== activeManuscriptId) {
      setCreatingReply(false);
      void handleTabClick(newest.manuscript_id);
    }
  }, [tabs, creatingReply, activeManuscriptId, handleTabClick]);

  const handleNewReply = useCallback(async () => {
    if (creatingReply) return;
    if (phase === "reply_intake") {
      toast({
        title: "Du är mitt i en replik",
        description: "Beskriv replikens namn + argument i chatten först.",
      });
      return;
    }
    setCreatingReply(true);
    try {
      await onSendNewReplyTrigger();
      // Säkerhetsspärr: släpp creatingReply efter 30s om ingen ny flik dyker upp
      setTimeout(() => setCreatingReply(false), 30_000);
    } catch (e) {
      setCreatingReply(false);
      toast({
        title: "Kunde inte starta nytt genmäle",
        description: e instanceof Error ? e.message : "Försök igen",
        variant: "destructive",
      });
    }
  }, [creatingReply, phase, onSendNewReplyTrigger]);

  if (loading) return null;
  if (tabs.length === 0) return null;

  let replyCounter = 0;

  return (
    <div className="flex items-center gap-1 border-b border-v2-line bg-white/60 backdrop-blur-sm px-2 overflow-x-auto">
      {tabs.map((t) => {
        const isReply = t.kind === "reply";
        if (isReply) replyCounter += 1;
        const label = getTabLabel(t, replyCounter);
        const isActive = t.manuscript_id === activeManuscriptId;
        const Icon = isReply ? MessageSquare : Mic;
        return (
          <button
            key={t.manuscript_id}
            type="button"
            onClick={() => void handleTabClick(t.manuscript_id)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-[13px] whitespace-nowrap min-w-[80px] transition-colors border-b-2 -mb-px",
              isActive
                ? "border-v2-violet text-v2-ink font-medium"
                : "border-transparent text-v2-muted hover:text-v2-ink hover:bg-v2-bg/60",
            )}
            aria-current={isActive ? "page" : undefined}
            title={t.title || label}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[140px]">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => void handleNewReply()}
        disabled={creatingReply || phase === "reply_intake"}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] ml-1 transition-colors border-b-2 border-transparent -mb-px",
          "text-v2-muted hover:text-v2-ink hover:bg-v2-bg/60",
          (creatingReply || phase === "reply_intake") && "opacity-50 cursor-not-allowed",
        )}
        title={
          phase === "reply_intake"
            ? "Du är mitt i en replik — svara i chatten först"
            : "Starta nytt genmäle"
        }
      >
        {creatingReply ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        <span>Nytt genmäle</span>
      </button>
    </div>
  );
}
