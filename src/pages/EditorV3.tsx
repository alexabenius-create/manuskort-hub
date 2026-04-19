import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { TiptapDocEditor } from "@/components/editor/TiptapDocEditor";
import {
  CardChromeFrame,
  CHROME_HEADER_HEIGHT,
  CHROME_FOOTER_HEIGHT,
  CHROME_GAP_HEIGHT,
} from "@/components/editor/CardChromeFrame";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { joinCardsToDoc, splitDocToCards, planCardSync } from "@/lib/docSplit";
import { PanelistsProvider } from "@/hooks/usePanelists";
import type { TextSize } from "@/lib/cardLimits";
import type { Database } from "@/integrations/supabase/types";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import type { FrameBreak } from "@/lib/docFrameDecorations";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

interface FragmentLayout {
  /** index 0..N-1 */
  index: number;
  /** ProseMirror dokument-position där fragmentet börjar (block-start). */
  startDocPos: number;
  /** ProseMirror dokument-position där fragmentet slutar (block-slut). */
  endDocPos: number;
  /** Ordlängd-html för chromen (för wordcount). */
  html: string;
  /** Pixel-Y i editor-rooten där fragmentets text börjar. */
  topPx: number;
  /** Höjd i pixlar för fragmentets text-zon. */
  heightPx: number;
}

/**
 * EditorV3 — v1:s kort-chrome ovanpå v2:s flödes-editor.
 *
 * Princip:
 *  - splitDocToCards delar texten i N HTML-fragment vid presentations-radgräns
 *  - Varje fragment-gräns översätts till en ProseMirror-block-position
 *  - DocFrameDecorations injicerar en spacer-widget vid varje gräns →
 *    reserverar plats för chrome (footer + gap + nästa header)
 *  - Vi mäter pixel-Y för start/slut av varje fragment och ritar absolut-
 *    positionerade header + footer i en overlay
 *  - Texten i mitten är helt fri → klick på text → editorn fångar
 */
export default function EditorV3() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: tierLoading } = useTier();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const [docHtml, setDocHtml] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [layout, setLayout] = useState<FragmentLayout[]>([]);
  const [frameBreaks, setFrameBreaks] = useState<FrameBreak[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const editorRef = useRef<TiptapEditorType | null>(null);
  const editorRootRef = useRef<HTMLElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const measureRafRef = useRef<number | null>(null);

  // Admin-skydd
  useEffect(() => {
    if (tierLoading) return;
    if (!isAdmin) {
      toast({
        title: "Endast admin",
        description: "Editor v3 är ett experiment som bara admin har tillgång till.",
        variant: "destructive",
      });
      navigate(`/manus/${id}`);
    }
  }, [isAdmin, tierLoading, id, navigate]);

  // Ladda manus + kort
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
      setDocHtml(joinCardsToDoc(cRes.data ?? []));
      setLoading(false);
    })();
  }, [id, navigate]);

  const textSize: TextSize = (manuscript?.text_size as TextSize) ?? "md";

  // Total spacer-höjd mellan två kort i editor-flödet:
  //   = FOOTER (slut på kort i) + GAP (luft) + HEADER (början på kort i+1)
  const SPACER_HEIGHT = CHROME_FOOTER_HEIGHT + CHROME_GAP_HEIGHT + CHROME_HEADER_HEIGHT;

  const measureLayout = useCallback(() => {
    const editor = editorRef.current;
    const root = editorRootRef.current;
    if (!editor || !root || !manuscript) return;

    // 1) Splitta html i fragments enligt presentations-geometri
    const fragments = splitDocToCards(docHtml, textSize);

    // 2) Hitta block-gräns-positioner i doc
    const blockEnds: number[] = [];
    editor.state.doc.forEach((node, offset) => {
      blockEnds.push(offset + node.nodeSize);
    });

    // Räkna hur många top-level block varje fragment innehåller
    const blocksPerFrag: number[] = fragments.map((html) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      let count = 0;
      tmp.childNodes.forEach((n) => {
        if (n.nodeType === 1) count++;
      });
      return Math.max(1, count);
    });

    // Fragment-index → block-range
    const fragBlockRanges: { startBlock: number; endBlock: number }[] = [];
    let acc = 0;
    for (const b of blocksPerFrag) {
      fragBlockRanges.push({ startBlock: acc, endBlock: acc + b - 1 });
      acc += b;
    }

    // 3) Frame-breaks = STARTPOSITION för första blocket i varje fragment > 0
    //    Decoration sätter padding-top på det blocket → reserverar visuell luft.
    const breaks: FrameBreak[] = [];
    for (let i = 1; i < fragBlockRanges.length; i++) {
      const startBlockIdx = fragBlockRanges[i].startBlock;
      const pos = startBlockIdx === 0 ? 0 : blockEnds[startBlockIdx - 1];
      breaks.push({ pos, heightPx: SPACER_HEIGHT });
    }

    // 4) Mät pixel-Y för fragmentens text-zon
    const editorRect = root.getBoundingClientRect();
    const blockEls = Array.from(root.children).filter(
      (n) => n.nodeType === 1 && !(n as HTMLElement).hasAttribute("data-frame-spacer"),
    ) as HTMLElement[];

    const layouts: FragmentLayout[] = [];
    for (let i = 0; i < fragBlockRanges.length; i++) {
      const { startBlock, endBlock } = fragBlockRanges[i];
      const firstEl = blockEls[startBlock];
      const lastEl = blockEls[endBlock] ?? firstEl;
      if (!firstEl || !lastEl) continue;
      const fr = firstEl.getBoundingClientRect();
      const lr = lastEl.getBoundingClientRect();
      const textTop = fr.top - editorRect.top;
      const textHeight = Math.max(40, lr.bottom - fr.top);

      // Box = HEADER ovanför text + text-zon + FOOTER under text
      const boxTop = textTop - CHROME_HEADER_HEIGHT;
      const boxHeight = CHROME_HEADER_HEIGHT + textHeight + CHROME_FOOTER_HEIGHT;

      const startBlockOffset = startBlock === 0 ? 0 : blockEnds[startBlock - 1];
      const endBlockOffset = blockEnds[endBlock] ?? startBlockOffset;

      layouts.push({
        index: i,
        startDocPos: startBlockOffset,
        endDocPos: endBlockOffset,
        html: fragments[i],
        topPx: boxTop,
        heightPx: boxHeight,
      });
    }

    setLayout(layouts);
    setFrameBreaks(breaks);

    // Aktivt kort = där caret står
    const sel = editor.state.selection;
    if (sel) {
      const from = sel.from;
      let idx = 0;
      for (let i = 0; i < layouts.length; i++) {
        if (from >= layouts[i].startDocPos && from <= layouts[i].endDocPos) {
          idx = i;
          break;
        }
        idx = i;
      }
      setActiveIdx(idx);
    }
  }, [docHtml, manuscript, textSize, SPACER_HEIGHT]);

  const scheduleMeasure = useCallback(() => {
    if (measureRafRef.current) cancelAnimationFrame(measureRafRef.current);
    measureRafRef.current = requestAnimationFrame(measureLayout);
  }, [measureLayout]);

  const handleEditorReady = useCallback((ed: TiptapEditorType | null) => {
    editorRef.current = ed;
    editorRootRef.current = ed ? (ed.view.dom as HTMLElement) : null;
    if (ed) {
      ed.on("selectionUpdate", scheduleMeasure);
      ed.on("update", scheduleMeasure);
      // initial mätning efter en frame
      requestAnimationFrame(scheduleMeasure);
    }
  }, [scheduleMeasure]);

  // Mät om vid resize
  useEffect(() => {
    const onResize = () => scheduleMeasure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scheduleMeasure]);

  // Mät när html eller storlek ändras
  useEffect(() => {
    scheduleMeasure();
  }, [docHtml, textSize, scheduleMeasure]);

  // Debounced autosave
  const handleDocChange = (html: string) => {
    setDocHtml(html);
    setSaving("idle");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persist(html);
    }, 1200);
  };

  async function persist(html: string) {
    if (!user || !manuscript) return;
    setSaving("saving");
    try {
      const fragments = splitDocToCards(html, textSize);
      const plan = planCardSync(
        fragments,
        cards.map((c) => ({ id: c.id, position: c.position, content_html: c.content_html })),
      );

      for (const u of plan.updates) {
        const { error } = await supabase
          .from("cards")
          .update({ content_html: u.content_html, position: u.position })
          .eq("id", u.id);
        if (error) throw error;
      }

      const insertedRows: Card[] = [];
      if (plan.inserts.length > 0) {
        const { data, error } = await supabase
          .from("cards")
          .insert(
            plan.inserts.map((i) => ({
              manuscript_id: manuscript.id,
              user_id: user.id,
              position: i.position,
              role: manuscript.mode,
              content_html: i.content_html,
            })),
          )
          .select();
        if (error) throw error;
        if (data) insertedRows.push(...data);
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
        if (u) next.push({ ...c, content_html: u.content_html, position: u.position });
        else next.push(c);
      }
      next.push(...insertedRows);
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
  }

  async function patchCard(cardId: string, patch: Partial<Card>) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("cards").update(patch).eq("id", cardId);
    if (error) {
      toast({ title: "Kunde inte spara ändring", description: error.message, variant: "destructive" });
    }
  }

  async function deleteCard(cardId: string) {
    const fragIdx = cards.findIndex((c) => c.id === cardId);
    if (fragIdx < 0) return;
    const fragments = splitDocToCards(docHtml, textSize);
    const removed = fragments.filter((_, i) => i !== fragIdx);
    const newHtml = removed.join("") || "<p></p>";
    setDocHtml(newHtml);
    editorRef.current?.commands.setContent(newHtml, { emitUpdate: false });
    void persist(newHtml);
  }

  async function duplicateCard(cardId: string) {
    const fragIdx = cards.findIndex((c) => c.id === cardId);
    if (fragIdx < 0) return;
    const fragments = splitDocToCards(docHtml, textSize);
    const dup = [...fragments.slice(0, fragIdx + 1), fragments[fragIdx], ...fragments.slice(fragIdx + 1)];
    const newHtml = dup.join("");
    setDocHtml(newHtml);
    editorRef.current?.commands.setContent(newHtml, { emitUpdate: false });
    void persist(newHtml);
  }

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

  return (
    <PanelistsProvider manuscriptId={manuscript.id}>
      <SEO title={`${manuscript.title} – Editor v3 (experiment)`} />

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to={`/manus/${id}`}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Tillbaka till v1</span>
              </Link>
            </Button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-[17px] font-semibold tracking-tight truncate max-w-[260px]">
                {manuscript.title}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue border border-accent-blue/30">
                v3 · admin
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground font-mono">
                {layout.length} kort
              </span>
              <span
                className={`text-[12px] font-mono inline-flex items-center gap-1.5 ${
                  saving === "error" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                {saveLabel}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full">
          <div className="max-w-[900px] mx-auto py-8 px-4 relative">
            <div className="relative">
              {/* Chrome-lager — bg-surface kort-boxar UNDER editorn (z-0).
                  Editorn har transparent bakgrund så boxarna syns. Header/footer
                  på chromen kan klickas tack vare pointer-events-auto. */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                {layout.map((f, i) => {
                  const card = cards[i] ?? null;
                  return (
                    <CardChromeFrame
                      key={card?.id ?? `virtual-${i}`}
                      card={card}
                      number={i + 1}
                      total={layout.length}
                      topPx={f.topPx}
                      heightPx={f.heightPx}
                      isActive={i === activeIdx}
                      contentHtml={f.html}
                      showNotes={manuscript.show_notes}
                      showTimes={manuscript.show_times}
                      wpm={manuscript.wpm}
                      onChange={(patch) => card && patchCard(card.id, patch)}
                      onDelete={() => card && deleteCard(card.id)}
                      onDuplicate={() => card && duplicateCard(card.id)}
                    />
                  );
                })}
              </div>

              {/* Editor — text ovanpå chromen, transparent bg */}
              <div className="relative z-10">
                <TiptapDocEditor
                  value={docHtml}
                  onChange={handleDocChange}
                  size={textSize}
                  onEditorReady={handleEditorReady}
                  frameBreaks={frameBreaks}
                />
              </div>
            </div>

            <p className="mt-6 text-[12px] text-muted-foreground font-mono text-center">
              v3 — v1:s kort-layout ovanpå v2:s flödes-editor. Drag avstängt; ordning följer texten.
            </p>
          </div>
        </main>
      </div>
    </PanelistsProvider>
  );
}
