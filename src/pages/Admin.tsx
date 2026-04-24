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
import { ArrowLeft, Search, Sparkles, MessageSquare, Eye, Lightbulb } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TIER_LABEL, type Tier } from "@/lib/tierLimits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackAdminPanel } from "@/components/feedback/FeedbackAdminPanel";
import { useAdminUnreadMessages } from "@/hooks/useUnreadMessages";
import { VisitsPanel } from "@/components/admin/VisitsPanel";
import { InsightsPanel } from "@/components/admin/insights/InsightsPanel";

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

export default function Admin() {
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ row: UserRow; newTier: Tier } | null>(null);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<"users" | "feedback" | "visits" | "insikter">(() => {
    if (typeof window === "undefined") return "users";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "feedback") return "feedback";
    if (t === "visits") return "visits";
    if (t === "insikter") return "insikter";
    return "users";
  });
  const adminUnread = useAdminUnreadMessages(tier === "admin");

  // Skydd: bara admin
  useEffect(() => {
    if (!tierLoading && tier !== "admin") {
      navigate("/bibliotek", { replace: true });
    }
  }, [tier, tierLoading, navigate]);

  const [now, setNow] = useState(() => Date.now());

  // Tick var 30:e sekund så "X min sedan" uppdateras
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
    // Behåll RPC-sortering (online först, sen senast aktiv)
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
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laddar…</div>;
  }

  return (
    <div className="min-h-screen">
      <SEO title="Admin – Manuskort" noindex nofollow />
      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bibliotek")}
          className="rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 h-8 -ml-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tillbaka
        </Button>
        <h1 className="font-display text-[17px] font-semibold tracking-tight">Admin</h1>
        <span className="ml-2 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40">
          ADMIN
        </span>
        <span className="ml-auto text-[13px] text-muted-foreground hidden sm:inline">
          {user?.email}
        </span>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-12 pb-20">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "users" | "feedback" | "visits" | "insikter");
            const url = new URL(window.location.href);
            if (v === "users") url.searchParams.delete("tab");
            else url.searchParams.set("tab", v);
            window.history.replaceState({}, "", url.toString());
          }}
        >
          <TabsList className="bg-surface-2 rounded-full p-1 h-11 mb-8">
            <TabsTrigger value="users" className="rounded-full px-5 text-[14px] data-[state=active]:bg-background">
              Användare
            </TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-full px-5 text-[14px] data-[state=active]:bg-background relative gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Feedback
              {adminUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {adminUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="visits" className="rounded-full px-5 text-[14px] data-[state=active]:bg-background gap-2">
              <Eye className="h-3.5 w-3.5" />
              Besök
            </TabsTrigger>
            <TabsTrigger value="insikter" className="rounded-full px-5 text-[14px] data-[state=active]:bg-background gap-2">
              <Lightbulb className="h-3.5 w-3.5" />
              Insikter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Användare</h2>
              <p className="text-muted-foreground text-[15px] mt-2">
                Promota till PRO eller degradera till Gratis. Admin-rollen hanteras direkt i databasen.
              </p>
            </div>

            <div className="mb-6 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Sök e-post"
                className="pl-11 h-11 rounded-full bg-surface-2 border-0 text-[14px] focus-visible:ring-2 focus-visible:ring-accent-blue"
              />
            </div>

            <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
              {loading ? (
                <p className="text-center text-muted-foreground py-16">Laddar användare…</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-16">Inga användare matchar.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-hair">
                      <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">E-post</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[160px]">Status</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[120px]">Nivå</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[100px] text-right">Manus</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[180px] text-right">Åtgärd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isAdmin = r.tier === "admin";
                      const isPro = r.tier === "pro";
                      const seen = formatLastSeen(r.last_seen_at, now);
                      return (
                        <TableRow key={r.user_id} className="border-b-hair hover:bg-surface-2/40">
                          <TableCell className="font-medium text-[14px]">
                            {r.email ?? <span className="text-muted-foreground italic">(ingen e-post)</span>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  seen.online
                                    ? "bg-[hsl(var(--cue-teal))] shadow-[0_0_0_3px_hsl(var(--cue-teal)/0.18)]"
                                    : "bg-muted-foreground/40"
                                }`}
                                aria-hidden="true"
                              />
                              <span className={seen.online ? "text-foreground font-medium" : ""}>
                                {seen.label}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                                isAdmin
                                  ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40"
                                  : isPro
                                  ? "bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/30"
                                  : "bg-surface-2 text-muted-foreground"
                              }`}
                            >
                              {TIER_LABEL[r.tier].toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-[14px] tabular-nums">{r.manuscript_count}</TableCell>
                          <TableCell className="text-right">
                            {isAdmin ? (
                              <span className="text-[12px] text-muted-foreground italic">Skyddad</span>
                            ) : isPro ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full text-[13px] h-8"
                                onClick={() => setPending({ row: r, newTier: "free" })}
                              >
                                Degradera till Gratis
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] h-8 gap-1"
                                onClick={() => setPending({ row: r, newTier: "pro" })}
                              >
                                <Sparkles className="h-3 w-3" /> Promota till PRO
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <p className="text-[12px] text-muted-foreground mt-4">
              Totalt {rows.length} användare · {rows.filter((r) => r.last_seen_at && now - new Date(r.last_seen_at).getTime() < ONLINE_THRESHOLD_MS).length} online nu · {rows.filter((r) => r.tier === "pro").length} PRO · {rows.filter((r) => r.tier === "admin").length} admin
            </p>
          </TabsContent>

          <TabsContent value="feedback">
            <div className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Feedback</h2>
              <p className="text-muted-foreground text-[15px] mt-2">
                Inkomna meddelanden från användare. Svara, stäng eller läs konversationer.
              </p>
            </div>
            <FeedbackAdminPanel />
          </TabsContent>

          <TabsContent value="visits">
            <div className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Besök</h2>
              <p className="text-muted-foreground text-[15px] mt-2">
                Anonym logg av besök på landningssidan. Notiser skickas till Telegram (max 1/dygn per besökare).
              </p>
            </div>
            <VisitsPanel />
          </TabsContent>

          <TabsContent value="insikter">
            <InsightsPanel />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {pending?.newTier === "pro" ? "Promota till PRO?" : "Degradera till Gratis?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.newTier === "pro" ? (
                <>Ge <span className="font-medium text-foreground">{pending?.row.email}</span> obegränsad tillgång till alla funktioner.</>
              ) : (
                <>
                  Sätt <span className="font-medium text-foreground">{pending?.row.email}</span> till Gratis.
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
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
            >
              {working ? "Uppdaterar…" : "Bekräfta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
