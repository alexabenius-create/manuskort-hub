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
  /** Visningsnamn på motparten (mottagaren) — bara satt för admin-vy. */
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

/** Visar alla delningsbegäran för aktiv tråd (live). */
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

export default function Messages() {
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

    // 1) Trådar där jag är mottagare
    const { data: ownThreads } = await supabase
      .from("feedback_threads")
      .select("id, user_id, subject, source, status, created_at, updated_at")
      .eq("user_id", user.id);

    const all = new Map<string, Omit<Thread, "unread">>();
    (ownThreads ?? []).forEach((t) => {
      all.set(t.id, { ...t });
    });

    // 2) För admins: trådar där jag har skickat som admin
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
        (extraThreads ?? []).forEach((t) => {
          all.set(t.id, { ...t });
        });
      }
    }

    const list = Array.from(all.values());
    if (list.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);

    // Hämta motpartens namn för admin-trådar
    const counterMap = new Map<string, string | null>();
    if (isAdmin) {
      const recipientIds = Array.from(
        new Set(
          list
            .filter((t) => t.user_id && t.user_id !== user.id)
            .map((t) => t.user_id as string),
        ),
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

    // Räkna olästa per tråd
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
      if (isOwner) {
        unread = m.sender_role === "admin" && !m.read_by_user;
      } else {
        // Admin-vy
        unread = m.sender_role === "user" && !m.read_by_admin;
      }
      if (unread) {
        unreadMap.set(m.thread_id, (unreadMap.get(m.thread_id) ?? 0) + 1);
      }
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
      .channel(`messages-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => {
          loadThreads();
          if (activeId) loadMessages(activeId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      // Markera admin-meddelanden som lästa av user
      const unread = (data ?? []).filter((m) => m.sender_role === "admin" && !m.read_by_user);
      if (unread.length > 0) {
        await supabase
          .from("feedback_messages")
          .update({ read_by_user: true })
          .in("id", unread.map((m) => m.id));
        loadThreads();
      }
    } else if (isAdmin) {
      // Admin-vy: markera user-meddelanden som lästa av admin
      const unread = (data ?? []).filter((m) => m.sender_role === "user" && !m.read_by_admin);
      if (unread.length > 0) {
        await supabase
          .from("feedback_messages")
          .update({ read_by_admin: true })
          .in("id", unread.map((m) => m.id));
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
    <div className="min-h-screen">
      <SEO title="Mina meddelanden – Manuskort" noindex nofollow />

      <OwnerSupportBanner />

      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bibliotek")}
          className="rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 h-8 -ml-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tillbaka
        </Button>
        <h1 className="font-display text-[17px] font-semibold tracking-tight">Mina meddelanden</h1>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 pb-20 grid md:grid-cols-[320px_1fr] gap-6">
        {/* Tråd-lista */}
        <aside className="bg-surface rounded-2xl shadow-card overflow-hidden">
          {loading ? (
            <p className="text-center text-muted-foreground py-12 text-[14px]">Laddar…</p>
          ) : threads.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-[14px] text-muted-foreground">Inga meddelanden än.</p>
              <p className="text-[12px] text-muted-foreground/70 mt-1">
                Skicka feedback från en av sidorna.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {threads.map((t) => {
                const isActive = t.id === activeId;
                const isAdminThread = user && t.user_id !== user.id;
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
                        {t.unread > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      {isAdminThread && t.counterpartyName && (
                        <div className="text-[11px] text-accent-blue mb-0.5 truncate">
                          → {t.counterpartyName}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
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
        <section className="bg-surface rounded-2xl shadow-card min-h-[400px] flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-[14px] text-muted-foreground">Välj en tråd för att läsa.</p>
            </div>
          ) : (
            <>
              <header className="px-6 py-4 border-b-hair">
                <h2 className="font-display text-[17px] font-semibold tracking-tight">{activeThread.subject}</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
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
                          isMine
                            ? "bg-accent-blue text-white"
                            : "bg-surface-2 text-foreground"
                        }`}
                      >
                        {!isMine && (
                          <div className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">
                            {m.sender_role === "admin" ? "Manuskort-team" : "Användare"}
                          </div>
                        )}
                        <div>{m.body}</div>
                        <div className={`text-[10px] mt-1 ${isMine ? "text-white/70" : "text-muted-foreground"}`}>
                          {formatDate(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeThread.status === "open" ? (
                <div className="px-6 py-4 border-t-hair">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Skriv ett uppföljningsmeddelande…"
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
                      {sending ? "Skickar…" : "Skicka"}
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
      </main>
    </div>
  );
}
