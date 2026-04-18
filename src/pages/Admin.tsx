import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TIER_LABEL, type Tier } from "@/lib/tierLimits";

interface UserRow {
  user_id: string;
  email: string | null;
  tier: Tier;
  manuscript_count: number;
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

  // Skydd: bara admin
  useEffect(() => {
    if (!tierLoading && tier !== "admin") {
      navigate("/", { replace: true });
    }
  }, [tier, tierLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: manuscripts }] = await Promise.all([
      supabase.from("profiles").select("user_id, email"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("manuscripts").select("user_id"),
    ]);

    const roleMap = new Map<string, Tier>();
    (roles ?? []).forEach((r) => {
      const current = roleMap.get(r.user_id);
      // admin > pro > free
      if (r.role === "admin") roleMap.set(r.user_id, "admin");
      else if (r.role === "pro" && current !== "admin") roleMap.set(r.user_id, "pro");
      else if (!current) roleMap.set(r.user_id, "free");
    });

    const countMap = new Map<string, number>();
    (manuscripts ?? []).forEach((m) => {
      countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1);
    });

    const list: UserRow[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      email: p.email,
      tier: roleMap.get(p.user_id) ?? "free",
      manuscript_count: countMap.get(p.user_id) ?? 0,
    }));

    list.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
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
      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
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
                  <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[120px]">Nivå</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[100px] text-right">Manus</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium w-[180px] text-right">Åtgärd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isAdmin = r.tier === "admin";
                  const isPro = r.tier === "pro";
                  return (
                    <TableRow key={r.user_id} className="border-b-hair hover:bg-surface-2/40">
                      <TableCell className="font-medium text-[14px]">
                        {r.email ?? <span className="text-muted-foreground italic">(ingen e-post)</span>}
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
          Totalt {rows.length} användare · {rows.filter((r) => r.tier === "pro").length} PRO · {rows.filter((r) => r.tier === "admin").length} admin
        </p>
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
