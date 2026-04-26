import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Plus, Sparkles, MessagesSquare, Pencil, Check, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useBetaAccess } from "@/hooks/useBetaAccess";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { SnabbstartModal } from "@/components/debate/SnabbstartModal";

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
      .insert({ user_id: user.id, title: "Debatt – nytt manus", mode: "debate" })
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
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-v2-line bg-gradient-to-br from-v2-violet/8 via-white to-pink-50/60 p-7 sm:p-9 mb-8">
          {/* dekorativ glow */}
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-v2-violet/20 blur-3xl animate-pulse" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-pink-300/25 blur-3xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-v2-violet to-pink-500 flex items-center justify-center shadow-lg shadow-v2-violet/30 animate-scale-in">
                  <MessagesSquare className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 backdrop-blur text-v2-violet border border-v2-violet/20">
                  ✨ Beta
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-v2-ink leading-[1.05]">
                Debatt-<span className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 bg-clip-text text-transparent">buddy</span>
              </h1>
              <p className="text-v2-muted text-[15px] mt-2 max-w-md">
                Din AI-coach för anföranden, repliker och genmälen — alltid redo i sidan.
              </p>
            </div>
            <Button
              onClick={createThread}
              disabled={creating}
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all border-0"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Ny debatt
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-v2-muted">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : threads.length === 0 ? (
          <div className="relative overflow-hidden text-center py-16 rounded-3xl bg-gradient-to-br from-white via-v2-violet/5 to-pink-50/50 border border-v2-line">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_0%,hsl(var(--v2-violet)/0.15),transparent_60%)]" />
            <div className="relative">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-v2-violet to-pink-500 flex items-center justify-center shadow-lg shadow-v2-violet/30 mb-4 animate-scale-in">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-v2-ink mb-2">Dags för din första debatt</h2>
              <p className="text-v2-muted mb-6 text-[14px] max-w-xs mx-auto">Berätta vad det handlar om — buddyn fixar struktur, argument och repliker.</p>
              <Button
                onClick={createThread}
                disabled={creating}
                className="rounded-full bg-gradient-to-r from-v2-violet to-pink-500 hover:from-v2-violet/90 hover:to-pink-500/90 shadow-lg shadow-v2-violet/25 hover:shadow-xl hover:shadow-v2-violet/40 transition-all hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 mr-2" /> Skapa min första debatt
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {threads.map((t, idx) => {
              const isEditing = editingId === t.id;
              return (
                <li key={t.id} style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }} className="animate-fade-in">
                  <div
                    onClick={() => openThread(t)}
                    className={`group relative w-full text-left flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border transition-all ${
                      isEditing
                        ? "border-v2-violet/50 shadow-md shadow-v2-violet/10"
                        : "border-v2-line hover:border-v2-violet/40 hover:shadow-md hover:shadow-v2-violet/10 hover:-translate-y-0.5 cursor-pointer"
                    }`}
                  >
                    {/* vänsterkant accent vid hover */}
                    {!isEditing && (
                      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-gradient-to-b from-v2-violet to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-v2-violet/15 to-pink-500/15 flex items-center justify-center shrink-0 group-hover:from-v2-violet/25 group-hover:to-pink-500/25 transition-colors">
                          <MessagesSquare className="h-3.5 w-3.5 text-v2-violet" strokeWidth={2.5} />
                        </span>
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
