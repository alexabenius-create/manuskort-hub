import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Search, LogOut, Sparkles, Settings as SettingsIcon, Upload, Shield, Sparkle, Trash2, X } from "lucide-react";
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
import { LIMITS, TIER_LABEL } from "@/lib/tierLimits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { OnboardingModal } from "@/components/OnboardingModal";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];

export default function Library() {
  const { user, signOut } = useAuth();
  const { tier } = useTier();
  const limits = LIMITS[tier];
  const navigate = useNavigate();
  const [items, setItems] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "moderator" | "speaker">("all");
  const [dragOver, setDragOver] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<{ title: string; description: string } | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const [openNew, setOpenNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<"moderator" | "speaker">("speaker");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Multi-select för bulk-radering
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

    // Seed exempelmanus vid första besöket: om användaren har 0 manus och
    // inte tidigare seedats, skapa ett färdigt exempel åt dem.
    if (user && list.length === 0 && !hasBeenSeeded(user.id)) {
      markAsSeeded(user.id); // markera direkt så vi inte dubbel-seedar
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

  // Kontrollera om användaren behöver fylla i namn (första inloggning)
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

  // Trigger bibliotek-rundtur när biblioteket har laddats och exempelmanus finns renderat
  const exampleExists = items.some((m) => (m.tags ?? []).includes(EXAMPLE_TAG));
  useTourTrigger("bibliotek", !loading && exampleExists);

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
      className="min-h-screen relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.dataTransfer?.types?.includes("Files") && e.preventDefault()}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-accent-blue/10 backdrop-blur-sm pointer-events-none flex items-center justify-center">
          <div className="bg-surface rounded-2xl shadow-pop px-8 py-6 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-accent-blue" />
            <p className="font-display text-[18px] font-semibold">Släpp för att importera</p>
            <p className="text-[13px] text-muted-foreground mt-1">.docx eller .txt</p>
          </div>
        </div>
      )}
      {/* Topbar */}
      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-6">
        <Link to="/" className="font-display text-[17px] font-semibold tracking-tight hover:opacity-70 transition-opacity" aria-label="Till startsidan">
          <h1>Manuskort</h1>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {/* Desktop / tablet — full topbar */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground hidden sm:inline-flex items-center gap-2">
              {user?.email}
              {(tier === "pro" || tier === "admin") && (
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                    tier === "admin"
                      ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40"
                      : "bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/30"
                  }`}
                >
                  {TIER_LABEL[tier]}
                </span>
              )}
            </span>
            {tier === "free" && (
              <Button
                asChild
                size="sm"
                className="rounded-full text-[13px] h-8 bg-accent-blue hover:bg-accent-blue/90 text-white"
              >
                <Link to="/priser"><Sparkle className="h-3.5 w-3.5" /> Uppgradera</Link>
              </Button>
            )}
            {tier === "admin" && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 h-8"
              >
                <a href="/admin"><Shield className="h-3.5 w-3.5" /> Admin</a>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 h-8"
            >
              <a href="/installningar"><SettingsIcon className="h-3.5 w-3.5" /> Inställningar</a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 h-8"
            >
              <LogOut className="h-3.5 w-3.5" /> Logga ut
            </Button>
            <HelpButton />
          </div>

          {/* Mobil — hjälp + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <HelpButton />
            <MobileNavSheet title="Konto">
              <span className="px-3 pb-2 text-[12px] text-muted-foreground break-all">
                {user?.email}
                {(tier === "pro" || tier === "admin") && (
                  <span
                    className={`ml-2 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide align-middle ${
                      tier === "admin"
                        ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40"
                        : "bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/30"
                    }`}
                  >
                    {TIER_LABEL[tier]}
                  </span>
                )}
              </span>
              {tier === "free" && (
                <Link
                  to="/priser"
                  className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-accent-blue hover:bg-surface-2 transition-colors"
                >
                  <Sparkle className="h-4 w-4" /> Uppgradera
                </Link>
              )}
              {tier === "admin" && (
                <a
                  href="/admin"
                  className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-foreground hover:bg-surface-2 transition-colors"
                >
                  <Shield className="h-4 w-4" /> Admin
                </a>
              )}
              <a
                href="/installningar"
                className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-foreground hover:bg-surface-2 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" /> Inställningar
              </a>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex h-11 items-center gap-2 px-3 rounded-xl text-[15px] text-foreground hover:bg-surface-2 transition-colors text-left"
              >
                <LogOut className="h-4 w-4" /> Logga ut
              </button>
            </MobileNavSheet>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-12 sm:pt-16 pb-20">
        {/* Hero */}
        <div className="mb-10 sm:mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            Dina manus
          </h2>
          <p className="text-muted-foreground text-[17px] mt-3">
            Skapa, redigera och håll flyt — från första hälsning till sista applåd.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 mb-8">
          {/* Mobil: actions först (Nytt manus vänster, Importera höger). Desktop: ml-auto via md:order. */}
          <div className="flex items-center gap-2 order-1 md:order-3 md:ml-auto" data-tour="library.new-button">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <Button
                onClick={requestNew}
                className="h-11 rounded-full px-5 bg-accent-blue hover:bg-accent-blue/90 text-white text-[14px] font-medium gap-1.5"
              >
                <Plus className="h-4 w-4" /> Nytt manus
              </Button>
              <Button
                variant="ghost"
                onClick={requestImport}
                className="h-11 rounded-full px-4 text-[14px] font-medium gap-1.5 hover:bg-surface-2"
              >
                <Upload className="h-4 w-4" /> Importera
              </Button>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-semibold">Nytt manus</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Välj läge och ge manuset en titel.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] text-muted-foreground font-medium">Läge</Label>
                    <div className="seg-group w-full">
                      {(["speaker", "moderator"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNewMode(v)}
                          data-active={newMode === v}
                          className="seg-btn flex-1"
                        >
                          {v === "speaker" ? "Talare" : "Moderator"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t" className="text-[13px] text-muted-foreground font-medium">Titel</Label>
                    <Input
                      id="t"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="t.ex. Keynote — Stockholm 25 nov"
                      className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenNew(false)} className="rounded-full">Avbryt</Button>
                  <Button onClick={createNew} className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white">Skapa</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative flex-1 min-w-[220px] md:max-w-md order-2 md:order-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök titel eller tagg"
              className="pl-11 h-11 rounded-full bg-surface-2 border-0 text-[14px] focus-visible:ring-2 focus-visible:ring-accent-blue"
            />
          </div>

          <div className="seg-group order-3 md:order-2">
            {filters.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilterMode(v)}
                data-active={filterMode === v}
                className="seg-btn"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-20">Laddar dina manus…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            {items.length === 0 ? (
              <>
                <p className="text-[17px] mb-3">Du har inga manus än.</p>
                <button
                  className="text-accent-blue hover:underline font-medium"
                  onClick={() => setOpenNew(true)}
                >
                  Skapa ditt första
                </button>
              </>
            ) : (
              <>Inga manus matchar din sökning.</>
            )}
          </div>
        ) : (
          <>
            {/* Bulk action bar — visas när minst ett kort är markerat */}
            {selectedIds.size > 0 && (
              <div className="sticky top-14 z-40 -mx-6 sm:-mx-10 px-6 sm:px-10 py-3 mb-5 bg-surface/95 backdrop-blur border-b-hair flex items-center gap-2 md:gap-3 flex-nowrap animate-fade-in">
                <span className="text-[14px] font-medium inline-flex items-center gap-1.5 flex-shrink-0">
                  <span className="md:hidden inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-accent-blue text-white text-[12px] font-semibold">
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
                  className="text-[13px] text-accent-blue hover:underline flex-shrink-0"
                >
                  <span className="md:hidden">Alla</span>
                  <span className="hidden md:inline">Markera alla synliga ({filtered.length})</span>
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Avmarkera"
                  className="text-[13px] text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 flex-shrink-0 h-9 w-9 md:w-auto md:h-auto rounded-full md:rounded-none border border-border md:border-0"
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

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((m) => {
                const isExample = (m.tags ?? []).includes(EXAMPLE_TAG);
                const isSelected = selectedIds.has(m.id);
                const selectionMode = selectedIds.size > 0;
                return (
                <li
                  key={m.id}
                  data-tour={isExample ? "library.example-card" : undefined}
                  className={`group bg-surface rounded-2xl shadow-card hover:shadow-pop transition-all duration-200 overflow-hidden ${
                    isSelected ? "ring-2 ring-accent-blue" : ""
                  }`}
                >
                  <div className="flex items-stretch">
                    <button
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelect(m.id);
                        } else {
                          navigate(`/manus/${m.id}`);
                        }
                      }}
                      className="flex-1 text-left pl-5 pr-3 py-5 min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
                            m.mode === "moderator"
                              ? "bg-accent-blue/10 text-accent-blue"
                              : "bg-cue-teal/10 text-[hsl(var(--cue-teal))]"
                          }`}
                        >
                          {m.mode === "moderator" ? "Moderator" : "Talare"}
                        </span>
                        {(m.tags ?? []).includes(EXAMPLE_TAG) && (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/40 uppercase tracking-wide">
                            <Sparkles className="h-3.5 w-3.5" /> Exempel
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-[20px] font-semibold tracking-tight truncate">{m.title}</h3>
                      <p className="text-[13px] text-muted-foreground mt-1.5">
                        Uppdaterad {new Date(m.updated_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </button>
                    {/* Höger kolumn: "..." högst upp, checkruta nedanför */}
                    <div className="flex flex-col items-center justify-between py-3 pr-3 gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground h-9 w-9"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
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
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold">Byt namn</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)} className="rounded-full">Avbryt</Button>
            <Button onClick={renameSubmit} className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white">Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-semibold">
              Radera {selectedIds.size} manus?
            </AlertDialogTitle>
            <AlertDialogDescription>
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
    </div>
    </>
  );
}
