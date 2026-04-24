import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Plus, Sparkles, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useBetaAccess } from "@/hooks/useBetaAccess";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

interface ThreadRow {
  id: string;
  title: string;
  topic_area: string;
  updated_at: string;
}

export default function DebattBuddy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const { hasAccess, loading: betaLoading } = useBetaAccess("debate_buddy");
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("debate_threads")
        .select("id, title, topic_area, updated_at")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      setLoading(false);
      if (!error && data) setThreads(data as ThreadRow[]);
    })();
  }, [user]);

  const createThread = async () => {
    if (!user || creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("debate_threads")
      .insert({ user_id: user.id, title: "Ny debatt" })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Kunde inte skapa debatt", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/debatt-buddy/${data.id}`);
  };

  if (tierLoading || betaLoading) {
    return (
      <div className="min-h-screen bg-v2-surface flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-v2-muted" />
      </div>
    );
  }

  if (tier === "free") {
    return (
      <div className="min-h-screen bg-v2-surface">
        <BackHeader />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <Lock className="h-10 w-10 mx-auto text-v2-muted mb-4" />
          <h1 className="font-display text-3xl font-semibold text-v2-ink mb-3">Debatt-buddy kräver PRO</h1>
          <p className="text-v2-muted mb-6">Uppgradera för att låsa upp AI-stödda debattverktyg.</p>
          <Button onClick={() => navigate("/priser")}>Se priser</Button>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-v2-surface">
        <BackHeader />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <Lock className="h-10 w-10 mx-auto text-v2-muted mb-4" />
          <h1 className="font-display text-3xl font-semibold text-v2-ink mb-3">
            Debatt-buddy <span className="text-[12px] font-semibold uppercase tracking-wider align-middle ml-2 px-2 py-0.5 rounded-full bg-v2-violet/10 text-v2-violet">BETA</span>
          </h1>
          <p className="text-v2-muted">Funktionen är fortfarande i beta och låses upp manuellt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-v2-surface">
      <SEO title="Debatt-buddy – AI för debatter | Manuskort" description="Trådbaserade debattsessioner med AI som följer hela debatten." canonical="/debatt-buddy" />
      <BackHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-v2-ink">Debatt-buddy</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-v2-violet/10 text-v2-violet">BETA</span>
            </div>
            <p className="text-v2-muted text-[15px]">Dina debattsessioner — AI följer hela tråden.</p>
          </div>
          <Button onClick={createThread} disabled={creating} className="rounded-full">
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Ny debatt
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-v2-muted">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white border border-v2-line">
            <Sparkles className="h-8 w-8 mx-auto text-v2-violet mb-3" />
            <h2 className="font-display text-xl font-semibold text-v2-ink mb-2">Ingen debatt än</h2>
            <p className="text-v2-muted mb-5 text-[14px]">Starta en ny för att börja förbereda anförande och repliker.</p>
            <Button onClick={createThread} disabled={creating} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Skapa min första debatt
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/debatt-buddy/${t.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-v2-line hover:border-v2-violet/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MessagesSquare className="h-4 w-4 text-v2-violet shrink-0" />
                      <span className="text-[15px] font-semibold text-v2-ink truncate">{t.title}</span>
                    </div>
                    {t.topic_area && (
                      <div className="text-[12px] text-v2-muted mt-1">🏷 {t.topic_area}</div>
                    )}
                  </div>
                  <span className="text-[11px] text-v2-muted shrink-0">
                    {new Date(t.updated_at).toLocaleDateString("sv-SE")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function BackHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-v2-line bg-white/85 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
        <Link to="/bibliotek" className="inline-flex items-center gap-2 text-[14px] text-v2-muted hover:text-v2-ink">
          <ArrowLeft className="h-4 w-4" /> Tillbaka till biblioteket
        </Link>
      </div>
    </header>
  );
}
