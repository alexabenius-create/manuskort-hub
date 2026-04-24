import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Inbox, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ShareRequestCard } from "@/components/feedback/ShareRequestCard";
import { OwnerSupportBanner } from "@/components/SupportModeBanner";
import { useThreadShareRequests } from "@/hooks/useShareRequests";

interface Thread {
  id: string;
  user_id: string | null;
  subject: string;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
  unread: number;
  counterpartyName?: string | null;
}

interface Message {
  id: string;
  thread_id: string;
  sender_role: "user" | "admin";
  sender_user_id: string | null;
  body: string;
  created_at: string;
  read_by_user: boolean;
  read_by_admin: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  landing: "Startsida",
  library: "Bibliotek",
  editor: "Redigeringsläge",
  insight: "Produktåterkoppling",
  admin: "Meddelande från teamet",
};

function formatDate(s: string) {
  return new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

function ThreadShareSection({ threadId }: { threadId: string }) {
  const { items } = useThreadShareRequests(threadId);
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <ShareRequestCard key={r.id} request={r} />
      ))}
    </div>
  );
}

export default function MessagesV2() {
  const { user } = useAuth();
  const { tier } = useTier();
  const isAdmin = tier === "admin";
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = async () => {
    if (!user) return;
    setLoading(true);

    const { data: ownThreads } = await supabase
      .from("feedback_threads")
      .select("id, user_id, subject, source, status, created_at, updated_at")
      .eq("user_id", user.id);

    const all = new Map<string, Omit<Thread, "unread">>();
    (ownThreads ?? []).forEach((t) => { all.set(t.id, { ...t }); });

    if (isAdmin) {
      const { data: sentMsgs } = await supabase
        .from("feedback_messages")
        .select("thread_id")
        .eq("sender_user_id", user.id)
        .eq("sender_role", "admin");

      const sentThreadIds = Array.from(new Set((sentMsgs ?? []).map((m) => m.thread_id)));
      const newIds = sentThreadIds.filter((id) => !all.has(id));

      if (newIds.length > 0) {
        const { data: extraThreads } = await supabase
          .from("feedback_threads")
          .select("id, user_id, subject, source, status, created_at, updated_at")
          .in("id", newIds);
        (extraThreads ?? []).forEach((t) => { all.set(t.id, { ...t }); });
      }
    }

    const list = Array.from(all.values());
    if (list.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);

    const counterMap = new Map<string, string | null>();
    if (isAdmin) {
      const recipientIds = Array.from(
        new Set(list.filter((t) => t.user_id && t.user_id !== user.id).map((t) => t.user_id as string)),
      );
      if (recipientIds.length > 0) {
        const { data: users } = await supabase.rpc("admin_list_users");
        (users as Array<{ user_id: string; display_name: string | null; email: string | null }> | null)?.forEach((u) => {
          if (recipientIds.includes(u.user_id)) {
            counterMap.set(u.user_id, u.display_name || u.email || null);
          }
        });
      }
    }

    const { data: msgs } = await supabase
      .from("feedback_messages")
      .select("thread_id, sender_role, sender_user_id, read_by_user, read_by_admin")
      .in("thread_id", ids);

    const unreadMap = new Map<string, number>();
    (msgs ?? []).forEach((m) => {
      const t = all.get(m.thread_id);
      if (!t) return;
      const isOwner = t.user_id === user.id;
      let unread = false;
      if (isOwner) unread = m.sender_role === "admin" && !m.read_by_user;
      else unread = m.sender_role === "user" && !m.read_by_admin;
      if (unread) unreadMap.set(m.thread_id, (unreadMap.get(m.thread_id) ?? 0) + 1);
    });

    const enriched: Thread[] = list
      .map((t) => ({
        ...t,
        unread: unreadMap.get(t.id) ?? 0,
        counterpartyName: t.user_id && t.user_id !== user.id ? counterMap.get(t.user_id) ?? null : null,
      }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    setThreads(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
    if (!user) return;

    const channel = supabase
      .channel(`messages-page-v2-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => {
          loadThreads();
          if (activeId) loadMessages(activeId);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const loadMessages = async (threadId: string) => {
    const { data } = await supabase
      .from("feedback_messages")
      .select("id, thread_id, sender_role, sender_user_id, body, created_at, read_by_user, read_by_admin")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);

    if (!user) return;
    const thread = threads.find((t) => t.id === threadId);
    const isOwner = thread?.user_id === user.id;

    if (isOwner) {
      const unread = (data ?? []).filter((m) => m.sender_role === "admin" && !m.read_by_user);
      if (unread.length > 0) {
        await supabase.from("feedback_messages").update({ read_by_user: true }).in("id", unread.map((m) => m.id));
        loadThreads();
      }
    } else if (isAdmin) {
      const unread = (data ?? []).filter((m) => m.sender_role === "user" && !m.read_by_admin);
      if (unread.length > 0) {
        await supabase.from("feedback_messages").update({ read_by_admin: true }).in("id", unread.map((m) => m.id));
        loadThreads();
      }
    }
  };

  const openThread = (id: string) => {
    setActiveId(id);
    loadMessages(id);
  };

  const sendReply = async () => {
    if (!activeId || !reply.trim() || !user) return;
    const thread = threads.find((t) => t.id === activeId);
    const isOwner = thread?.user_id === user.id;
    const senderRole: "user" | "admin" = isOwner ? "user" : "admin";

    setSending(true);
    const { error } = await supabase.from("feedback_messages").insert({
      thread_id: activeId,
      sender_role: senderRole,
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
  };

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId), [threads, activeId]);

  return (
    <div className="bg-v2-bg min-h-screen relative overflow-hidden">
      <SEO title="Mina meddelanden – Manuskort" noindex nofollow />

      <OwnerSupportBanner />

      {/* Mesh-glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)" }} />
        <div className="absolute top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/3 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-v2-line px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bibliotek-v2")}
          className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-white h-8 -ml-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tillbaka
        </Button>
        <h1 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">Mina meddelanden</h1>
      </header>

      <main className="relative max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 pb-20 grid md:grid-cols-[320px_1fr] gap-6">
        {/* Tråd-lista */}
        <aside className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-center text-v2-muted py-12 text-[14px]">Laddar…</p>
          ) : threads.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Inbox className="h-8 w-8 mx-auto text-v2-muted/50 mb-3" />
              <p className="text-[14px] text-v2-muted">Inga meddelanden än.</p>
              <p className="text-[12px] text-v2-muted/70 mt-1">Skicka feedback från en av sidorna.</p>
            </div>
          ) : (
            <ul className="divide-y divide-v2-line">
              {threads.map((t) => {
                const isActive = t.id === activeId;
                const isAdminThread = user && t.user_id !== user.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isActive ? "bg-v2-violet/10" : "hover:bg-v2-violet/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[14px] font-medium truncate text-v2-ink">{t.subject}</span>
                        {t.unread > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      {isAdminThread && t.counterpartyName && (
                        <div className="text-[11px] text-v2-violet mb-0.5 truncate">→ {t.counterpartyName}</div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-v2-muted">
                        <span>{SOURCE_LABEL[t.source] ?? t.source}</span>
                        <span>{formatDate(t.updated_at)}</span>
                      </div>
                      {t.status === "closed" && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-v2-muted/70">
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
        <section className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm min-h-[400px] flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
              <MessageSquare className="h-10 w-10 text-v2-muted/40 mb-3" />
              <p className="text-[14px] text-v2-muted">Välj en tråd för att läsa.</p>
            </div>
          ) : (
            <>
              <header className="px-6 py-4 border-b border-v2-line">
                <h2 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">{activeThread.subject}</h2>
                <p className="text-[12px] text-v2-muted mt-0.5">
                  {activeThread.counterpartyName && <>Med {activeThread.counterpartyName} · </>}
                  {SOURCE_LABEL[activeThread.source] ?? activeThread.source} · {formatDate(activeThread.created_at)}
                </p>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                <ThreadShareSection threadId={activeThread.id} />
                {messages.map((m) => {
                  const isMine = m.sender_user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-wrap ${
                          isMine ? "text-white shadow-sm" : "bg-white border border-v2-line text-v2-ink"
                        }`}
                        style={isMine ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
                      >
                        {!isMine && (
                          <div className="text-[10px] font-bold uppercase tracking-wide mb-1 text-v2-muted">
                            {m.sender_role === "admin" ? "Manuskort-team" : "Användare"}
                          </div>
                        )}
                        <div>{m.body}</div>
                        <div className={`text-[10px] mt-1 ${isMine ? "text-white/70" : "text-v2-muted"}`}>
                          {formatDate(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeThread.status === "open" ? (
                <div className="px-6 py-4 border-t border-v2-line">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Skriv ett uppföljningsmeddelande…"
                    className="min-h-[80px] rounded-xl resize-none mb-2 bg-white border border-v2-line focus-visible:ring-2 focus-visible:ring-v2-violet"
                    maxLength={2000}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      className="v2-btn-primary inline-flex items-center gap-1.5 h-10 px-5 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sending ? "Skickar…" : "Skicka"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-v2-line text-center text-[13px] text-v2-muted italic">
                  Tråden är stängd.
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
