import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ManuscriptPDF } from "@/components/print/ManuscriptPDF";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Manuscript = Database["public"]["Tables"]["manuscripts"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];
type Panelist = Database["public"]["Tables"]["panelists"]["Row"];

type LayoutOption = "a5" | "a4-2up";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "manuskort";
}

export default function PrintView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutOption>("a5");

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("manuscripts").select("*").eq("id", id).maybeSingle(),
        supabase.from("cards").select("*").eq("manuscript_id", id).order("position"),
        supabase.from("panelists").select("*").eq("manuscript_id", id).order("position"),
      ]);
      if (cancelled) return;
      if (mRes.error || !mRes.data) {
        toast({ title: "Kunde inte ladda manus", variant: "destructive" });
        navigate("/bibliotek");
        return;
      }
      setManuscript(mRes.data);
      setCards(cRes.data ?? []);
      setPanelists(pRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, navigate]);

  const fileName = useMemo(() => {
    if (!manuscript) return "manuskort.pdf";
    return `manuskort-${slugify(manuscript.title)}.pdf`;
  }, [manuscript]);

  const pdfDoc = useMemo(() => {
    if (!manuscript) return null;
    return (
      <ManuscriptPDF
        manuscript={manuscript}
        cards={cards}
        panelists={panelists}
        layout={layout}
      />
    );
  }, [manuscript, cards, panelists, layout]);

  if (loading || !manuscript) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Laddar förhandsvisning…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title={`Skriv ut: ${manuscript.title}`} description="Generera PDF för utskrift av talkort." />

      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/manus/${id}`)}
            className="gap-1.5 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till redigering
          </Button>

          <span className="text-sm font-medium text-foreground hidden sm:block ml-4 truncate">
            {manuscript.title}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Layout-väljare */}
            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setLayout("a5")}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  layout === "a5"
                    ? "bg-accent-blue text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                A5 liggande
              </button>
              <button
                type="button"
                onClick={() => setLayout("a4-2up")}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  layout === "a4-2up"
                    ? "bg-accent-blue text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                A4 × 2
              </button>
            </div>

            {/* Ladda ned */}
            {pdfDoc && (
              <PDFDownloadLink document={pdfDoc} fileName={fileName}>
                {({ loading: pdfLoading }) => (
                  <Button
                    className="h-9 rounded-full px-4 bg-accent-blue hover:bg-accent-blue/90 text-white text-[13px] font-medium gap-1.5"
                    disabled={pdfLoading}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {pdfLoading ? "Förbereder…" : "Ladda ned PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </div>
        </div>
      </header>

      {/* Förhandsvisning */}
      <main className="flex-1 w-full">
        {cards.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-[15px]">Inga kort att skriva ut.</p>
          </div>
        ) : pdfDoc ? (
          <PDFViewer
            key={layout}
            style={{ width: "100%", height: "calc(100vh - 56px)", border: "none" }}
            showToolbar={false}
          >
            {pdfDoc}
          </PDFViewer>
        ) : null}
      </main>
    </div>
  );
}
