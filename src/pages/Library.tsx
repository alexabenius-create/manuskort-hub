import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Search, LogOut, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { EXAMPLE_TAG } from "@/lib/exampleManuscript";
import { seedExampleForUser, hasBeenSeeded, markAsSeeded } from "@/lib/seedExampleManuscript";
import { useTourTrigger } from "@/hooks/useTour";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];

export default function Library() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "moderator" | "speaker">("all");

  const [openNew, setOpenNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<"moderator" | "speaker">("speaker");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="topbar-blur sticky top-0 z-50 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-6">
        <h1 className="font-display text-[17px] font-semibold tracking-tight">Manuskort</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground hidden sm:inline">
            {user?.email}
          </span>
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
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök titel eller tagg"
              className="pl-11 h-11 rounded-full bg-surface-2 border-0 text-[14px] focus-visible:ring-2 focus-visible:ring-accent-blue"
            />
          </div>

          <div className="seg-group">
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

          <div className="ml-auto">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button
                  data-tour="library.new-button"
                  className="h-11 rounded-full px-5 bg-accent-blue hover:bg-accent-blue/90 text-white text-[14px] font-medium gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Nytt manus
                </Button>
              </DialogTrigger>
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
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((m) => {
              const isExample = (m.tags ?? []).includes(EXAMPLE_TAG);
              return (
              <li
                key={m.id}
                data-tour={isExample ? "library.example-card" : undefined}
                className="group bg-surface rounded-2xl shadow-card hover:shadow-pop transition-shadow duration-200 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <button
                    onClick={() => navigate(`/manus/${m.id}`)}
                    className="flex-1 text-left px-6 py-5 min-w-0"
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
                  <div className="flex items-center pr-3">
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
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
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
    </div>
  );
}
