import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { TiptapDocEditor } from "@/components/editor/TiptapDocEditor";
import { CardChromeFrame } from "@/components/editor/CardChromeFrame";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { joinCardsToDoc, splitDocToCards, planCardSync } from "@/lib/docSplit";
import type { TextSize } from "@/lib/cardLimits";
import type { Database } from "@/integrations/supabase/types";
import type { Editor as TiptapEditorType } from "@tiptap/react";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

/**
 * EditorV3 — v1:s kort-chrome ovanpå v2:s flödes-editor.
 *
 * En enda Tiptap-instans. Chrome-ramar (nummer, anteckning, cues, more-menu)
 * ritas absolut-positionerade per virtuellt kort. Drag är avstängt — ordning
 * följer textflödet.
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

  // Beräknade fragment + Y-positioner per fragment-block (mätt mot editor-DOM)
  const [frames, setFrames] = useState<{ topPx: number; heightPx: number; html: string }[]>([]);
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

  const handleEditorReady = (ed: TiptapEditorType | null) => {
    editorRef.current = ed;
    editorRootRef.current = ed ? (ed.view.dom as HTMLElement) : null;
    if (ed) {
      ed.on("selectionUpdate", scheduleMeasure);
      ed.on("update", scheduleMeasure);
    }
  };

  const textSize: TextSize = (manuscript?.text_size as TextSize) ?? "md";

  // Beräkna fragment + Y-positioner när dokumentet ändras eller fönstret resizes
  function scheduleMeasure() {
    if (measureRafRef.current) cancelAnimationFrame(measureRafRef.current);
    measureRafRef.current = requestAnimationFrame(measureFrames);
  }

  function measureFrames() {
    const root = editorRootRef.current;
    if (!root || !manuscript) return;

    const fragments = splitDocToCards(docHtml, textSize);
    const editorRect = root.getBoundingClientRect();

    // Mappa varje fragment till en text-offset → hitta Y av första och sista karaktär
    const offsets: number[] = [];
    let acc = 0;
    for (const frag of fragments) {
      const tmp = document.createElement("div");
      tmp.innerHTML = frag;
      acc += (tmp.textContent ?? "").length;
      offsets.push(acc);
    }

    const next: { topPx: number; heightPx: number; html: string }[] = [];
    let prevBottom = 0;
    for (let i = 0; i < fragments.length; i++) {
      const startOffset = i === 0 ? 0 : offsets[i - 1];
      const endOffset = offsets[i];
      const startY = findYAtTextOffset(root, startOffset, "top");
      const endY = findYAtTextOffset(root, endOffset, "bottom");
      const top = startY !== null ? startY - editorRect.top : prevBottom;
      const bottom = endY !== null ? endY - editorRect.top : top + 120;
      const heightPx = Math.max(60, bottom - top);
      next.push({ topPx: top, heightPx, html: fragments[i] });
      prevBottom = bottom;
    }
    setFrames(next);

    // Aktivt kort = där caret står
    const sel = editorRef.current?.state.selection;
    if (sel) {
      let anchorOffset = 0;
      const docNode = editorRef.current!.state.doc;
      anchorOffset = docNode.textBetween(0, sel.from, "\n", "\n").length;
      let idx = 0;
      for (let i = 0; i < offsets.length; i++) {
        if (anchorOffset <= offsets[i]) { idx = i; break; }
        idx = i;
      }
      setActiveIdx(idx);
    }
  }

  // Mät om vid resize
  useEffect(() => {
    const onResize = () => scheduleMeasure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mät när html eller storlek ändras
  useEffect(() => {
    scheduleMeasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docHtml, textSize]);

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

  // Patch på enskilt korts metadata (notes, cues, panik) — sparas direkt
  async function patchCard(cardId: string, patch: Partial<Card>) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("cards").update(patch).eq("id", cardId);
    if (error) {
      toast({ title: "Kunde inte spara ändring", description: error.message, variant: "destructive" });
    }
  }

  async function deleteCard(cardId: string) {
    // I v3 = ta bort textintervallet ur editorn → spara
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
    <>
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
                {frames.length} {frames.length === 1 ? "kort" : "kort"}
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
              {/* Editor — nedanför chrome i z-stack, så texten är klickbar */}
              <div className="relative z-0">
                <TiptapDocEditor
                  value={docHtml}
                  onChange={handleDocChange}
                  size={textSize}
                  onEditorReady={handleEditorReady}
                />
              </div>

              {/* Chrome-ramar — ovanpå men pointer-events: none förutom på knappar */}
              <div className="absolute inset-0 z-10" aria-hidden="false">
                {frames.map((f, i) => {
                  const card = cards[i] ?? null;
                  return (
                    <CardChromeFrame
                      key={card?.id ?? `virtual-${i}`}
                      card={card}
                      number={i + 1}
                      total={frames.length}
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
            </div>

            <p className="mt-6 text-[12px] text-muted-foreground font-mono text-center">
              v3 — v1:s kort-chrome ovanpå v2:s flödes-editor. Drag avstängt; ordning följer texten.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

/** Hitta Y-koordinat (top eller bottom) för en text-offset i editor-DOM. */
function findYAtTextOffset(
  root: HTMLElement,
  targetOffset: number,
  edge: "top" | "bottom",
): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let acc = 0;
  let node: Node | null;
  let lastRect: DOMRect | null = null;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? "";
    if (acc + text.length >= targetOffset) {
      const offsetInNode = Math.max(0, targetOffset - acc);
      const range = document.createRange();
      try {
        range.setStart(node, Math.min(offsetInNode, text.length));
        range.setEnd(node, Math.min(offsetInNode, text.length));
      } catch {
        return null;
      }
      const rects = range.getClientRects();
      const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
      return edge === "top" ? rect.top : rect.bottom;
    }
    acc += text.length;
    lastRect = null;
  }
  return lastRect ? (edge === "top" ? lastRect.top : lastRect.bottom) : null;
}
