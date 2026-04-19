import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEditorPreference } from "@/hooks/useEditorPreference";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SEO } from "@/components/SEO";
import { HelpButton } from "@/components/HelpButton";
import { TiptapDocEditor } from "@/components/editor/TiptapDocEditor";
import { PanelistSidebar } from "@/components/editor/PanelistSidebar";
import { PrintDialog } from "@/components/editor/PrintDialog";
import { FindReplaceDialog } from "@/components/editor/FindReplaceDialog";
import {
  TargetDurationDialog,
  formatTargetDuration,
} from "@/components/editor/TargetDurationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Save,
  Users,
  RotateCcw,
  Target,
  Settings2,
  Printer,
  Plus,
  Play,
  Search,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  cardsToDocHtml,
  rowsToCardAttrs,
  docToCardNodes,
  planCardSyncFromDoc,
} from "@/lib/cardDocSerialize";
import { PanelistsProvider } from "@/hooks/usePanelists";
import { wordCount, estimateSeconds } from "@/lib/wordCount";
import type { Database } from "@/integrations/supabase/types";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import { DOMSerializer } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

const sizes: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];

function ViewSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * EditorV3 — NodeView-arkitektur. Toolbaren speglar v1: Måltid, storlek, vy,
 * paneldeltagare, utskrift, +Nytt kort, Starta, sök, hjälp.
 */
export default function EditorV3() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPreference } = useEditorPreference();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const [docHtml, setDocHtml] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cardCount, setCardCount] = useState(0);
  const [panelistSidebarOpen, setPanelistSidebarOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [targetDialogIntro, setTargetDialogIntro] = useState<string | undefined>(undefined);
  const [targetSaveLabel, setTargetSaveLabel] = useState<string>("Spara");
  const [chainBreakOpen, setChainBreakOpen] = useState(false);
  const [missingTargetCards, setMissingTargetCards] = useState<number[]>([]);

  const editorRef = useRef<TiptapEditorType | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const hydratedRef = useRef(false);
  const pendingExternalHydrateRef = useRef(false);
  const startPresentationRef = useRef<(() => void) | null>(null);

  const isModerator = manuscript?.mode === "moderator";
  const timeFormat = (manuscript?.time_format === "elapsed" ? "elapsed" : "clock") as
    | "clock"
    | "elapsed";
  const targetDurationSeconds = manuscript?.target_duration_seconds ?? null;

  /** Opt-out: spara preferens v1 i DB och navigera till /v1-routen. */
  const handleUseV1 = useCallback(async () => {
    await setPreference("v1");
    toast({
      title: "Bytt till v1",
      description: "Inställningen sparas på din profil. Du kan ändra tillbaka i Inställningar.",
    });
    navigate(`/manus/${id}/v1`);
  }, [setPreference, navigate, id]);

  // Ladda manus + kort
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      initializedRef.current = false;
      hydratedRef.current = false;
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
      const rows = cRes.data ?? [];
      setCards(rows);
      pendingExternalHydrateRef.current = true;
      setDocHtml(cardsToDocHtml(rows));
      setCardCount(Math.max(1, rows.length));
      setLoading(false);
    })();
  }, [id, navigate]);

  /** Uppdatera manus-meta (text_size, show_notes, show_times, time_format, target). */
  const updateMeta = useCallback(
    async (patch: Partial<Manuscript>) => {
      if (!manuscript) return;
      setManuscript({ ...manuscript, ...patch });
      const { error } = await supabase
        .from("manuscripts")
        .update(patch as never)
        .eq("id", manuscript.id);
      if (error) {
        toast({ title: "Kunde inte spara inställning", description: error.message, variant: "destructive" });
      }
    },
    [manuscript],
  );

  /** Hydrera attrs efter att Tiptap mountat dokumentet. */
  const hydrateAttrs = useCallback(
    (editor: TiptapEditorType) => {
      if (!manuscript) return;
      const attrs = rowsToCardAttrs(cards, {
        wpm: manuscript.wpm,
        showNotes: manuscript.show_notes,
        showTimes: manuscript.show_times,
      });
      const byId = new Map(attrs.map((a) => [a.cardId, a]));

      const tr = editor.state.tr;
      let i = 0;
      let total = 0;
      editor.state.doc.forEach((n) => {
        if (n.type.name === "cardBlock") total++;
      });
      total = Math.max(1, total);

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== "cardBlock") return false;
        i++;
        const cardId = node.attrs.cardId as string | null;
        const fromDb = cardId ? byId.get(cardId) : null;
        const next = {
          ...node.attrs,
          cardNumber: i,
          totalCards: total,
          wpm: manuscript.wpm,
          showNotes: manuscript.show_notes,
          showTimes: manuscript.show_times,
          ...(fromDb ?? {}),
        };
        tr.setNodeMarkup(pos, undefined, next);
        return false;
      });
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);
    },
    [cards, manuscript],
  );

  const handleEditorReady = useCallback(
    (ed: TiptapEditorType | null) => {
      editorRef.current = ed;
      if (ed && !initializedRef.current && cards.length >= 0 && manuscript) {
        requestAnimationFrame(() => {
          if (editorRef.current === ed) {
            hydrateAttrs(ed);
            pendingExternalHydrateRef.current = false;
            initializedRef.current = true;
            hydratedRef.current = true;
          }
        });
      }
    },
    [cards, manuscript, hydrateAttrs],
  );

  // När docHtml byts (t.ex. efter omladdning från DB), rehydrera attrs
  useEffect(() => {
    if (!pendingExternalHydrateRef.current || !editorRef.current || !manuscript) return;
    initializedRef.current = false;
    hydratedRef.current = false;
    const t = window.setTimeout(() => {
      if (editorRef.current) {
        hydrateAttrs(editorRef.current);
        pendingExternalHydrateRef.current = false;
        initializedRef.current = true;
        hydratedRef.current = true;
      }
    }, 16);
    return () => window.clearTimeout(t);
  }, [docHtml, hydrateAttrs, manuscript]);

  // När show_notes/show_times ändras → re-hydrera så NodeView ser nya flaggor
  useEffect(() => {
    if (!editorRef.current || !manuscript || !hydratedRef.current) return;
    hydrateAttrs(editorRef.current);
  }, [manuscript?.show_notes, manuscript?.show_times, manuscript?.wpm, hydrateAttrs, manuscript]);

  // Räkna kort när doc ändras + uppdatera cardNumber/totalCards
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const onUpdate = () => {
      let total = 0;
      ed.state.doc.forEach((n) => {
        if (n.type.name === "cardBlock") total++;
      });
      setCardCount(Math.max(1, total));

      const tr = ed.state.tr;
      let n = 0;
      let changed = false;
      ed.state.doc.descendants((node, pos) => {
        if (node.type.name !== "cardBlock") return false;
        n++;
        if (node.attrs.cardNumber !== n || node.attrs.totalCards !== total) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            cardNumber: n,
            totalCards: total,
          });
          changed = true;
        }
        return false;
      });
      if (changed) {
        tr.setMeta("addToHistory", false);
        ed.view.dispatch(tr);
      }
    };
    ed.on("update", onUpdate);
    return () => {
      ed.off("update", onUpdate);
    };
  }, [editorRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd/Ctrl+F → Hitta & ersätt; Cmd/Ctrl+Enter → starta presentation
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

  // Debounced autosave för dokumentet (kort)
  const handleDocChange = (html: string) => {
    setDocHtml(html);
    if (!hydratedRef.current) return;
    setSaving("idle");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persist();
    }, 1200);
  };

  const persist = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed || !user || !manuscript) return;
    if (!hydratedRef.current) return;
    setSaving("saving");
    try {
      // STEG 1: säkerställ cardId
      {
        const tr = ed.state.tr;
        let changed = false;
        ed.state.doc.descendants((node, pos) => {
          if (node.type.name !== "cardBlock") return false;
          if (!node.attrs.cardId) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              cardId: crypto.randomUUID(),
            });
            changed = true;
          }
          return false;
        });
        if (changed) {
          tr.setMeta("addToHistory", false);
          ed.view.dispatch(tr);
        }
      }

      // STEG 2: serialisera
      const serializer = DOMSerializer.fromSchema(ed.schema);
      const serializeNode = (node: import("prosemirror-model").Node): string => {
        const div = document.createElement("div");
        div.appendChild(serializer.serializeNode(node));
        return div.innerHTML;
      };

      const computed = docToCardNodes(ed.state.doc, serializeNode);
      const plan = planCardSyncFromDoc(computed, cards, {
        manuscriptId: manuscript.id,
        userId: user.id,
      });

      for (const u of plan.updates) {
        const { error } = await supabase.from("cards").update(u.patch).eq("id", u.id);
        if (error) throw error;
      }

      const inserted: Card[] = [];
      if (plan.inserts.length > 0) {
        const rowsWithIds = plan.inserts.map((i) => ({
          ...i.row,
          id: i.tempCardId ?? crypto.randomUUID(),
        }));
        const { data, error } = await supabase
          .from("cards")
          .upsert(rowsWithIds, { onConflict: "id" })
          .select();
        if (error) throw error;
        if (data) inserted.push(...data);
      }

      if (plan.deletes.length > 0) {
        const { error } = await supabase.from("cards").delete().in("id", plan.deletes);
        if (error) throw error;
      }

      const next: Card[] = [];
      const updatedById = new Map(plan.updates.map((u) => [u.id, u]));
      for (const c of cards) {
        if (plan.deletes.includes(c.id)) continue;
        const u = updatedById.get(c.id);
        if (u) next.push({ ...c, ...u.patch });
        else next.push(c);
      }
      next.push(...inserted);
      next.sort((a, b) => a.position - b.position);
      setCards(next);

      setSaving("saved");
      window.setTimeout(() => setSaving((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e: unknown) {
      console.error("[EditorV3] persist error", e);
      setSaving("error");
      toast({
        title: "Kunde inte spara",
        description: e instanceof Error ? e.message : "Okänt fel",
        variant: "destructive",
      });
    }
  }, [cards, manuscript, user]);

  /** Lägg till nytt tomt kort sist i dokumentet. */
  const addCard = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { state } = ed;
    const cardBlockType = state.schema.nodes.cardBlock;
    const paragraphType = state.schema.nodes.paragraph;
    if (!cardBlockType || !paragraphType) return;
    const newCard = cardBlockType.create({ cardId: null }, paragraphType.create());
    const insertAt = state.doc.content.size;
    const tr = state.tr.insert(insertAt, newCard);
    // Caret in i nya kortet
    const caretPos = insertAt + 2;
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(caretPos, tr.doc.content.size))));
    ed.view.dispatch(tr.scrollIntoView());
    ed.view.focus();
  }, []);

  // Total estimerad längd (för måltids-prick)
  const totalSeconds = useMemo(() => {
    if (!manuscript) return 0;
    return cards.reduce(
      (sum, c) => sum + estimateSeconds(wordCount(c.content_html), manuscript.wpm),
      0,
    );
  }, [cards, manuscript]);

  /**
   * Sluttid (sekunder) på sista kortet enligt kedjan av manuella måltider —
   * endast om ALLA kort har manuell måltid satt. Räknas från live-doc i
   * editorn när dialogen öppnas (annars null).
   */
  const chainEndSeconds = useMemo<number | null>(() => {
    if (!targetDialogOpen) return null;
    const ed = editorRef.current;
    if (!ed) return null;
    let acc = 0;
    let count = 0;
    let broken = false;
    ed.state.doc.forEach((n) => {
      if (broken) return;
      if (n.type.name !== "cardBlock") return;
      const attrs = n.attrs as { targetSeconds: number | null; targetSecondsIsManual: boolean };
      if (!attrs.targetSecondsIsManual || attrs.targetSeconds == null || attrs.targetSeconds <= 0) {
        broken = true;
        return;
      }
      acc += attrs.targetSeconds;
      count += 1;
    });
    if (broken || count === 0) return null;
    return acc + (count - 1); // +1s paus mellan korten
  }, [targetDialogOpen]);

  if (loading || !manuscript) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-faint uppercase tracking-widest">Laddar v3…</p>
      </div>
    );
  }

  const saveLabel = {
    idle: "Sparat",
    saving: "Sparar…",
    saved: "Sparat ✓",
    error: "Fel — försök igen",
  }[saving];

  // Måltidsdiff
  const diff = targetDurationSeconds !== null ? totalSeconds - targetDurationSeconds : null;
  const diffAbs = diff === null ? 0 : Math.abs(diff);
  const hasWarn = diff !== null && diffAbs >= 30;
  const overTarget = diff !== null && diff > 0;
  const diffText =
    diff === null
      ? null
      : (() => {
          const m = Math.floor(diffAbs / 60);
          const s = diffAbs % 60;
          const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
          return `${sign}${m}:${String(s).padStart(2, "0")}`;
        })();
  const targetTip =
    targetDurationSeconds !== null
      ? `Måltid: ${formatTargetDuration(targetDurationSeconds)}${diffText ? ` (${diffText})` : ""}`
      : "Måltid ej satt — klicka för att ange";

  const startPresentation = (skipChainCheck = false) => {
    if (targetDurationSeconds === null) {
      setTargetDialogIntro("Ange måltid för att starta presentationen.");
      setTargetSaveLabel("Spara och starta");
      setTargetDialogOpen(true);
      return;
    }
    if (!skipChainCheck) {
      const ed = editorRef.current;
      if (ed) {
        const missing: number[] = [];
        let hasAnyManual = false;
        let i = 0;
        ed.state.doc.forEach((n) => {
          if (n.type.name !== "cardBlock") return;
          i++;
          const attrs = n.attrs as { targetSeconds: number | null; targetSecondsIsManual: boolean };
          const isManual =
            attrs.targetSecondsIsManual && attrs.targetSeconds != null && attrs.targetSeconds > 0;
          if (isManual) hasAnyManual = true;
          else missing.push(i);
        });
        if (hasAnyManual && missing.length > 0) {
          setMissingTargetCards(missing);
          setChainBreakOpen(true);
          return;
        }
      }
    }
    navigate(`/manus/${manuscript.id}/presentera`);
  };
  startPresentationRef.current = () => startPresentation();

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘ Enter" : "Ctrl Enter";

  return (
    <PanelistsProvider manuscriptId={manuscript.id}>
      <SEO title={`${manuscript.title} – Editor`} />

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2 flex-shrink-0">
              <Link to="/bibliotek">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Bibliotek</span>
              </Link>
            </Button>

            <div className="flex items-center gap-2 min-w-0">
              <input
                value={manuscript.title}
                onChange={(e) => updateMeta({ title: e.target.value })}
                className="font-display text-[17px] font-semibold tracking-tight bg-transparent border-0 outline-none min-w-[80px] max-w-[260px] truncate"
              />
              <span className="text-[12px] text-muted-foreground hidden md:inline whitespace-nowrap">
                · {manuscript.mode === "moderator" ? "moderator" : "talare"}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto flex-shrink-0">
              {/* Måltid */}
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetDialogIntro(undefined);
                      setTargetSaveLabel("Spara");
                      setTargetDialogOpen(true);
                    }}
                    aria-label={targetTip}
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
                  {targetTip}
                </TooltipContent>
              </Tooltip>

              {/* Storlek flyttad till Vy-popover nedan */}

              {/* Vy-popover */}
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
                      <ViewSection label="Textstorlek">
                        <div className="seg-group w-full">
                          {sizes.map((s) => (
                            <button
                              key={s}
                              data-active={manuscript.text_size === s}
                              onClick={() => updateMeta({ text_size: s })}
                              className="seg-btn flex-1"
                              title={`Textstorlek: ${s.toUpperCase()}`}
                            >
                              {s.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </ViewSection>

                      <ViewSection label="Anteckningar">
                        <div className="seg-group w-full">
                          <button
                            data-active={manuscript.show_notes}
                            onClick={() => updateMeta({ show_notes: true })}
                            className="seg-btn flex-1"
                          >
                            Visa
                          </button>
                          <button
                            data-active={!manuscript.show_notes}
                            onClick={() => updateMeta({ show_notes: false })}
                            className="seg-btn flex-1"
                          >
                            Dölj
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
                    </div>
                  </PopoverContent>
                </Popover>
              </Tooltip>

              {/* Paneldeltagare */}
              {isModerator && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
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

              {/* Skriv ut */}
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPrintDialogOpen(true)}
                    aria-label="Skriv ut manus"
                    className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[12px] rounded-lg">
                  Skriv ut manus
                </TooltipContent>
              </Tooltip>

              {/* Separator */}
              <span className="hidden sm:block h-5 w-px bg-border/60 mx-1" aria-hidden />

              {/* Nytt kort */}
              <Button
                onClick={addCard}
                className="h-9 rounded-full px-3 sm:px-4 bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] font-medium gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nytt kort</span>
              </Button>

              {/* Starta */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => startPresentation()}
                    className="h-9 rounded-full px-3 sm:px-4 bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] font-medium gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span className="hidden sm:inline">Starta</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{`Starta presentationsläge (${shortcutLabel})`}</TooltipContent>
              </Tooltip>

              {/* Sök */}
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

              {/* Opt-out + sparindikator (sekundära, längst till höger) */}
              <span className="hidden lg:flex items-center gap-2 ml-1 pl-2 border-l border-border/40">
                <button
                  type="button"
                  onClick={handleUseV1}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                  aria-label="Använd gamla editorn (v1)"
                  title="Byt tillbaka till v1 — gamla editorn läggs ner inom kort"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>v1</span>
                </button>
                <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                  {cardCount} kort
                </span>
                <span
                  className={`text-[11px] font-mono inline-flex items-center gap-1 whitespace-nowrap ${
                    saving === "error" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  <Save className="h-3 w-3" />
                  {saveLabel}
                </span>
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full">
          <div className="max-w-[900px] mx-auto py-8 px-4">
            <TiptapDocEditor
              value={docHtml}
              onChange={handleDocChange}
              size={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
              onEditorReady={handleEditorReady}
            />
          </div>
        </main>

        <PanelistSidebar
          open={panelistSidebarOpen}
          onClose={() => setPanelistSidebarOpen(false)}
        />

        <PrintDialog open={printDialogOpen} onOpenChange={setPrintDialogOpen} />

        <FindReplaceDialog
          open={findReplaceOpen}
          onOpenChange={setFindReplaceOpen}
          cards={cards.map((c) => ({ id: c.id, content_html: c.content_html }))}
          onApply={async (updates) => {
            for (const u of updates) {
              const { error } = await supabase
                .from("cards")
                .update({ content_html: u.html })
                .eq("id", u.id);
              if (error) {
                toast({ title: "Kunde inte uppdatera kort", description: error.message, variant: "destructive" });
                return;
              }
            }
            // Lokalt: uppdatera state och re-hydrera dokumentet
            const updatedMap = new Map(updates.map((u) => [u.id, u.html]));
            const next = cards.map((c) =>
              updatedMap.has(c.id) ? { ...c, content_html: updatedMap.get(c.id)! } : c,
            );
            setCards(next);
            pendingExternalHydrateRef.current = true;
            setDocHtml(cardsToDocHtml(next));
          }}
        />

        <TargetDurationDialog
          open={targetDialogOpen}
          onOpenChange={setTargetDialogOpen}
          value={targetDurationSeconds}
          intro={targetDialogIntro}
          saveLabel={targetSaveLabel}
          onSave={(seconds) => {
            void updateMeta({ target_duration_seconds: seconds } as Partial<Manuscript>);
            if (targetSaveLabel === "Spara och starta" && seconds !== null) {
              navigate(`/manus/${manuscript.id}/presentera`);
            }
          }}
        />

        <AlertDialog open={chainBreakOpen} onOpenChange={setChainBreakOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Måltid saknas på vissa kort</AlertDialogTitle>
              <AlertDialogDescription>
                Följande kort saknar manuell måltid och bryter den ackumulerade tidskedjan:{" "}
                <strong>
                  {missingTargetCards
                    .map((n) => `Kort ${String(n).padStart(2, "0")}`)
                    .join(", ")}
                </strong>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Gå tillbaka och redigera</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setChainBreakOpen(false);
                  startPresentation(true);
                }}
              >
                Starta ändå
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PanelistsProvider>
  );
}
