import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Search, LogOut, Sparkles, Settings as SettingsIcon, Upload, Shield, Sparkle, Trash2, X, Inbox, FileText } from "lucide-react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { UnreadBadge } from "@/components/feedback/UnreadBadge";
import { useUnreadMessages, useAdminUnreadMessages } from "@/hooks/useUnreadMessages";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpButton } from "@/components/HelpButton";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { EXAMPLE_TAG } from "@/lib/exampleManuscript";
import { seedExampleForUser, hasBeenSeeded, markAsSeeded } from "@/lib/seedExampleManuscript";
import { useTourTrigger } from "@/hooks/useTour";
import { useTier } from "@/hooks/useTier";
import { useAiUsage } from "@/hooks/useAiUsage";
import { Sparkles as SparklesIcon } from "lucide-react";
import { LIMITS, TIER_LABEL } from "@/lib/tierLimits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { WelcomeAfterSignupModal } from "@/components/WelcomeAfterSignupModal";
import { OwnerSupportBanner } from "@/components/SupportModeBanner";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];

export default function LibraryV2() {
  const { user, signOut } = useAuth();
  const { tier } = useTier();
  const limits = LIMITS[tier];
  const navigate = useNavigate();
  const unreadMessages = useUnreadMessages();
  const adminUnread = useAdminUnreadMessages(tier === "admin");
  const [items, setItems] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "moderator" | "speaker">("all");
  const [dragOver, setDragOver] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<{ title: string; description: string } | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [welcomeEmail, setWelcomeEmail] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("mk:welcome-pending");
    } catch {
      return null;
    }
  });
  const dismissWelcome = () => {
    try { sessionStorage.removeItem("mk:welcome-pending"); } catch { /* ignore */ }
    setWelcomeEmail(null);
  };

  const [openNew, setOpenNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<"moderator" | "speaker">("speaker");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const atManuscriptLimit = items.length >= limits.manuscripts;

  const requestNew = () => {
    if (atManuscriptLimit) {
      setUpgradeReason({
        title: "Du har nått gränsen för Gratis",
        description: `Gratis tillåter ${limits.manuscripts} manus. Uppgradera till PRO för obegränsat.`,
      });
      setUpgradeOpen(true);
      return;
    }
    setOpenNew(true);
  };

  const requestImport = () => {
    if (!limits.docxImport) {
      setUpgradeReason({
        title: "Import är en PRO-funktion",
        description: ".docx-import ingår inte i Gratis. Uppgradera till PRO för att importera dokument.",
      });
      setUpgradeOpen(true);
      return;
    }
    navigate("/importera");
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manuscripts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Kunde inte ladda", description: error.message, variant: "destructive" });
    const list = data ?? [];

    if (user && list.length === 0 && !hasBeenSeeded(user.id)) {
      markAsSeeded(user.id);
      const newId = await seedExampleForUser(user.id);
      if (newId) {
        const { data: refreshed } = await supabase
          .from("manuscripts")
          .select("*")
          .order("updated_at", { ascending: false });
        setItems(refreshed ?? []);
        setLoading(false);
        return;
      }
    }

    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data && !data.onboarding_completed) {
        setNeedsOnboarding(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const exampleExists = items.some((m) => (m.tags ?? []).includes(EXAMPLE_TAG));
  useTourTrigger("bibliotek", !loading && exampleExists && !welcomeEmail && !needsOnboarding);

  const filtered = useMemo(() => {
    return items.filter((m) => {
      if (filterMode !== "all" && m.mode !== filterMode) return false;
      if (!q.trim()) return true;
      const ql = q.toLowerCase();
      return m.title.toLowerCase().includes(ql) || (m.tags ?? []).some((t) => t.toLowerCase().includes(ql));
    });
  }, [items, q, filterMode]);

  const createNew = async () => {
    if (!user) return;
    const title = newTitle.trim() || "Nytt manus";
    const { data, error } = await supabase
      .from("manuscripts")
      .insert({ user_id: user.id, title, mode: newMode })
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Kunde inte skapa", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("cards").insert({
      manuscript_id: data.id,
      user_id: user.id,
      position: 0,
      role: newMode,
    });
    setOpenNew(false);
    setNewTitle("");
    navigate(`/manus/${data.id}`);
  };

  const duplicate = async (m: Manuscript) => {
    if (!user) return;
    const { data: dup, error } = await supabase
      .from("manuscripts")
      .insert({
        user_id: user.id,
        title: m.title + " (kopia)",
        mode: m.mode,
        tags: m.tags,
        text_size: m.text_size,
        show_notes: m.show_notes,
        show_times: m.show_times,
        wpm: m.wpm,
      })
      .select()
      .single();
    if (error || !dup) { toast({ title: "Misslyckades", description: error?.message, variant: "destructive" }); return; }
    const { data: cards } = await supabase.from("cards").select("*").eq("manuscript_id", m.id).order("position");
    if (cards && cards.length) {
      await supabase.from("cards").insert(
        cards.map((c) => ({
          manuscript_id: dup.id,
          user_id: user.id,
          position: c.position,
          role: c.role,
          title: c.title,
          content_html: c.content_html,
          notes: c.notes,
          start_time: c.start_time,
          end_time: c.end_time,
          cue_red: c.cue_red,
          cue_amber: c.cue_amber,
          cue_teal: c.cue_teal,
        }))
      );
    }
    load();
  };

  const remove = async (m: Manuscript) => {
    if (!confirm(`Radera "${m.title}"? Detta går inte att ångra.`)) return;
    const { error } = await supabase.from("manuscripts").delete().eq("id", m.id);
    if (error) { toast({ title: "Misslyckades", description: error.message, variant: "destructive" }); return; }
    setItems((prev) => prev.filter((x) => x.id !== m.id));
    setSelectedIds((prev) => {
      if (!prev.has(m.id)) return prev;
      const next = new Set(prev);
      next.delete(m.id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map((m) => m.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("manuscripts").delete().in("id", ids);
    setBulkDeleting(false);
    if (error) {
      toast({ title: "Misslyckades", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((x) => !selectedIds.has(x.id)));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast({ title: `${ids.length} manus raderade` });
  };

  const renameSubmit = async () => {
    if (!renameId) return;
    const title = renameValue.trim() || "Untitled";
    const { error } = await supabase.from("manuscripts").update({ title }).eq("id", renameId);
    if (error) { toast({ title: "Misslyckades", description: error.message, variant: "destructive" }); return; }
    setItems((prev) => prev.map((x) => (x.id === renameId ? { ...x, title } : x)));
    setRenameId(null);
  };

  const filters: ["all" | "moderator" | "speaker", string][] = [
    ["all", "Alla"],
    ["moderator", "Moderator"],
    ["speaker", "Talare"],
  ];

  const dragCounter = { current: 0 };

  const onDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      dragCounter.current += 1;
      setDragOver(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!limits.docxImport) {
      setUpgradeReason({
        title: "Import är en PRO-funktion",
        description: ".docx-import ingår inte i Gratis. Uppgradera till PRO för att importera dokument.",
      });
      setUpgradeOpen(true);
      return;
    }
    navigate("/importera", { state: { file } });
  };

  return (
    <>
    <SEO title="Bibliotek – Manuskort" noindex nofollow />
    <div
      className="bg-v2-bg text-v2-ink min-h-screen relative overflow-x-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.dataTransfer?.types?.includes("Files") && e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Mesh-glow bakgrund (samma teknik som Landing v2) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1100px] rounded-full opacity-60 blur-3xl"
             style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.18), transparent 70%)" }} />
        <div className="absolute -top-20 left-[15%] h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(closest-side, rgba(59,130,246,0.16), transparent 70%)" }} />
        <div className="absolute -top-10 right-[10%] h-[380px] w-[380px] rounded-full opacity-40 blur-3xl"
             style={{ background: "radial-gradient(closest-side, rgba(236,72,153,0.14), transparent 70%)" }} />
      </div>

      {dragOver && (
        <div className="fixed inset-0 z-[100] backdrop-blur-md pointer-events-none flex items-center justify-center"
             style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(59,130,246,0.18))" }}>
          <div className="bg-white/95 rounded-3xl shadow-2xl px-10 py-8 text-center border border-v2-line">
            <div className="v2-card-icon mx-auto" style={{ marginBottom: 12 }}>
              <Upload className="h-5 w-5" />
            </div>
            <p className="font-display text-[20px] font-semibold text-v2-ink tracking-tight">Släpp för att importera</p>
            <p className="text-[13px] text-v2-muted mt-1">.docx eller .txt</p>
          </div>
        </div>
      )}

      <OwnerSupportBanner />

      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-v2-line bg-white/70 backdrop-blur-xl px-6 sm:px-10 h-14 flex items-center gap-6">
        <Link to="/" className="font-display text-[17px] font-semibold tracking-tight text-v2-ink hover:opacity-70 transition-opacity" aria-label="Till startsidan">
          <h1>Manuskort</h1>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[13px] text-v2-muted hidden sm:inline-flex items-center gap-2">
              {user?.email}
              {(tier === "pro" || tier === "admin") && (
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                    tier === "admin"
                      ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40"
                      : "text-white"
                  }`}
                  style={tier === "pro" ? { background: "linear-gradient(135deg, #6366f1, #3b82f6)" } : undefined}
                >
                  {TIER_LABEL[tier]}
                </span>
              )}
            </span>
            {tier === "free" && (
              <Link to="/priser" className="v2-btn-primary" style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
                <Sparkle className="h-3.5 w-3.5" /> Uppgradera
              </Link>
            )}
            {tier === "admin" && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full text-[13px] text-v2-muted hover:text-v2-violet hover:bg-v2-surface h-8 relative"
              >
                <a href="/admin?tab=feedback">
                  <Shield className="h-3.5 w-3.5" /> Admin
                  <UnreadBadge count={adminUnread} />
                </a>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full text-[13px] text-v2-muted hover:text-v2-violet hover:bg-v2-surface h-8"
            >
              <a href="/installningar"><SettingsIcon className="h-3.5 w-3.5" /> Inställningar</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full text-[13px] text-v2-muted hover:text-v2-violet hover:bg-v2-surface h-8 relative"
            >
              <a href="/meddelanden" aria-label="Mina meddelanden">
                <Inbox className="h-3.5 w-3.5" /> Meddelanden
                <UnreadBadge count={unreadMessages} />
              </a>
            </Button>
            <FeedbackButton source="library" withLabel />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="rounded-full text-[13px] text-v2-muted hover:text-v2-violet hover:bg-v2-surface h-8"
            >
              <LogOut className="h-3.5 w-3.5" /> Logga ut
            </Button>
            <HelpButton />
          </div>

          <div className="flex md:hidden items-center gap-1">
            <HelpButton />
            <MobileNavSheet title="Konto">
              <span className="px-3 pb-2 text-[12px] text-v2-muted break-all">
                {user?.email}
                {(tier === "pro" || tier === "admin") && (
                  <span
                    className={`ml-2 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide align-middle ${
                      tier === "admin"
                        ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40"
                        : "text-white"
                    }`}
                    style={tier === "pro" ? { background: "linear-gradient(135deg, #6366f1, #3b82f6)" } : undefined}
                  >
                    {TIER_LABEL[tier]}
                  </span>
                )}
              </span>
              {tier === "free" && (
                <Link
                  to="/priser"
                  className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-v2-violet hover:bg-v2-surface transition-colors"
                >
                  <Sparkle className="h-4 w-4" /> Uppgradera
                </Link>
              )}
              {tier === "admin" && (
                <a
                  href="/admin"
                  className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors"
                >
                  <Shield className="h-4 w-4" /> Admin
                </a>
              )}
              <a
                href="/installningar"
                className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors"
              >
                <SettingsIcon className="h-4 w-4" /> Inställningar
              </a>
              <a
                href="/meddelanden"
                className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors relative"
              >
                <Inbox className="h-4 w-4" /> Mina meddelanden
                {unreadMessages > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {unreadMessages}
                  </span>
                )}
              </a>
              <FeedbackButton source="library" withLabel className="!justify-start !h-11 !px-3 !rounded-xl !text-[15px] !text-v2-ink" />
              <button
                type="button"
                onClick={signOut}
                className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors text-left"
              >
                <LogOut className="h-4 w-4" /> Logga ut
              </button>
            </MobileNavSheet>
          </div>
        </div>
      </header>

      <main className="relative max-w-[1100px] mx-auto px-6 sm:px-10 pt-14 sm:pt-20 pb-24">
        {/* Hero */}
        <div className="mb-12 sm:mb-16 v2-reveal">
          <h2 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-v2-ink leading-[1.05]">
            Dina{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 60%, #ec4899 100%)" }}
            >
              manus
            </span>
          </h2>
          <p className="text-v2-muted text-[17px] sm:text-[18px] mt-4 max-w-xl">
            Skapa, redigera och håll flyt — från första hälsning till sista applåd.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 mb-8 v2-reveal" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center gap-2 order-1 md:order-3 md:ml-auto" data-tour="library.new-button">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <button
                type="button"
                onClick={requestNew}
                className="v2-btn-primary"
                style={{ height: 44, padding: "0 20px", fontSize: 14 }}
              >
                <Plus className="h-4 w-4" /> Nytt manus
              </button>
              <button
                type="button"
                onClick={requestImport}
                className="inline-flex items-center justify-center h-11 px-5 rounded-full text-[14px] font-medium text-v2-ink bg-white border border-v2-line gap-1.5 transition-all hover:-translate-y-px hover:border-v2-violet/40 hover:shadow-md"
              >
                <Upload className="h-4 w-4" /> Importera
              </button>
              <DialogContent className="rounded-3xl border-v2-line">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-v2-ink">Nytt manus</DialogTitle>
                  <DialogDescription className="text-v2-muted">
                    Välj läge och ge manuset en titel.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] text-v2-muted font-medium">Läge</Label>
                    <div className="inline-flex w-full p-1 gap-1 rounded-full bg-v2-surface">
                      {(["speaker", "moderator"] as const).map((v) => {
                        const active = newMode === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setNewMode(v)}
                            className={`flex-1 inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                              active ? "bg-white text-v2-ink shadow-sm" : "text-v2-muted hover:text-v2-ink"
                            }`}
                          >
                            {v === "speaker" ? "Talare" : "Moderator"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t" className="text-[13px] text-v2-muted font-medium">Titel</Label>
                    <Input
                      id="t"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="t.ex. Keynote — Stockholm 25 nov"
                      className="h-11 rounded-xl bg-white border border-v2-line focus-visible:ring-2 focus-visible:ring-v2-violet"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenNew(false)} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-v2-surface">Avbryt</Button>
                  <button type="button" onClick={createNew} className="v2-btn-primary" style={{ height: 40 }}>Skapa</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative flex-1 min-w-[220px] md:max-w-md order-2 md:order-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-v2-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök titel eller tagg"
              className="pl-11 h-11 rounded-full bg-white border border-v2-line text-[14px] focus-visible:ring-2 focus-visible:ring-v2-violet placeholder:text-v2-muted"
            />
          </div>

          <div className="inline-flex p-1 gap-1 rounded-full bg-white border border-v2-line shadow-sm order-3 md:order-2">
            {filters.map(([v, label]) => {
              const active = filterMode === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilterMode(v)}
                  className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                    active ? "text-white shadow-sm" : "text-v2-muted hover:text-v2-ink"
                  }`}
                  style={active ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-v2-muted py-20">Laddar dina manus…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            {items.length === 0 ? (
              <>
                <div className="v2-card-icon mx-auto" style={{ width: 56, height: 56, borderRadius: 16, marginBottom: 20 }}>
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="font-display text-[22px] font-semibold tracking-tight text-v2-ink mb-2">Du har inga manus än</p>
                <p className="text-[15px] text-v2-muted mb-6">Skapa ditt första manus för att komma igång.</p>
                <button
                  type="button"
                  className="v2-btn-primary"
                  onClick={() => setOpenNew(true)}
                  style={{ height: 44, padding: "0 22px" }}
                >
                  <Plus className="h-4 w-4" /> Skapa ditt första
                </button>
              </>
            ) : (
              <p className="text-v2-muted text-[15px]">Inga manus matchar din sökning.</p>
            )}
          </div>
        ) : (
          <>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="sticky top-14 z-40 -mx-6 sm:-mx-10 px-6 sm:px-10 py-3 mb-5 bg-white/85 backdrop-blur-xl border-b border-v2-line flex items-center gap-2 md:gap-3 flex-nowrap animate-fade-in">
                <span className="text-[14px] font-medium inline-flex items-center gap-1.5 flex-shrink-0 text-v2-ink">
                  <span
                    className="md:hidden inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-white text-[12px] font-semibold"
                    style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}
                  >
                    {selectedIds.size}
                  </span>
                  <span className="md:hidden">valda</span>
                  <span className="hidden md:inline">
                    {selectedIds.size} markerad{selectedIds.size === 1 ? "" : "e"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-[13px] text-v2-violet hover:underline flex-shrink-0"
                >
                  <span className="md:hidden">Alla</span>
                  <span className="hidden md:inline">Markera alla synliga ({filtered.length})</span>
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Avmarkera"
                  className="text-[13px] text-v2-muted hover:text-v2-ink inline-flex items-center justify-center gap-1 flex-shrink-0 h-9 w-9 md:w-auto md:h-auto rounded-full md:rounded-none border border-v2-line md:border-0"
                >
                  <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  <span className="hidden md:inline">Avmarkera</span>
                </button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                  aria-label="Radera markerade"
                  className="ml-auto rounded-full h-9 w-9 md:w-auto md:px-4 md:gap-1.5 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  <span className="hidden md:inline text-[13px]">Radera markerade</span>
                </Button>
              </div>
            )}

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5 v2-stagger-parent is-visible">
              {filtered.map((m) => {
                const isExample = (m.tags ?? []).includes(EXAMPLE_TAG);
                const isSelected = selectedIds.has(m.id);
                const selectionMode = selectedIds.size > 0;
                const isModerator = m.mode === "moderator";
                return (
                  <li
                    key={m.id}
                    data-tour={isExample ? "library.example-card" : undefined}
                    className={`group v2-card relative overflow-hidden ${isSelected ? "ring-2 ring-v2-violet" : ""}`}
                    style={{ padding: 0 }}
                  >
                    {/* Subtil gradient-accent uppe i kortet */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundImage: "linear-gradient(90deg, #6366f1, #3b82f6, #ec4899)" }}
                    />
                    <div className="flex items-stretch">
                      <button
                        onClick={() => {
                          if (selectionMode) {
                            toggleSelect(m.id);
                          } else {
                            navigate(`/manus/${m.id}`);
                          }
                        }}
                        className="flex-1 text-left pl-6 pr-3 py-6 min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                              isModerator
                                ? "text-v2-violet"
                                : "text-v2-blue"
                            }`}
                            style={{
                              background: isModerator
                                ? "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(59,130,246,0.10))"
                                : "linear-gradient(135deg, rgba(59,130,246,0.10), rgba(14,165,233,0.10))",
                              border: `1px solid ${isModerator ? "rgba(99,102,241,0.22)" : "rgba(59,130,246,0.22)"}`,
                            }}
                          >
                            <FileText className="h-3 w-3" />
                            {isModerator ? "Moderator" : "Talare"}
                          </span>
                          {isExample && (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--cue-amber))]/12 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/35 uppercase tracking-wide">
                              <Sparkles className="h-3 w-3" /> Exempel
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-[22px] font-semibold tracking-tight text-v2-ink truncate group-hover:text-v2-violet transition-colors">
                          {m.title}
                        </h3>
                        <p className="text-[13px] text-v2-muted mt-2">
                          Uppdaterad {new Date(m.updated_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </button>
                      <div className="flex flex-col items-center justify-between py-3 pr-3 gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full text-v2-muted hover:bg-v2-surface hover:text-v2-violet h-9 w-9"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-v2-line">
                            <DropdownMenuItem onClick={() => duplicate(m)}>Duplicera</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRenameId(m.id); setRenameValue(m.title); }}>Byt namn</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => remove(m)} className="text-destructive">Radera</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleSelect(m.id); }}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggleSelect(m.id);
                            }
                          }}
                          aria-label={isSelected ? "Avmarkera manus" : "Markera manus"}
                          className={`flex items-center justify-center h-9 w-9 rounded-full cursor-pointer transition-opacity ${
                            selectionMode || isSelected
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="h-5 w-5 pointer-events-none"
                            tabIndex={-1}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="rounded-3xl border-v2-line">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-v2-ink">Byt namn</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-11 rounded-xl bg-white border border-v2-line focus-visible:ring-2 focus-visible:ring-v2-violet"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)} className="rounded-full text-v2-muted hover:text-v2-ink hover:bg-v2-surface">Avbryt</Button>
            <button type="button" onClick={renameSubmit} className="v2-btn-primary" style={{ height: 40 }}>Spara</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-3xl border-v2-line">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-semibold tracking-tight text-v2-ink">
              Radera {selectedIds.size} manus?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-v2-muted">
              Detta tar bort de markerade manuset och alla deras kort permanent. Det går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={bulkDeleting}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void bulkDelete(); }}
              disabled={bulkDeleting}
              className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {bulkDeleting ? "Raderar…" : "Radera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={upgradeReason?.title}
        description={upgradeReason?.description}
      />

      {user && (
        <OnboardingModal
          open={needsOnboarding}
          userId={user.id}
          onComplete={() => setNeedsOnboarding(false)}
        />
      )}
      <WelcomeAfterSignupModal
        open={!!welcomeEmail && !needsOnboarding}
        email={welcomeEmail}
        onClose={dismissWelcome}
      />
      <PWAInstallPrompt />
    </div>
    </>
  );
}
