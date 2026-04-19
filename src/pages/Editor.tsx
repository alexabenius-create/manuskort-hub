import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { ManusCard } from "@/components/editor/ManusCard";
import { ManusCardV2, type NotesPlacement } from "@/components/editor/ManusCardV2";
import { SaveIndicator } from "@/components/SaveIndicator";
import { PanelistSidebar } from "@/components/editor/PanelistSidebar";
import { PrintDialog } from "@/components/editor/PrintDialog";
import { TargetDurationDialog, formatTargetDuration } from "@/components/editor/TargetDurationDialog";
import { PanelistsProvider } from "@/hooks/usePanelists";
import { useAutosave } from "@/hooks/useAutosave";
import { ArrowLeft, Plus, Printer, Users, Play, Target, Settings2, Search } from "lucide-react";
import { HelpButton } from "@/components/HelpButton";
import { FindReplaceDialog } from "@/components/editor/FindReplaceDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { nextStartFromEnd } from "@/lib/timeChain";
import { wordCount, estimateSeconds } from "@/lib/wordCount";
import { splitHtmlAtRow, splitHtmlInHalf, MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";
import { useTourTrigger } from "@/hooks/useTour";
import { useTier } from "@/hooks/useTier";
import { LIMITS } from "@/lib/tierLimits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { EXAMPLE_TAG } from "@/lib/exampleManuscript";
import type { Database } from "@/integrations/supabase/types";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

type CardSnapshot = {
  id: string;
  content_html: string;
  position: number;
  isNew?: boolean; // true om kortet skapades under denna split
};
type SplitSnapshot = {
  affected: CardSnapshot[];
  createdIds: string[];
};

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier } = useTier();
  const limits = LIMITS[tier];
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelistSidebarOpen, setPanelistSidebarOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  // Layout-toggle (mockup): "ny" = ren V2-layout, "klassisk" = nuvarande
  const [layoutVariant, setLayoutVariant] = useState<"klassisk" | "ny">(() => {
    if (typeof window === "undefined") return "ny";
    return (localStorage.getItem("editor.layoutVariant") as "klassisk" | "ny") ?? "ny";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("editor.layoutVariant", layoutVariant);
  }, [layoutVariant]);
  const [notesPlacement, setNotesPlacement] = useState<NotesPlacement>(() => {
    if (typeof window === "undefined") return "side";
    return (localStorage.getItem("editor.notesPlacement") as NotesPlacement) ?? "side";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("editor.notesPlacement", notesPlacement);
  }, [notesPlacement]);
  // Visningsläge för anteckningar: "always" | "auto" | "hidden"
  // - always: panelen visas alltid (även tom)
  // - auto:   kollapsad bar när tom, expanderad när text finns (default)
  // - hidden: panelen visas aldrig
  const [notesDisplay, setNotesDisplay] = useState<"always" | "auto" | "hidden">(() => {
    if (typeof window === "undefined") return "auto";
    const v = localStorage.getItem("editor.notesDisplay");
    return v === "always" || v === "auto" || v === "hidden" ? v : "auto";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("editor.notesDisplay", notesDisplay);
  }, [notesDisplay]);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [targetDialogIntro, setTargetDialogIntro] = useState<string | undefined>(undefined);
  const [targetSaveLabel, setTargetSaveLabel] = useState<string>("Spara");
  // Kort-id:n vars starttid användaren har redigerat manuellt — dessa skyddas från auto-kedjan
  const [manualStartIds, setManualStartIds] = useState<Set<string>>(new Set());
  // Kort som överskrider sin radgräns — blockerar utskrift
  const [overflowingCardIds, setOverflowingCardIds] = useState<Set<string>>(new Set());
  // Refs till varje korts Tiptap-editor — används för att mäta visuella rader exakt vid auto-split
  const editorRefs = useRef<Map<string, TiptapEditorType>>(new Map());
  // Senaste auto-split snapshot för Ångra-funktion
  const lastSnapshotRef = useRef<SplitSnapshot | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);

  const handleEditorReady = (cardId: string, ed: TiptapEditorType | null) => {
    if (ed) editorRefs.current.set(cardId, ed);
    else editorRefs.current.delete(cardId);
  };

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
      target_duration_seconds: (manuscript as any).target_duration_seconds ?? null,
    };
  }, [manuscript]);

  const timeFormat = (manuscript?.time_format === "elapsed" ? "elapsed" : "clock") as "clock" | "elapsed";
  const targetDurationSeconds = (manuscript as any)?.target_duration_seconds ?? null;

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
        navigate("/bibliotek");
        return;
      }
      setManuscript(mRes.data);
      setCards(cRes.data ?? []);
      setLoading(false);
    })();
  }, [id, navigate]);

  // Blockera utskrift (Cmd/Ctrl+P, menyutskrift, programmatisk window.print)
  // när minst ett kort överskrider sin radgräns. Detta är en defense-in-depth
  // utöver att Skriv ut-knappen är disablad.
  useEffect(() => {
    const blocked = overflowingCardIds.size > 0;
    // Sätt CSS-flagga så print-arket blir tomt även om utskrift på något sätt körs
    if (blocked) document.documentElement.setAttribute("data-print-blocked", "true");
    else document.documentElement.removeAttribute("data-print-blocked");

    if (!blocked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
        toast({
          title: "Utskrift blockerad",
          description: `${overflowingCardIds.size} ${overflowingCardIds.size === 1 ? "kort är" : "kort är"} för långt. Korta ner texten eller använd "Dela kortet automatiskt".`,
          variant: "destructive",
        });
      }
    };
    const onBeforePrint = () => {
      toast({
        title: "Utskrift blockerad",
        description: "Ett eller flera kort överskrider radgränsen. Åtgärda dem först.",
        variant: "destructive",
      });
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("beforeprint", onBeforePrint);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true } as EventListenerOptions);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, [overflowingCardIds]);

  // Cmd/Ctrl+F öppnar Hitta & ersätt, Cmd/Ctrl+Enter startar presentation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setFindReplaceOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        startPresentationRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ref till startfunktionen så keyboard-handlern alltid har senaste closure
  const startPresentationRef = useRef<(() => void) | null>(null);

  // Trigger manus-rundturen när exempelmanuset är öppnat och korten är renderade
  const isExampleManuscript = !!manuscript && (manuscript.tags ?? []).includes(EXAMPLE_TAG);
  useTourTrigger("manus", isExampleManuscript && !loading && cards.length > 0);

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
    if (cards.length >= limits.cardsPerManuscript) {
      setUpgradeOpen(true);
      return;
    }
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

  const restoreSnapshot = async (snap: SplitSnapshot) => {
    // Återställ content_html på alla berörda kort som inte är nyskapade
    const toRestore = snap.affected.filter((s) => !s.isNew);
    setCards((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      // Ta bort nyskapade kort
      for (const newId of snap.createdIds) byId.delete(newId);
      // Återställ innehåll
      for (const s of toRestore) {
        const c = byId.get(s.id);
        if (c) byId.set(s.id, { ...c, content_html: s.content_html, position: s.position });
      }
      // Sortera efter position och renumera
      const list = Array.from(byId.values()).sort((a, b) => a.position - b.position);
      return list.map((c, i) => ({ ...c, position: i }));
    });
    // Persistera mot DB
    await Promise.all([
      ...snap.createdIds.map((id) => supabase.from("cards").delete().eq("id", id)),
      ...toRestore.map((s) =>
        supabase.from("cards").update({ content_html: s.content_html }).eq("id", s.id),
      ),
    ]);
    lastSnapshotRef.current = null;
    if (snapshotTimerRef.current) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    toast({ title: "Återställt", description: "Korten återställdes till tidigare innehåll." });
  };

  const cascadeSplitFromCard = async (cardId: string) => {
    if (!user || !manuscript) return;
    const startIdx = cards.findIndex((c) => c.id === cardId);
    if (startIdx === -1) return;

    const textSize = (manuscript.text_size as "sm" | "md" | "lg") ?? "md";
    const maxRows = MAX_ROWS_BY_SIZE[textSize];

    // Snapshot
    const affected: CardSnapshot[] = [];
    const createdIds: string[] = [];
    const snapTaken = new Set<string>();
    const takeSnap = (c: Card, isNew = false) => {
      if (snapTaken.has(c.id)) return;
      snapTaken.add(c.id);
      affected.push({ id: c.id, content_html: c.content_html ?? "", position: c.position, isNew });
    };

    // Arbeta på en lokal kopia av cards som vi sedan committar
    let working: Card[] = cards.map((c) => ({ ...c }));
    let idx = startIdx;
    takeSnap(working[idx]);

    // Säkerhetsspärr för att undvika oändlig loop
    let safety = 50;

    while (safety-- > 0) {
      const cur = working[idx];
      const html = cur.content_html ?? "";

      // Mät mot presentationsgeometrin
      let [fits, overflow] = splitHtmlAtRow(html, maxRows, textSize);

      if (!overflow) {
        if (fits !== html) working[idx] = { ...cur, content_html: fits };
        break;
      }

      // Skriv fits till nuvarande kort
      working[idx] = { ...cur, content_html: fits };

      // Säkerhetsnät: om split inte gjorde framsteg → fall tillbaka på halv-split
      if (fits === html) {
        const [a, b] = splitHtmlInHalf(html);
        if (b) {
          working[idx] = { ...cur, content_html: a };
          // Tvinga in b i nästa kort nedan
          const forced = b;
          const nextIdxForced = idx + 1;
          if (nextIdxForced >= working.length) {
            // Skapa nytt
            const { data, error } = await supabase
              .from("cards")
              .insert({
                manuscript_id: manuscript.id,
                user_id: user.id,
                position: nextIdxForced,
                role: cur.role,
                content_html: forced,
              })
              .select()
              .single();
            if (error || !data) {
              toast({ title: "Kunde inte dela kortet", description: error?.message, variant: "destructive" });
              return;
            }
            createdIds.push(data.id);
            working.splice(nextIdxForced, 0, data);
            takeSnap(data, true);
          } else {
            const n = working[nextIdxForced];
            takeSnap(n);
            working[nextIdxForced] = { ...n, content_html: forced + (n.content_html ?? "") };
          }
          idx = nextIdxForced;
          continue;
        }
        // Kunde inte dela alls — bryt
        break;
      }

      // Lägg till overflow först i nästa kort (skapa nytt om sista)
      const nextIdx = idx + 1;
      if (nextIdx >= working.length) {
        const { data, error } = await supabase
          .from("cards")
          .insert({
            manuscript_id: manuscript.id,
            user_id: user.id,
            position: nextIdx,
            role: cur.role,
            content_html: overflow,
          })
          .select()
          .single();
        if (error || !data) {
          toast({ title: "Kunde inte dela kortet", description: error?.message, variant: "destructive" });
          return;
        }
        createdIds.push(data.id);
        working.splice(nextIdx, 0, data);
        takeSnap(data, true);
      } else {
        const n = working[nextIdx];
        takeSnap(n);
        const merged = overflow + (n.content_html ?? "");
        working[nextIdx] = { ...n, content_html: merged };
      }
      idx = nextIdx;

      // Kontrollera om nästa kort nu ryms — om ja, klart
      const after = working[idx];
      const [, overflowAfter] = splitHtmlAtRow(after.content_html ?? "", maxRows, textSize);
      if (!overflowAfter) break;
      // Annars fortsätt loopen och splitta detta kort i nästa iteration
    }

    // Renumera positioner
    const renum = working.map((c, i) => ({ ...c, position: i }));
    setCards(renum);

    // Persistera ändringar mot DB (innehåll + positioner)
    const updates: PromiseLike<unknown>[] = [];
    for (const c of renum) {
      const snap = affected.find((s) => s.id === c.id);
      if (snap && !snap.isNew && snap.content_html !== (c.content_html ?? "")) {
        updates.push(supabase.from("cards").update({ content_html: c.content_html }).eq("id", c.id));
      }
    }
    updates.push(persistPositions(renum));
    await Promise.all(updates);

    // Spara snapshot för Ångra
    const snapshot: SplitSnapshot = { affected, createdIds };
    lastSnapshotRef.current = snapshot;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = window.setTimeout(() => {
      lastSnapshotRef.current = null;
      snapshotTimerRef.current = null;
    }, 30000);

    setOverflowingCardIds((prev) => {
      const n = new Set(prev);
      n.delete(cardId);
      return n;
    });

    const movedCount = createdIds.length;
    const description = movedCount > 0
      ? `Överskottet flödade vidare och ${movedCount === 1 ? "1 nytt kort skapades" : `${movedCount} nya kort skapades`}.`
      : "Överskottet flyttades till efterföljande kort.";
    toast({
      title: "Kortet delades",
      description,
      action: (
        <ToastAction altText="Ångra delning" onClick={() => restoreSnapshot(snapshot)}>
          Ångra
        </ToastAction>
      ),
    });
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
    <SEO title="Manus – Manuskort" noindex nofollow />
    <div className="min-h-screen">
      {/* Sticky topbar — kompakt, en rad. Vy-inställningar i popover. */}
      <div className="topbar-blur sticky top-0 z-50 border-b-hair">
        <header className="px-4 sm:px-6 min-h-14 py-2 flex items-center gap-2 sm:gap-3">
          <Link
            to="/bibliotek"
            className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex-shrink-0"
            aria-label="Tillbaka till bibliotek"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <input
              value={manuscript.title}
              onChange={(e) => updateMeta({ title: e.target.value })}
              className="font-display text-[17px] font-semibold tracking-tight bg-transparent border-0 outline-none min-w-[80px] max-w-[260px] truncate"
            />
            <span className="text-[12px] text-muted-foreground hidden md:inline whitespace-nowrap">
              · {manuscript.mode === "moderator" ? "moderator" : "talare"}
            </span>
          </div>

          <SaveIndicator compact />

          {/* Höger sida — primära åtgärder + sekundära ikoner */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto flex-shrink-0">
            {/* Måltid — ikon med diff-prick */}
            {(() => {
              const totalSeconds = cards.reduce((sum, c) => sum + estimateSeconds(wordCount(c.content_html), manuscript.wpm), 0);
              const diff = targetDurationSeconds !== null ? totalSeconds - targetDurationSeconds : null;
              const diffAbs = diff === null ? 0 : Math.abs(diff);
              const hasWarn = diff !== null && diffAbs >= 30;
              const overTarget = diff !== null && diff > 0;
              const diffText = diff === null ? null : (() => {
                const m = Math.floor(diffAbs / 60);
                const s = diffAbs % 60;
                const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
                return `${sign}${m}:${String(s).padStart(2, "0")}`;
              })();
              const tipLine = targetDurationSeconds !== null
                ? `Måltid: ${formatTargetDuration(targetDurationSeconds)}${diffText ? ` (${diffText})` : ""}`
                : "Måltid ej satt — klicka för att ange";
              return (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetDialogIntro(undefined);
                        setTargetSaveLabel("Spara");
                        setTargetDialogOpen(true);
                      }}
                      aria-label={tipLine}
                      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <Target className="h-4 w-4" />
                      {hasWarn && (
                        <span
                          className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${overTarget ? "bg-[hsl(35_85%_45%)]" : "bg-accent-blue"}`}
                          aria-hidden
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[12px] rounded-lg">
                    {tipLine}
                  </TooltipContent>
                </Tooltip>
              );
            })()}

            {/* Storlek — kvar synlig, men kompaktare */}
            <div className="seg-group" data-tour="editor.display-settings">
              {sizes.map((s) => (
                <button
                  key={s}
                  data-active={manuscript.text_size === s}
                  onClick={() => updateMeta({ text_size: s })}
                  className="seg-btn"
                  title={`Textstorlek: ${sizeLabels[s]}`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Vy-popover — samlar Anteckningar/Tider/Tidsformat/Layout/Notes-placement */}
            <Tooltip delayDuration={200}>
              <Popover>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Vy-inställningar"
                      className="inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors data-[state=open]:bg-surface-2 data-[state=open]:text-foreground"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[12px] rounded-lg">
                  Vy-inställningar
                </TooltipContent>
              <PopoverContent align="end" className="w-[300px] p-4 rounded-xl">
                <div className="flex flex-col gap-4">
                  <ViewSection label="Anteckningar" hint="Auto: panelen kollapsas när det inte finns någon anteckning">
                    <div className="seg-group w-full">
                      <button
                        data-active={notesDisplay === "always"}
                        onClick={() => {
                          setNotesDisplay("always");
                          if (!manuscript.show_notes) updateMeta({ show_notes: true });
                        }}
                        className="seg-btn flex-1"
                      >
                        Alltid
                      </button>
                      <button
                        data-active={notesDisplay === "auto"}
                        onClick={() => {
                          setNotesDisplay("auto");
                          if (!manuscript.show_notes) updateMeta({ show_notes: true });
                        }}
                        className="seg-btn flex-1"
                      >
                        Auto
                      </button>
                      <button
                        data-active={notesDisplay === "hidden"}
                        onClick={() => {
                          setNotesDisplay("hidden");
                          if (manuscript.show_notes) updateMeta({ show_notes: false });
                        }}
                        className="seg-btn flex-1"
                      >
                        Dold
                      </button>
                    </div>
                  </ViewSection>

                  <ViewSection label="Tider">
                    <div className="seg-group w-full">
                      <button
                        data-active={manuscript.show_times}
                        onClick={() => updateMeta({ show_times: !manuscript.show_times })}
                        className="seg-btn flex-1"
                      >
                        {manuscript.show_times ? "Visa tider" : "Dölj tider"}
                      </button>
                    </div>
                  </ViewSection>

                  {manuscript.show_times && (
                    <ViewSection label="Tidsformat">
                      <div className="seg-group w-full">
                        <button
                          data-active={timeFormat === "clock"}
                          onClick={() => updateMeta({ time_format: "clock" })}
                          className="seg-btn flex-1"
                          title="Klockslag på dygnet (HH:MM)"
                        >
                          Klockslag
                        </button>
                        <button
                          data-active={timeFormat === "elapsed"}
                          onClick={() => updateMeta({ time_format: "elapsed" })}
                          className="seg-btn flex-1"
                          title="Förfluten tid från programmets start (MM:SS)"
                        >
                          Förfluten
                        </button>
                      </div>
                    </ViewSection>
                  )}

                  <div className="border-t border-border/50 -mx-4" />

                  <ViewSection label="Kortlayout (mockup)" hint="Sparas lokalt i webbläsaren">
                    <div className="seg-group w-full">
                      <button
                        data-active={layoutVariant === "klassisk"}
                        onClick={() => setLayoutVariant("klassisk")}
                        className="seg-btn flex-1"
                      >
                        Klassisk
                      </button>
                      <button
                        data-active={layoutVariant === "ny"}
                        onClick={() => setLayoutVariant("ny")}
                        className="seg-btn flex-1"
                      >
                        Ny
                      </button>
                    </div>
                  </ViewSection>

                  {layoutVariant === "ny" && manuscript.show_notes && (
                    <ViewSection label="Anteckningarnas placering">
                      <div className="seg-group w-full">
                        <button
                          data-active={notesPlacement === "side"}
                          onClick={() => setNotesPlacement("side")}
                          className="seg-btn flex-1"
                        >
                          Sida
                        </button>
                        <button
                          data-active={notesPlacement === "below"}
                          onClick={() => setNotesPlacement("below")}
                          className="seg-btn flex-1"
                        >
                          Under
                        </button>
                      </div>
                    </ViewSection>
                  )}
                </div>
                </PopoverContent>
              </Popover>
            </Tooltip>

            {isModerator && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    data-tour="editor.panelists"
                    type="button"
                    onClick={() => setPanelistSidebarOpen(true)}
                    aria-label="Deltagare"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[12px] rounded-lg">
                  Deltagare
                </TooltipContent>
              </Tooltip>
            )}

            {/* Skriv ut — ikon */}
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (overflowingCardIds.size > 0) {
                      toast({
                        title: "Utskrift blockerad",
                        description: `${overflowingCardIds.size} ${overflowingCardIds.size === 1 ? "kort är" : "kort är"} för långt. Korta ner texten eller använd "Dela kortet automatiskt".`,
                        variant: "destructive",
                      });
                      return;
                    }
                    setPrintDialogOpen(true);
                  }}
                  disabled={overflowingCardIds.size > 0}
                  aria-label="Skriv ut manus"
                  className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="h-4 w-4" />
                  {overflowingCardIds.size > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
                      {overflowingCardIds.size}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[12px] rounded-lg">
                {overflowingCardIds.size > 0
                  ? `Blockerad: ${overflowingCardIds.size} kort överskrider radgränsen`
                  : "Skriv ut manus"}
              </TooltipContent>
            </Tooltip>

            {/* Liten visuell separator */}
            <span className="hidden sm:block h-5 w-px bg-border/60 mx-1" aria-hidden />

            <div data-tour="editor.add-print" className="flex items-center gap-1.5">
              <Button
                onClick={addCard}
                className="h-9 rounded-full px-3 sm:px-4 bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] font-medium gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nytt kort</span>
              </Button>
            </div>

            {(() => {
              const startPresentation = () => {
                if (overflowingCardIds.size > 0) {
                  toast({
                    title: "Presentationsläge blockerat",
                    description: `${overflowingCardIds.size} ${overflowingCardIds.size === 1 ? "kort är" : "kort är"} för långt. Åtgärda först.`,
                    variant: "destructive",
                  });
                  return;
                }
                if (targetDurationSeconds === null) {
                  setTargetDialogIntro("Ange måltid för att starta presentationen.");
                  setTargetSaveLabel("Spara och starta");
                  setTargetDialogOpen(true);
                  return;
                }
                navigate(`/manus/${manuscript.id}/presentera`);
              };
              startPresentationRef.current = startPresentation;
              const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
              const shortcutLabel = isMac ? "⌘ Enter" : "Ctrl Enter";
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-tour="editor.present"
                      onClick={startPresentation}
                      disabled={overflowingCardIds.size > 0}
                      className="h-10 rounded-full px-4 sm:px-5 bg-accent-blue hover:bg-accent-blue/90 text-white text-[14px] font-semibold gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span className="hidden sm:inline">Starta presentation</span>
                      <span className="sm:hidden">Starta</span>
                      <kbd className="hidden md:inline-flex ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono tracking-wider">
                        {shortcutLabel}
                      </kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {overflowingCardIds.size > 0
                      ? "Blockerad: kort överskrider radgränsen"
                      : `Starta presentationsläge (${shortcutLabel})`}
                  </TooltipContent>
                </Tooltip>
              );
            })()}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFindReplaceOpen(true)}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  aria-label="Hitta & ersätt"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hitta &amp; ersätt</TooltipContent>
            </Tooltip>
            <HelpButton />
          </div>
        </header>
      </div>
      <main className="max-w-[920px] mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-24 flex flex-col gap-6">
        {/* Cue-legend — bara i klassisk layout (i Ny layout finns ?-tooltip per kort) */}
        {layoutVariant === "klassisk" && (
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
        )}

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
                {cards.map((c, idx) => {
                  const commonProps = {
                    card: c,
                    number: idx + 1,
                    textSize: manuscript.text_size as "sm" | "md" | "lg",
                    showNotes: manuscript.show_notes,
                    notesDisplay,
                    showTimes: manuscript.show_times,
                    wpm: manuscript.wpm,
                    timeFormat,
                    isModerator,
                    canSyncWithPrevious: idx > 0,
                    onLocalChange: (patch: Partial<Card>) => updateCard(c.id, patch),
                    onDelete: () => deleteCard(c.id),
                    onDuplicate: () => duplicateCard(c.id),
                    onSplit: () => splitCard(c.id),
                    onMergeUp: () => mergeUp(c.id),
                    onSyncWithPrevious: () => syncWithPrevious(c.id),
                    onPasteOverflow: (text: string) => handlePasteOverflow(c.id, text),
                    onAutoSplit: () => cascadeSplitFromCard(c.id),
                    onOverflowStateChange: handleOverflowChange,
                    onEditorReady: handleEditorReady,
                  };
                  return layoutVariant === "ny"
                    ? <ManusCardV2 key={c.id} {...commonProps} notesPlacement={notesPlacement} />
                    : <ManusCard key={c.id} {...commonProps} />;
                })}
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

      <TargetDurationDialog
        open={targetDialogOpen}
        onOpenChange={(open) => {
          setTargetDialogOpen(open);
          if (!open) {
            setTargetDialogIntro(undefined);
            setTargetSaveLabel("Spara");
          }
        }}
        value={targetDurationSeconds}
        intro={targetDialogIntro}
        saveLabel={targetSaveLabel}
        onSave={async (seconds) => {
          updateMeta({ target_duration_seconds: seconds } as Partial<Manuscript>);
          if (targetSaveLabel === "Spara och starta" && seconds !== null && manuscript) {
            const { error } = await supabase
              .from("manuscripts")
              .update({ target_duration_seconds: seconds })
              .eq("id", manuscript.id);
            if (!error) navigate(`/manus/${manuscript.id}/presentera`);
          }
        }}
      />

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Du har nått kort-gränsen för Gratis"
        description={`Gratis tillåter ${limits.cardsPerManuscript} kort per manus. Uppgradera till PRO för obegränsat.`}
      />

      <FindReplaceDialog
        open={findReplaceOpen}
        onOpenChange={setFindReplaceOpen}
        cards={cards.map((c) => ({ id: c.id, content_html: c.content_html }))}
        onApply={async (updates, total) => {
          if (updates.length === 0) return;
          // Optimistisk uppdatering lokalt
          setCards((prev) => {
            const map = new Map(updates.map((u) => [u.id, u.html]));
            return prev.map((c) => (map.has(c.id) ? { ...c, content_html: map.get(c.id)! } : c));
          });
          // Persistera parallellt
          const results = await Promise.all(
            updates.map((u) =>
              supabase.from("cards").update({ content_html: u.html }).eq("id", u.id),
            ),
          );
          const failed = results.filter((r) => r.error).length;
          if (failed > 0) {
            toast({
              title: "Vissa kort kunde inte uppdateras",
              description: `${failed} av ${updates.length} kort misslyckades.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Ersatt",
              description: `${total} förekomst${total === 1 ? "" : "er"} i ${updates.length} kort.`,
            });
          }
        }}
      />
    </div>
    </PanelistsProvider>
  );
}

function ViewSection({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        {hint && <span className="text-[10px] text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
