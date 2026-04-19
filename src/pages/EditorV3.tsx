import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { TiptapDocEditor } from "@/components/editor/TiptapDocEditor";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  cardsToDocHtml,
  rowsToCardAttrs,
  docToCardNodes,
  planCardSyncFromDoc,
} from "@/lib/cardDocSerialize";
import { PanelistsProvider } from "@/hooks/usePanelists";
import type { Database } from "@/integrations/supabase/types";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import { DOMSerializer } from "prosemirror-model";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

/**
 * EditorV3 — NodeView-arkitektur (Fas 1).
 *
 * Varje DB-kort = en cardBlock-nod i ProseMirror-dokumentet. Chrome ritas
 * via CardBlockNodeView (riktig DOM, inte overlay). Persistens 1:1 mot
 * `cards`-tabellen via diff i `planCardSyncFromDoc`.
 *
 * Inga mätningar, inga decorations, inga overlays.
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
  const [cardCount, setCardCount] = useState(0);

  const editorRef = useRef<TiptapEditorType | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const hydratedRef = useRef(false);

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
      setDocHtml(cardsToDocHtml(rows));
      setCardCount(Math.max(1, rows.length));
      setLoading(false);
    })();
  }, [id, navigate]);

  /**
   * Efter att Tiptap mountat dokumentet: gå igenom top-level cardBlock-noder
   * och sätt attrs (cues, notes, target_seconds, …) i editor-state utan att
   * trigga onUpdate. HTML-laddningen sätter bara struktur + cardId — resten
   * ligger i tabellen och måste tankas in.
   */
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
        // Vänta en frame så setContent hunnit appliceras
        requestAnimationFrame(() => {
          if (editorRef.current === ed) {
            hydrateAttrs(ed);
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
    if (!editorRef.current || !manuscript) return;
    initializedRef.current = false;
    hydratedRef.current = false;
    const t = window.setTimeout(() => {
      if (editorRef.current) {
        hydrateAttrs(editorRef.current);
        initializedRef.current = true;
        hydratedRef.current = true;
      }
    }, 16);
    return () => window.clearTimeout(t);
  }, [docHtml, hydrateAttrs, manuscript]);

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

      // Uppdatera cardNumber/totalCards på alla noder utan att skapa historik
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

  // Debounced autosave
  const handleDocChange = (html: string) => {
    setDocHtml(html);
    // Skydd mot race: triggar inte spara förrän hydrering är klar
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
    if (!hydratedRef.current) return; // extra skydd
    setSaving("saving");
    try {
      // STEG 1: säkerställ att varje cardBlock har ett cardId. Genererar
      // UUID lokalt för nya kort och skriver tillbaka i editor-state innan
      // vi serialiserar — då blir DB-skriv idempotent (upsert på id).
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

      // STEG 2: serialisera doc → kort-noder
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

      // STEG 3: updates
      for (const u of plan.updates) {
        const { error } = await supabase.from("cards").update(u.patch).eq("id", u.id);
        if (error) throw error;
      }

      // STEG 4: inserts — använd upsert med vårt lokalt-genererade id
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

      // STEG 5: deletes
      if (plan.deletes.length > 0) {
        const { error } = await supabase.from("cards").delete().in("id", plan.deletes);
        if (error) throw error;
      }

      // Uppdatera lokal cards-cache
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
                v3 · admin · Fas 1
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground font-mono">
                {cardCount} kort
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
          <div className="max-w-[900px] mx-auto py-8 px-4">
            <TiptapDocEditor
              value={docHtml}
              onChange={handleDocChange}
              size={(manuscript.text_size as "sm" | "md" | "lg") ?? "md"}
              onEditorReady={handleEditorReady}
            />

            <p className="mt-6 text-[12px] text-muted-foreground font-mono text-center">
              v3 Fas 1 — NodeView-arkitektur. Enter/Backspace flödar mellan kort. Drag, cue-edit och meny kommer i Fas 2.
            </p>
          </div>
        </main>
      </div>
    </PanelistsProvider>
  );
}
