// TODO: Radera denna fil senast 2026-05-03.
// v1/v2 är utfasade — v3 är enda aktiva editorn sedan 2026-04-19.
// Filen är frikopplad från routing och providers, men ligger kvar som referens
// under sunset-perioden.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { TiptapDocEditor } from "@/components/editor/TiptapDocEditor";
import { PageBreakOverlay } from "@/components/editor/PageBreakOverlay";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { joinCardsToDoc, splitDocToCards, planCardSync } from "@/lib/docSplit";
import type { TextSize } from "@/lib/cardLimits";
import type { Database } from "@/integrations/supabase/types";
import type { Editor as TiptapEditorType } from "@tiptap/react";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

/**
 * EditorV2 — admin-only experiment.
 *
 * En enda Tiptap-instans håller hela manuset. Sidbrytningar är virtuella
 * (overlay). Vid spara: dela upp dokumentet i kort och persistera mot
 * `cards`-tabellen — bakåtkompatibelt med v1 och presentationsläget.
 */
export default function EditorV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: tierLoading } = useTier();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const [docHtml, setDocHtml] = useState<string>("");
  const [cardCount, setCardCount] = useState(1);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const editorRef = useRef<TiptapEditorType | null>(null);
  const editorRootRef = useRef<HTMLElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Admin-skydd
  useEffect(() => {
    if (tierLoading) return;
    if (!isAdmin) {
      toast({
        title: "Endast admin",
        description: "Editor v2 är ett experiment som bara admin har tillgång till.",
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

  // Hitta editorns rot-DOM-element för overlay-mätning
  const handleEditorReady = (ed: TiptapEditorType | null) => {
    editorRef.current = ed;
    if (ed) {
      // Tiptap exponerar dom via view
      editorRootRef.current = ed.view.dom as HTMLElement;
    } else {
      editorRootRef.current = null;
    }
  };

  const textSize: TextSize = (manuscript?.text_size as TextSize) ?? "md";

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

      // 1) Updates
      for (const u of plan.updates) {
        const { error } = await supabase
          .from("cards")
          .update({ content_html: u.content_html, position: u.position })
          .eq("id", u.id);
        if (error) throw error;
      }

      // 2) Inserts
      const insertedRows: Card[] = [];
      if (plan.inserts.length > 0) {
        const { data, error } = await supabase
          .from("cards")
          .insert(
            plan.inserts.map((i) => ({
              manuscript_id: manuscript.id,
              user_id: user.id,
              position: i.position,
              role: manuscript.mode === "moderator" ? "moderator" as const : "speaker" as const,
              content_html: i.content_html,
            })),
          )
          .select();
        if (error) throw error;
        if (data) insertedRows.push(...data);
      }

      // 3) Deletes
      if (plan.deletes.length > 0) {
        const { error } = await supabase.from("cards").delete().in("id", plan.deletes);
        if (error) throw error;
      }

      // Uppdatera lokal state
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
      console.error("[EditorV2] persist error", e);
      setSaving("error");
      toast({
        title: "Kunde inte spara",
        description: e instanceof Error ? e.message : "Okänt fel",
        variant: "destructive",
      });
    }
  }

  if (loading || !manuscript) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-faint uppercase tracking-widest">Laddar v2…</p>
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
      <SEO title={`${manuscript.title} – Editor v2 (experiment)`} />

      <div className="min-h-screen bg-background flex flex-col">
        {/* Topbar */}
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
                v2 · admin
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground font-mono">
                {cardCount} {cardCount === 1 ? "kort" : "kort"}
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

        {/* Editor-kanvas */}
        <main className="flex-1 w-full">
          <div className="max-w-[900px] mx-auto py-8 px-4 relative">
            <div className="relative bg-surface rounded-2xl border border-border/60 shadow-sm">
              <TiptapDocEditor
                value={docHtml}
                onChange={handleDocChange}
                size={textSize}
                onEditorReady={handleEditorReady}
              />
              <PageBreakOverlay
                html={docHtml}
                size={textSize}
                editorRootRef={editorRootRef}
                onCardCountChange={setCardCount}
              />
            </div>

            <p className="mt-6 text-[12px] text-muted-foreground font-mono text-center">
              Experimentell editor — sidbrytningar är virtuella, beräknade i realtid mot presentations-geometrin.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
