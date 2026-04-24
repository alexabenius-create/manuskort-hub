import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Send, Inbox, MessageSquare, X, Lock, Lightbulb } from "lucide-react";
import { AdminShareRequestPanel } from "@/components/feedback/AdminShareRequestPanel";
import { NewInsightDialog, type NewInsightPrefill } from "@/components/admin/insights/NewInsightDialog";

interface Thread {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  source: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  unread_admin: number;
}

interface Message {
  id: string;
  thread_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
  read_by_admin: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  landing: "Startsida",
  library: "Bibliotek",
  editor: "Redigeringsläge",
};

function formatDate(s: string) {
  return new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

export function FeedbackAdminPanel() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [insightPrefill, setInsightPrefill] = useState<NewInsightPrefill | null>(null);
  const [insightDialogOpen, setInsightDialogOpen] = useState(false);
  const [insightThemes, setInsightThemes] = useState<string[]>([]);

  const openInsightFromText = (text: string, thread: Thread) => {
    setInsightPrefill({
      raw_text: text,
      source: "dm",
      source_label: thread.email ?? "användare",
      linked_user_id: thread.user_id,
      linked_thread_id: thread.id,
    });
    setInsightDialogOpen(true);
  };

  // Hämta tema-lista när dialogen öppnas
  useEffect(() => {
    if (!insightDialogOpen) return;
    supabase
      .from("admin_insights")
      .select("theme")
      .not("theme", "is", null)
      .then(({ data }) => {
        const unique = Array.from(new Set((data ?? []).map((r) => r.theme as string).filter(Boolean)));
        setInsightThemes(unique);
      });
  }, [insightDialogOpen]);

  const loadThreads = async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from("feedback_threads")
      .select("id, user_id, email, subject, source, status, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (!t) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const ids = t.map((x) => x.id);
    const unreadMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: msgs } = await supabase
        .from("feedback_messages")
        .select("thread_id")
        .in("thread_id", ids)
        .eq("sender_role", "user")
        .eq("read_by_admin", false);
      (msgs ?? []).forEach((m) => {
        unreadMap.set(m.thread_id, (unreadMap.get(m.thread_id) ?? 0) + 1);
      });
    }

    const enriched: Thread[] = t.map((x) => ({
      ...x,
      status: x.status as "open" | "closed",
      unread_admin: unreadMap.get(x.id) ?? 0,
    }));

    // Sortera: olästa först, sen datum
    enriched.sort((a, b) => {
      if ((b.unread_admin > 0 ? 1 : 0) !== (a.unread_admin > 0 ? 1 : 0)) {
        return (b.unread_admin > 0 ? 1 : 0) - (a.unread_admin > 0 ? 1 : 0);
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    setThreads(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
    const channel = supabase
      .channel("feedback-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => {
          loadThreads();
          if (activeId) loadMessages(activeId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_threads" },
        () => loadThreads(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMessages = async (threadId: string) => {
    const { data } = await supabase
      .from("feedback_messages")
      .select("id, thread_id, sender_role, body, created_at, read_by_admin")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);

    const unread = (data ?? []).filter((m) => m.sender_role === "user" && !m.read_by_admin);
    if (unread.length > 0) {
      await supabase
        .from("feedback_messages")
        .update({ read_by_admin: true })
        .in("id", unread.map((m) => m.id));
      loadThreads();
    }
  };

  const openThread = (id: string) => {
    setActiveId(id);
    loadMessages(id);
  };

  const sendReply = async () => {
    if (!activeId || !reply.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("feedback_messages").insert({
      thread_id: activeId,
      sender_role: "admin",
      sender_user_id: user.id,
      body: reply.trim(),
    });
    setSending(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    loadMessages(activeId);
    loadThreads();
  };

  const closeThread = async () => {
    if (!activeId) return;
    const { error } = await supabase
      .from("feedback_threads")
      .update({ status: "closed" })
      .eq("id", activeId);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Tråden stängd" });
    loadThreads();
  };

  const reopenThread = async () => {
    if (!activeId) return;
    const { error } = await supabase
      .from("feedback_threads")
      .update({ status: "open" })
      .eq("id", activeId);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    loadThreads();
  };

  const filtered = useMemo(() => {
    let list = threads;
    if (filter !== "all") list = list.filter((t) => t.status === filter);
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.subject.toLowerCase().includes(ql) ||
          (t.email ?? "").toLowerCase().includes(ql),
      );
    }
    return list;
  }, [threads, filter, q]);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId), [threads, activeId]);

  return (
    <div>
      {/* Filter-rad */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök ämne eller e-post"
            className="pl-11 h-10 rounded-full bg-surface-2 border-0 text-[14px]"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[160px] h-10 rounded-full bg-surface-2 border-0 text-[14px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Öppna</SelectItem>
            <SelectItem value="closed">Stängda</SelectItem>
            <SelectItem value="all">Alla</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 min-h-[500px]">
        {/* Tråd-lista */}
        <aside className="bg-surface rounded-2xl shadow-card overflow-hidden h-fit max-h-[70vh] overflow-y-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-12 text-[14px]">Laddar…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-[14px] text-muted-foreground">Inga trådar.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isActive ? "bg-surface-2" : "hover:bg-surface-2/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[14px] font-medium truncate">{t.subject}</span>
                        {t.unread_admin > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                            {t.unread_admin}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {t.email ?? <span className="italic">(ingen e-post)</span>}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                        <span>{SOURCE_LABEL[t.source] ?? t.source}</span>
                        <span>{formatDate(t.updated_at)}</span>
                      </div>
                      {t.status === "closed" && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          Stängd
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Tråd-vy */}
        <section className="bg-surface rounded-2xl shadow-card flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-[14px] text-muted-foreground">Välj en tråd.</p>
            </div>
          ) : (
            <>
              <header className="px-6 py-4 border-b-hair flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[17px] font-semibold tracking-tight truncate">{activeThread.subject}</h2>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {activeThread.email ?? "(ingen e-post)"} · {SOURCE_LABEL[activeThread.source] ?? activeThread.source} · {formatDate(activeThread.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {activeThread.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openInsightFromText(
                            `${activeThread.subject}\n\n${messages
                              .filter((m) => m.sender_role === "user")
                              .map((m) => m.body)
                              .join("\n\n---\n\n")}`,
                            activeThread,
                          )
                        }
                        className="rounded-full text-[12px] h-7 text-muted-foreground hover:text-accent-blue"
                        title="Skapa insikt från hela tråden"
                      >
                        <Lightbulb className="h-3 w-3" /> Skapa insikt
                      </Button>
                    )}
                    {activeThread.status === "open" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeThread}
                        className="rounded-full text-[12px] h-7 text-muted-foreground"
                      >
                        <X className="h-3 w-3" /> Stäng
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={reopenThread}
                        className="rounded-full text-[12px] h-7 text-muted-foreground"
                      >
                        <Lock className="h-3 w-3" /> Öppna igen
                      </Button>
                    )}
                  </div>
                </div>
                <AdminShareRequestPanel threadId={activeThread.id} threadUserId={activeThread.user_id} />
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 max-h-[50vh]">
                {messages.map((m) => {
                  const fromAdmin = m.sender_role === "admin";
                  return (
                    <div key={m.id} className={`group flex items-end gap-1.5 ${fromAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-wrap ${
                          fromAdmin
                            ? "bg-accent-blue text-white"
                            : "bg-surface-2 text-foreground"
                        }`}
                      >
                        {!fromAdmin && (
                          <div className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">
                            Användare
                          </div>
                        )}
                        <div>{m.body}</div>
                        <div className={`text-[10px] mt-1 ${fromAdmin ? "text-white/70" : "text-muted-foreground"}`}>
                          {formatDate(m.created_at)}
                        </div>
                      </div>
                      {!fromAdmin && activeThread.user_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openInsightFromText(m.body, activeThread)}
                          className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-accent-blue opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Skapa insikt från detta meddelande"
                        >
                          <Lightbulb className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeThread.status === "open" ? (
                <div className="px-6 py-4 border-t-hair">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Skriv ditt svar…"
                    className="min-h-[80px] rounded-xl resize-none mb-2"
                    maxLength={2000}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sending ? "Skickar…" : "Svara"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 border-t-hair text-center text-[13px] text-muted-foreground italic">
                  Tråden är stängd.
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <NewInsightDialog
        open={insightDialogOpen}
        onOpenChange={setInsightDialogOpen}
        onCreated={() => {
          toast({ title: "Insikt sparad", description: "Hittas under fliken Insikter." });
          setInsightPrefill(null);
        }}
        themes={insightThemes}
        prefill={insightPrefill}
      />
    </div>
  );
}
