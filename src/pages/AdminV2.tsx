import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, Sparkles, MessageSquare, Eye, Lightbulb, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TIER_LABEL, type Tier } from "@/lib/tierLimits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackAdminPanel } from "@/components/feedback/FeedbackAdminPanel";
import { useAdminUnreadMessages } from "@/hooks/useUnreadMessages";
import { VisitsPanel } from "@/components/admin/VisitsPanel";
import { InsightsPanel } from "@/components/admin/insights/InsightsPanel";
import { AiUsagePanel } from "@/components/admin/AiUsagePanel";
import { BetaAccessPanel } from "@/components/admin/BetaAccessPanel";

interface UserRow {
  user_id: string;
  email: string | null;
  tier: Tier;
  manuscript_count: number;
  last_seen_at: string | null;
}

interface AdminListUserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  tier: Tier;
  manuscript_count: number;
  created_at: string;
  last_seen_at: string | null;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function formatLastSeen(iso: string | null, nowMs: number): { label: string; online: boolean } {
  if (!iso) return { label: "Aldrig", online: false };
  const t = new Date(iso).getTime();
  const diff = nowMs - t;
  if (diff < ONLINE_THRESHOLD_MS) return { label: "Online nu", online: true };
  const min = Math.floor(diff / 60_000);
  if (min < 60) return { label: `${min} min sedan`, online: false };
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return { label: `${hrs} h sedan`, online: false };
  const days = Math.floor(hrs / 24);
  if (days < 30) return { label: `${days} d sedan`, online: false };
  return { label: new Date(iso).toLocaleDateString("sv-SE"), online: false };
}

export default function AdminV2() {
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ row: UserRow; newTier: Tier } | null>(null);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<"users" | "feedback" | "visits" | "insikter" | "ai" | "beta">(() => {
    if (typeof window === "undefined") return "users";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "feedback") return "feedback";
    if (t === "visits") return "visits";
    if (t === "insikter") return "insikter";
    if (t === "ai") return "ai";
    if (t === "beta") return "beta";
    return "users";
  });
  const adminUnread = useAdminUnreadMessages(tier === "admin");

  useEffect(() => {
    if (!tierLoading && tier !== "admin") {
      navigate("/bibliotek-v2", { replace: true });
    }
  }, [tier, tierLoading, navigate]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast({ title: "Kunde inte ladda användare", description: error.message, variant: "destructive" });
      setRows([]);
      setLoading(false);
      return;
    }
    const list: UserRow[] = ((data ?? []) as AdminListUserRow[]).map((r) => ({
      user_id: r.user_id,
      email: r.email,
      tier: r.tier,
      manuscript_count: Number(r.manuscript_count ?? 0),
      last_seen_at: r.last_seen_at,
    }));
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    if (tier === "admin") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const ql = q.toLowerCase();
    return rows.filter((r) => (r.email ?? "").toLowerCase().includes(ql));
  }, [rows, q]);

  const confirmChange = async () => {
    if (!pending) return;
    setWorking(true);
    const { error } = await supabase.rpc("admin_set_user_tier", {
      _target_user_id: pending.row.user_id,
      _new_tier: pending.newTier,
    });
    setWorking(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Uppdaterad",
      description: `${pending.row.email ?? "Användare"} är nu ${TIER_LABEL[pending.newTier]}.`,
    });
    setPending(null);
    load();
  };

  if (tierLoading || tier !== "admin") {
    return <div className="min-h-screen flex items-center justify-center text-v2-muted bg-v2-bg">Laddar…</div>;
  }

  return (
    <div className="bg-v2-bg min-h-screen relative overflow-hidden">
      <SEO title="Admin – Manuskort" noindex nofollow />

      {/* Mesh-glow bakgrund */}
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
        <h1 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">Admin</h1>
        <span className="ml-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide text-white"
              style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}>
          ADMIN
        </span>
        <span className="ml-auto text-[13px] text-v2-muted hidden sm:inline">
          {user?.email}
        </span>
      </header>

      <main className="relative max-w-[1100px] mx-auto px-6 sm:px-10 pt-12 pb-20">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "users" | "feedback" | "visits" | "insikter" | "ai" | "beta");
            const url = new URL(window.location.href);
            if (v === "users") url.searchParams.delete("tab");
            else url.searchParams.set("tab", v);
            window.history.replaceState({}, "", url.toString());
          }}
        >
          <TabsList className="bg-white/70 backdrop-blur-xl border border-v2-line rounded-full p-1 h-11 mb-8 shadow-sm">
            <TabsTrigger
              value="users"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white data-[state=active]:shadow-sm"
              style={tab === "users" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              Användare
            </TabsTrigger>
            <TabsTrigger
              value="feedback"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white relative gap-2"
              style={tab === "feedback" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Feedback
              {adminUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                  {adminUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white gap-2"
              style={tab === "visits" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <Eye className="h-3.5 w-3.5" />
              Besök
            </TabsTrigger>
            <TabsTrigger
              value="insikter"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white gap-2"
              style={tab === "insikter" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Insikter
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white gap-2"
              style={tab === "ai" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </TabsTrigger>
            <TabsTrigger
              value="beta"
              className="rounded-full px-5 text-[14px] text-v2-muted data-[state=active]:text-white gap-2"
              style={tab === "beta" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              BETA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="mb-8 v2-reveal">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">Användare</h2>
              <p className="text-v2-muted text-[15px] mt-2">
                Promota till PRO eller degradera till Gratis. Admin-rollen hanteras direkt i databasen.
              </p>
            </div>

            <div className="mb-6 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-v2-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Sök e-post"
                className="pl-11 h-11 rounded-full bg-white/80 backdrop-blur border border-v2-line text-[14px] focus-visible:ring-2 focus-visible:ring-v2-violet"
              />
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm overflow-hidden">
              {loading ? (
                <p className="text-center text-v2-muted py-16">Laddar användare…</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-v2-muted py-16">Inga användare matchar.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-v2-line">
                      <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium">E-post</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium w-[160px]">Status</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium w-[120px]">Nivå</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium w-[100px] text-right">Manus</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-v2-muted font-medium w-[180px] text-right">Åtgärd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isAdmin = r.tier === "admin";
                      const isPro = r.tier === "pro";
                      const seen = formatLastSeen(r.last_seen_at, now);
                      return (
                        <TableRow key={r.user_id} className="border-b border-v2-line hover:bg-v2-violet/5 transition-colors">
                          <TableCell className="font-medium text-[14px] text-v2-ink">
                            {r.email ?? <span className="text-v2-muted italic">(ingen e-post)</span>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-[12px] text-v2-muted">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  seen.online
                                    ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                    : "bg-v2-muted/40"
                                }`}
                                aria-hidden="true"
                              />
                              <span className={seen.online ? "text-v2-ink font-medium" : ""}>
                                {seen.label}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${
                                isAdmin
                                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                  : isPro
                                  ? "text-white"
                                  : "bg-slate-100 text-v2-muted"
                              }`}
                              style={isPro && !isAdmin ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
                            >
                              {TIER_LABEL[r.tier].toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-[14px] tabular-nums text-v2-ink">{r.manuscript_count}</TableCell>
                          <TableCell className="text-right">
                            {isAdmin ? (
                              <span className="text-[12px] text-v2-muted italic">Skyddad</span>
                            ) : isPro ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full text-[13px] h-8 text-v2-muted hover:text-v2-ink"
                                onClick={() => setPending({ row: r, newTier: "free" })}
                              >
                                Degradera till Gratis
                              </Button>
                            ) : (
                              <button
                                onClick={() => setPending({ row: r, newTier: "pro" })}
                                className="v2-btn-primary inline-flex items-center gap-1 h-8 px-4 text-[13px]"
                              >
                                <Sparkles className="h-3 w-3" /> Promota till PRO
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <p className="text-[12px] text-v2-muted mt-4">
              Totalt {rows.length} användare · {rows.filter((r) => r.last_seen_at && now - new Date(r.last_seen_at).getTime() < ONLINE_THRESHOLD_MS).length} online nu · {rows.filter((r) => r.tier === "pro").length} PRO · {rows.filter((r) => r.tier === "admin").length} admin
            </p>
          </TabsContent>

          <TabsContent value="feedback">
            <div className="mb-8 v2-reveal">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">Feedback</h2>
              <p className="text-v2-muted text-[15px] mt-2">
                Inkomna meddelanden från användare. Svara, stäng eller läs konversationer.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-4 sm:p-6">
              <FeedbackAdminPanel />
            </div>
          </TabsContent>

          <TabsContent value="visits">
            <div className="mb-8 v2-reveal">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink">Besök</h2>
              <p className="text-v2-muted text-[15px] mt-2">
                Anonym logg av besök på landningssidan. Notiser skickas till Telegram (max 1/dygn per besökare).
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-4 sm:p-6">
              <VisitsPanel />
            </div>
          </TabsContent>

          <TabsContent value="insikter">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-4 sm:p-6">
              <InsightsPanel />
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-4 sm:p-6">
              <AiUsagePanel />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="rounded-3xl border border-v2-line bg-white/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-v2-ink">
              {pending?.newTier === "pro" ? "Promota till PRO?" : "Degradera till Gratis?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-v2-muted">
              {pending?.newTier === "pro" ? (
                <>Ge <span className="font-medium text-v2-ink">{pending?.row.email}</span> obegränsad tillgång till alla funktioner.</>
              ) : (
                <>
                  Sätt <span className="font-medium text-v2-ink">{pending?.row.email}</span> till Gratis.
                  Användaren kommer att möta gränser för manus, kort och deltagare. Befintlig data raderas inte.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmChange}
              disabled={working}
              asChild
            >
              <button className="v2-btn-primary inline-flex items-center h-10 px-5 text-[14px]">
                {working ? "Uppdaterar…" : "Bekräfta"}
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
