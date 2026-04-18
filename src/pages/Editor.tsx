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
import { PanelistSidebar } from "@/components/editor/PanelistSidebar";
import { PrintDialog } from "@/components/editor/PrintDialog";
import { PanelistsProvider } from "@/hooks/usePanelists";
import { useAutosave } from "@/hooks/useAutosave";
import { ArrowLeft, Plus, Printer, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { nextStartFromEnd } from "@/lib/timeChain";
import { splitHtmlInHalf } from "@/lib/cardLimits";
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
  const [panelistSidebarOpen, setPanelistSidebarOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  // Kort-id:n vars starttid användaren har redigerat manuellt — dessa skyddas från auto-kedjan
  const [manualStartIds, setManualStartIds] = useState<Set<string>>(new Set());
  // Kort som överskrider sin radgräns — blockerar utskrift
  const [overflowingCardIds, setOverflowingCardIds] = useState<Set<string>>(new Set());

  const handleOverflowChange = (cardId: string, isOver: boolean) => {
    setOverflowingCardIds((prev) => {
      const has = prev.has(cardId);
      if (isOver === has) return prev;
      const next = new Set(prev);
      if (isOver) next.add(cardId); else next.delete(cardId);
      return next;
    });
  };

  const meta = useMemo(() => {
    if (!manuscript) return null;
    return {
      title: manuscript.title,
      mode: manuscript.mode,
      text_size: manuscript.text_size,
      show_notes: manuscript.show_notes,
      show_times: manuscript.show_times,
      wpm: manuscript.wpm,
      time_format: manuscript.time_format,
    };
  }, [manuscript]);

  const timeFormat = (manuscript?.time_format === "elapsed" ? "elapsed" : "clock") as "clock" | "elapsed";

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
    // Markera nästa korts starttid som "manuellt redigerad" om användaren ändrar den direkt
    if (Object.prototype.hasOwnProperty.call(patch, "start_time")) {
      setManualStartIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    }
    setCards((prev) => {
      const next = prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c));
      // Kedja: om sluttid ändrats, sätt nästa korts starttid till sluttid + 1 sek
      // — men bara om användaren inte själv har redigerat den starttiden manuellt
      if (Object.prototype.hasOwnProperty.call(patch, "end_time")) {
        const idx = next.findIndex((c) => c.id === cardId);
        if (idx !== -1 && idx < next.length - 1) {
          const nextCard = next[idx + 1];
          if (!manualStartIds.has(nextCard.id)) {
            const chained = nextStartFromEnd(next[idx].end_time ?? "", timeFormat);
            if (chained !== null) {
              next[idx + 1] = { ...nextCard, start_time: chained };
            }
          }
        }
      }
      return next;
    });
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

  const handlePasteOverflow = async (cardId: string, overflowText: string) => {
    if (!user || !manuscript || !overflowText) return;
    const src = cards.find((c) => c.id === cardId);
    if (!src) return;
    const idx = cards.findIndex((c) => c.id === cardId);
    const escaped = overflowText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
    const { data, error } = await supabase
      .from("cards")
      .insert({
        manuscript_id: manuscript.id,
        user_id: user.id,
        position: idx + 1,
        role: src.role,
        content_html: html,
      })
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Kunde inte dela kortet", description: error?.message, variant: "destructive" });
      return;
    }
    const next = [...cards];
    next.splice(idx + 1, 0, data);
    const renum = next.map((c, i) => ({ ...c, position: i }));
    setCards(renum);
    await persistPositions(renum);
    toast({ title: "Texten delades på 2 kort", description: "Överskottet flyttades till ett nytt kort." });
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

  const syncWithPrevious = (cardId: string) => {
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx <= 0) return;
    const prev = cards[idx - 1];
    const chained = nextStartFromEnd(prev.end_time ?? "", timeFormat);
    if (chained === null) {
      const example = timeFormat === "clock" ? "14:30" : "02:30";
      toast({ title: "Kan inte synka", description: `Föregående kort saknar giltig sluttid (t.ex. ${example}).` });
      return;
    }
    setCards((list) => list.map((c) => (c.id === cardId ? { ...c, start_time: chained } : c)));
    setManualStartIds((prev) => {
      if (!prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  };

  if (loading || !manuscript) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[14px] text-muted-foreground">Laddar manus…</p>
      </div>
    );
  }

  const sizes: ("sm" | "md" | "lg")[] = ["sm", "md", "lg"];
  const sizeLabels: Record<string, string> = { sm: "Liten", md: "Normal", lg: "Stor" };

  const isModerator = manuscript.mode === "moderator";

  return (
    <PanelistsProvider manuscriptId={manuscript.id}>
    <div className="min-h-screen">
      {/* Sticky topbar-grupp: huvudrad + (villkorlig) tidsformat-rad */}
      <div className="topbar-blur sticky top-0 z-50 border-b-hair">
        <header className="px-5 sm:px-8 min-h-14 py-2 flex items-center gap-5 flex-wrap">
        <Link
          to="/"
          className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label="Tillbaka till bibliotek"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <input
            value={manuscript.title}
            onChange={(e) => updateMeta({ title: e.target.value })}
            className="font-display text-[17px] font-semibold tracking-tight bg-transparent border-0 outline-none min-w-[120px] max-w-[280px]"
          />
          <span className="text-[13px] text-muted-foreground hidden sm:inline">
            · {manuscript.mode === "moderator" ? "moderator" : "talare"}
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <SaveIndicator />

          <div className="seg-group">
            {sizes.map((s) => (
              <button
                key={s}
                data-active={manuscript.text_size === s}
                onClick={() => updateMeta({ text_size: s })}
                className="seg-btn"
              >
                {sizeLabels[s]}
              </button>
            ))}
          </div>

          <div className="seg-group">
            <button
              data-active={manuscript.show_notes}
              onClick={() => updateMeta({ show_notes: !manuscript.show_notes })}
              className="seg-btn"
            >
              Anteckningar
            </button>
            <button
              data-active={manuscript.show_times}
              onClick={() => updateMeta({ show_times: !manuscript.show_times })}
              className="seg-btn"
            >
              Tider
            </button>
          </div>

          {isModerator && (
            <Button
              variant="ghost"
              onClick={() => setPanelistSidebarOpen(true)}
              className="h-9 rounded-full px-3.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 text-[13px] gap-1.5"
            >
              <Users className="h-3.5 w-3.5" /> Deltagare
            </Button>
          )}

          <Button
            onClick={addCard}
            className="h-9 rounded-full px-4 bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] font-medium gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Nytt kort
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPrintDialogOpen(true)}
            className="h-9 rounded-full px-3.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 text-[13px] gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> Skriv ut
          </Button>
        </div>
        </header>

        {/* Sekundär rad: tidsformat-toggle, visas bara när Tider är på */}
        {manuscript.show_times && (
          <div className="border-t-hair px-5 sm:px-8 py-2.5 flex items-center gap-3 flex-wrap justify-end">
            <span className="text-[12px] text-muted-foreground">
              Ska tiderna visa klockslag eller förfluten tid?
            </span>
            <div className="seg-group">
              <button
                data-active={timeFormat === "clock"}
                onClick={() => updateMeta({ time_format: "clock" })}
                className="seg-btn"
                title="Klockslag på dygnet (HH:MM)"
              >
                Klockslag
              </button>
              <button
                data-active={timeFormat === "elapsed"}
                onClick={() => updateMeta({ time_format: "elapsed" })}
                className="seg-btn"
                title="Förfluten tid från programmets start (MM:SS)"
              >
                Förfluten
              </button>
            </div>
          </div>
        )}
      </div>

      <main className="max-w-[920px] mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 flex flex-col gap-6">
        {/* Legend */}
        <div className="flex gap-2 flex-wrap">
          <span className="cue-pill cue-pill-red">
            <span className="cue-dot cue-red" /> Paus / bromsa
          </span>
          <span className="cue-pill cue-pill-amber">
            <span className="cue-dot cue-amber" /> Avslutningssignal
          </span>
          <span className="cue-pill cue-pill-teal">
            <span className="cue-dot cue-teal" /> Överlämning / nästa talare
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-[17px] mb-3">Inga kort än.</p>
            <button className="text-accent-blue hover:underline font-medium" onClick={addCard}>
              Lägg till ditt första kort
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-5">
                {cards.map((c, idx) => (
                  <ManusCard
                    key={c.id}
                    card={c}
                    number={idx + 1}
                    textSize={manuscript.text_size as "sm" | "md" | "lg"}
                    showNotes={manuscript.show_notes}
                    showTimes={manuscript.show_times}
                    wpm={manuscript.wpm}
                    timeFormat={timeFormat}
                    isModerator={isModerator}
                    canSyncWithPrevious={idx > 0}
                    onLocalChange={(patch) => updateCard(c.id, patch)}
                    onDelete={() => deleteCard(c.id)}
                    onDuplicate={() => duplicateCard(c.id)}
                    onSplit={() => splitCard(c.id)}
                    onMergeUp={() => mergeUp(c.id)}
                    onSyncWithPrevious={() => syncWithPrevious(c.id)}
                    onPasteOverflow={(text) => handlePasteOverflow(c.id, text)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {isModerator && (
        <PanelistSidebar
          open={panelistSidebarOpen}
          onClose={() => setPanelistSidebarOpen(false)}
        />
      )}

      <PrintDialog open={printDialogOpen} onOpenChange={setPrintDialogOpen} />
    </div>
    </PanelistsProvider>
  );
}
