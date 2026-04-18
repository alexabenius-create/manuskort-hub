import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ManusCard } from "@/components/editor/ManusCard";
import { SaveIndicator } from "@/components/SaveIndicator";
import { useAutosave } from "@/hooks/useAutosave";
import { ArrowLeft, Plus, Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  // Manus-metadata för autosave
  const meta = useMemo(() => {
    if (!manuscript) return null;
    return {
      title: manuscript.title,
      mode: manuscript.mode,
      text_size: manuscript.text_size,
      show_notes: manuscript.show_notes,
      show_times: manuscript.show_times,
      wpm: manuscript.wpm,
    };
  }, [manuscript]);

  useAutosave({
    table: "manuscripts",
    id: id ?? "",
    data: meta ?? {},
    enabled: !!meta && !!id,
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        supabase.from("manuscripts").select("*").eq("id", id).maybeSingle(),
        supabase.from("cards").select("*").eq("manuscript_id", id).order("position"),
      ]);
      if (mRes.error || !mRes.data) {
        toast({ title: "Hittade inte manuset", description: mRes.error?.message, variant: "destructive" });
        navigate("/");
        return;
      }
      setManuscript(mRes.data);
      setCards(cRes.data ?? []);
      setLoading(false);
    })();
  }, [id, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateCard = (cardId: string, patch: Partial<Card>) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
  };

  const updateMeta = (patch: Partial<Manuscript>) => {
    setManuscript((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const addCard = async () => {
    if (!user || !manuscript) return;
    const position = cards.length;
    const { data, error } = await supabase
      .from("cards")
      .insert({
        manuscript_id: manuscript.id,
        user_id: user.id,
        position,
        role: manuscript.mode,
      })
      .select()
      .single();
    if (error || !data) { toast({ title: "Kunde inte lägga till kort", description: error?.message, variant: "destructive" }); return; }
    setCards((prev) => [...prev, data]);
  };

  const deleteCard = async (cardId: string) => {
    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    if (error) { toast({ title: "Misslyckades", description: error.message, variant: "destructive" }); return; }
    setCards((prev) => prev.filter((c) => c.id !== cardId).map((c, i) => ({ ...c, position: i })));
  };

  const duplicateCard = async (cardId: string) => {
    if (!user || !manuscript) return;
    const src = cards.find((c) => c.id === cardId);
    if (!src) return;
    const idx = cards.findIndex((c) => c.id === cardId);
    const { data, error } = await supabase
      .from("cards")
      .insert({
        manuscript_id: manuscript.id,
        user_id: user.id,
        position: idx + 1,
        role: src.role,
        title: src.title ? src.title + " (kopia)" : "",
        content_html: src.content_html,
        notes: src.notes,
        cue_red: src.cue_red,
        cue_amber: src.cue_amber,
        cue_teal: src.cue_teal,
      })
      .select()
      .single();
    if (error || !data) { toast({ title: "Misslyckades", description: error?.message, variant: "destructive" }); return; }
    const next = [...cards];
    next.splice(idx + 1, 0, data);
    // Renumrera
    const renum = next.map((c, i) => ({ ...c, position: i }));
    setCards(renum);
    await persistPositions(renum);
  };

  const splitCard = async (cardId: string) => {
    if (!user || !manuscript) return;
    const src = cards.find((c) => c.id === cardId);
    if (!src) return;
    const idx = cards.findIndex((c) => c.id === cardId);
    const { data, error } = await supabase
      .from("cards")
      .insert({
        manuscript_id: manuscript.id,
        user_id: user.id,
        position: idx + 1,
        role: src.role,
      })
      .select()
      .single();
    if (error || !data) return;
    const next = [...cards];
    next.splice(idx + 1, 0, data);
    const renum = next.map((c, i) => ({ ...c, position: i }));
    setCards(renum);
    await persistPositions(renum);
  };

  const mergeUp = (cardId: string) => {
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx <= 0) return;
    const prev = cards[idx - 1];
    const cur = cards[idx];
    const mergedHtml = (prev.content_html ?? "") + (cur.content_html ?? "");
    const mergedNotes = [prev.notes, cur.notes].filter(Boolean).join("\n");
    updateCard(prev.id, { content_html: mergedHtml, notes: mergedNotes });
    void deleteCard(cur.id);
  };

  const persistPositions = async (list: Card[]) => {
    // Bulk-uppdatera positions efter dnd
    await Promise.all(
      list.map((c, i) =>
        supabase.from("cards").update({ position: i }).eq("id", c.id)
      )
    );
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = cards.findIndex((c) => c.id === active.id);
    const newIdx = cards.findIndex((c) => c.id === over.id);
    const next = arrayMove(cards, oldIdx, newIdx).map((c, i) => ({ ...c, position: i }));
    setCards(next);
    await persistPositions(next);
  };

  if (loading || !manuscript) {
    return <div className="min-h-screen flex items-center justify-center"><p className="font-mono text-xs text-faint uppercase tracking-widest">Laddar manus…</p></div>;
  }

  const sizes: ("sm" | "md" | "lg")[] = ["sm", "md", "lg"];
  const sizeLabels: Record<string, string> = { sm: "Liten", md: "Normal", lg: "Stor" };

  return (
    <div className="min-h-screen">
      {/* Topbar enligt dummy */}
      <header className="topbar-blur sticky top-0 z-50 border-b-hair-strong px-8 py-3 flex items-center gap-6 flex-wrap">
        <Link to="/" className="text-faint hover:text-foreground" aria-label="Tillbaka till bibliotek">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-serif text-[15px] tracking-tight font-medium">
          <input
            value={manuscript.title}
            onChange={(e) => updateMeta({ title: e.target.value })}
            className="bg-transparent border-0 outline-none w-auto min-w-[120px] font-medium"
          />
          <span className="italic font-light text-muted-foreground">
            {" "}— {manuscript.mode === "moderator" ? "moderator" : "talare"}
          </span>
        </h1>

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          <SaveIndicator />

          <CtrlGroup label="Text">
            {sizes.map((s) => (
              <CtrlBtn key={s} active={manuscript.text_size === s} onClick={() => updateMeta({ text_size: s })}>
                {sizeLabels[s]}
              </CtrlBtn>
            ))}
          </CtrlGroup>

          <div className="w-px h-7 bg-border" />

          <CtrlGroup label="Anteckningar">
            <CtrlBtn active={manuscript.show_notes} onClick={() => updateMeta({ show_notes: !manuscript.show_notes })}>
              {manuscript.show_notes ? "Visa" : "Dold"}
            </CtrlBtn>
          </CtrlGroup>

          <CtrlGroup label="Tid">
            <CtrlBtn active={manuscript.show_times} onClick={() => updateMeta({ show_times: !manuscript.show_times })}>
              {manuscript.show_times ? "Visa" : "Dold"}
            </CtrlBtn>
          </CtrlGroup>

          <div className="w-px h-7 bg-border" />

          <Button onClick={addCard} className="font-mono text-xs uppercase tracking-widest gap-1.5 h-8">
            <Plus className="h-3 w-3" /> Nytt kort
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="font-mono text-xs uppercase tracking-widest gap-1.5 h-8">
            <Printer className="h-3 w-3" /> Skriv ut
          </Button>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-8 py-10 pb-20 flex flex-col gap-6">
        {/* Legend */}
        <div className="flex gap-5 flex-wrap p-3 px-4 bg-surface border-hair rounded-[10px]">
          <Legend color="red" text="Paus / bromsa" />
          <Legend color="amber" text="Avslutningssignal" />
          <Legend color="teal" text="Överlämning / nästa talare" />
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-16 font-serif italic text-faint">
            Inga kort än. <button className="underline not-italic" onClick={addCard}>Lägg till ditt första kort</button>.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-6">
                {cards.map((c, idx) => (
                  <ManusCard
                    key={c.id}
                    card={c}
                    number={idx + 1}
                    textSize={manuscript.text_size as "sm" | "md" | "lg"}
                    showNotes={manuscript.show_notes}
                    showTimes={manuscript.show_times}
                    wpm={manuscript.wpm}
                    onLocalChange={(patch) => updateCard(c.id, patch)}
                    onDelete={() => deleteCard(c.id)}
                    onDuplicate={() => duplicateCard(c.id)}
                    onSplit={() => splitCard(c.id)}
                    onMergeUp={() => mergeUp(c.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}

function CtrlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-px items-center">
      <span className="font-mono text-[11px] text-faint mr-1.5 uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}

function CtrlBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs px-3 py-[5px] border-hair-strong transition-colors first:rounded-l-md last:rounded-r-md only:rounded-md ${
        active ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, text }: { color: "red" | "amber" | "teal"; text: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span className={`cue-dot cue-${color}`} aria-hidden />
      {text}
    </div>
  );
}
