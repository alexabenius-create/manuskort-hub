import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Plus, Sparkles, MessagesSquare, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useBetaAccess } from "@/hooks/useBetaAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

interface ThreadRow {
  id: string;
  title: string;
  topic_area: string;
  updated_at: string;
  manuscript_id: string | null;
}

export default function DebattBuddy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const { hasAccess, loading: betaLoading } = useBetaAccess("debate_buddy");
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("debate_threads")
        .select("id, title, topic_area, updated_at, manuscript_id")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      setLoading(false);
      if (!error && data) setThreads(data as ThreadRow[]);
    })();
  }, [user]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (t: ThreadRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(t.id);
    setEditValue(t.title || "");
  };

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (id: string) => {
    const newTitle = editValue.trim().slice(0, 120);
    if (!newTitle) {
      cancelEdit();
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("debate_threads")
      .update({ title: newTitle })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Kunde inte byta titel", description: error.message, variant: "destructive" });
      return;
    }
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)));
    setEditingId(null);
    setEditValue("");
  };

  const createThread = async () => {
    if (!user || creating) return;
    setCreating(true);

    // 1. Skapa manus
    const { data: manus, error: mErr } = await supabase
      .from("manuscripts")
      .insert({ user_id: user.id, title: "Debatt – nytt manus" })
      .select("id")
      .single();
    if (mErr || !manus) {
      setCreating(false);
      toast({ title: "Kunde inte skapa manus", description: mErr?.message, variant: "destructive" });
      return;
    }

    // 2. Skapa tråd kopplad till manus
    const { data: thread, error: tErr } = await supabase
      .from("debate_threads")
      .insert({ user_id: user.id, title: "Ny debatt", manuscript_id: manus.id })
      .select("id")
      .single();
    setCreating(false);
    if (tErr || !thread) {
      toast({ title: "Kunde inte skapa debatt", description: tErr?.message, variant: "destructive" });
      return;
    }

    navigate(`/manus/${manus.id}?debattbuddy=${thread.id}`);
  };

  const openThread = (t: ThreadRow) => {
    if (editingId === t.id) return;
    if (t.manuscript_id) {
      navigate(`/manus/${t.manuscript_id}?debattbuddy=${t.id}`);
    } else {
      // Legacy-tråd utan manus → gamla flödet
      navigate(`/debatt-buddy/${t.id}`);
    }
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
      <SEO title="Debatt-buddy – AI för debatter | Manuskort" description="Chatta med en AI-coach som hjälper dig förbereda anföranden, repliker och genmälen." canonical="/debatt-buddy" />
      <BackHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-v2-ink">Debatt-buddy</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-v2-violet/10 text-v2-violet">BETA</span>
            </div>
            <p className="text-v2-muted text-[15px]">Chatta med en AI-coach medan du jobbar i manuset.</p>
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
            <p className="text-v2-muted mb-5 text-[14px]">Starta en ny för att börja chatta med Debatt-buddy.</p>
            <Button onClick={createThread} disabled={creating} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Skapa min första debatt
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <li key={t.id}>
                  <div
                    onClick={() => openThread(t)}
                    className={`group w-full text-left flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-v2-line transition-colors ${isEditing ? "border-v2-violet/40" : "hover:border-v2-violet/40 cursor-pointer"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessagesSquare className="h-4 w-4 text-v2-violet shrink-0" />
                        {isEditing ? (
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveEdit(t.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit(e);
                              }
                            }}
                            disabled={saving}
                            maxLength={120}
                            className="h-8 text-[15px] font-semibold"
                          />
                        ) : (
                          <span className="text-[15px] font-semibold text-v2-ink truncate">{t.title}</span>
                        )}
                        {!t.manuscript_id && !isEditing && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-v2-muted/10 text-v2-muted">klassisk</span>
                        )}
                      </div>
                      {t.topic_area && !isEditing && (
                        <div className="text-[12px] text-v2-muted mt-1">🏷 {t.topic_area}</div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            void saveEdit(t.id);
                          }}
                          disabled={saving}
                          aria-label="Spara titel"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={cancelEdit}
                          disabled={saving}
                          aria-label="Avbryt"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => startEdit(t, e)}
                          aria-label="Byt namn"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[11px] text-v2-muted">
                          {new Date(t.updated_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
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
