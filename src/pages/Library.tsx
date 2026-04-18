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
import { MoreHorizontal, Plus, Search, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

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
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
    // Skapa ett första tomt kort
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

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="topbar-blur sticky top-0 z-50 border-b-hair-strong px-8 py-3 flex items-center gap-6">
        <h1 className="font-serif text-[15px] tracking-tight font-medium">
          Manuskort <span className="italic font-light text-muted-foreground">— bibliotek</span>
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-faint hidden sm:inline">
            {user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} className="font-mono text-[11px] uppercase tracking-widest">
            <LogOut className="h-3.5 w-3.5" /> Logga ut
          </Button>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-8 py-10">
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök titel eller tagg…"
              className="pl-9 bg-surface border-hair-strong font-serif"
            />
          </div>

          <div className="flex font-mono text-[11px] uppercase tracking-widest">
            {(["all", "moderator", "speaker"] as const).map((v, i, a) => (
              <button
                key={v}
                onClick={() => setFilterMode(v)}
                className={`px-3 py-2 border-hair-strong transition-colors ${
                  filterMode === v ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-surface-2"
                } ${i === 0 ? "rounded-l-md" : ""} ${i === a.length - 1 ? "rounded-r-md" : ""}`}
              >
                {v === "all" ? "Alla" : v === "moderator" ? "Moderator" : "Talare"}
              </button>
            ))}
          </div>

          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs uppercase tracking-widest gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nytt manus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Nytt manus</DialogTitle>
                <DialogDescription className="font-serif italic text-faint">
                  Välj läge och ge manuset en titel.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-[11px] uppercase tracking-widest text-faint">Läge</Label>
                  <div className="flex font-mono text-xs">
                    {(["speaker", "moderator"] as const).map((v, i, a) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setNewMode(v)}
                        className={`flex-1 px-3 py-2 border-hair-strong transition-colors ${
                          newMode === v ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-surface-2"
                        } ${i === 0 ? "rounded-l-md" : ""} ${i === a.length - 1 ? "rounded-r-md" : ""}`}
                      >
                        {v === "speaker" ? "Talare" : "Moderator"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t" className="font-mono text-[11px] uppercase tracking-widest text-faint">Titel</Label>
                  <Input id="t" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="t.ex. Keynote — Stockholm 25 nov" className="font-serif" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenNew(false)} className="font-mono text-xs uppercase">Avbryt</Button>
                <Button onClick={createNew} className="font-mono text-xs uppercase">Skapa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-center font-serif italic text-faint py-20">Laddar dina manus…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 font-serif italic text-faint">
            {items.length === 0 ? (
              <>Du har inga manus än. <button className="underline not-italic" onClick={() => setOpenNew(true)}>Skapa ditt första</button>.</>
            ) : (
              <>Inga manus matchar din sökning.</>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((m) => (
              <li key={m.id} className="bg-surface border-hair-strong rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex items-stretch">
                  <button
                    onClick={() => navigate(`/manus/${m.id}`)}
                    className="flex-1 text-left px-5 py-4 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-[17px] truncate">{m.title}</h3>
                      <div className="flex gap-3 items-center mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">
                        <span>{m.mode === "moderator" ? "Moderator" : "Talare"}</span>
                        <span>·</span>
                        <span>Uppdaterad {new Date(m.updated_at).toLocaleDateString("sv-SE")}</span>
                      </div>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="mr-2 my-auto text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-mono text-xs">
                      <DropdownMenuItem onClick={() => duplicate(m)}>Duplicera</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setRenameId(m.id); setRenameValue(m.title); }}>Byt namn</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => remove(m)} className="text-destructive">Radera</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Byt namn</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="font-serif" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)} className="font-mono text-xs uppercase">Avbryt</Button>
            <Button onClick={renameSubmit} className="font-mono text-xs uppercase">Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
