import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Plus, Trash2, Lock, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useBetaAccess } from "@/hooks/useBetaAccess";
import { useAiUsage } from "@/hooks/useAiUsage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

type Mode = "speech" | "reply";

interface CardSplitItem {
  title: string;
  content: string;
}

interface AiResult {
  improved_text: string;
  card_split: CardSplitItem[];
  rationale: string;
  char_count: number;
  char_cap: number;
}

interface ParentSession {
  id: string;
  issue_text: string;
  original_text: string;
  improved_text: string;
}

const FREEDOM_PRESETS: { label: string; value: number; sub: string }[] = [
  { label: "Strikt", value: 100, sub: "≈ samma längd" },
  { label: "Lite mer", value: 110, sub: "+10 %" },
  { label: "Mer", value: 125, sub: "+25 %" },
  { label: "Friare", value: 150, sub: "+50 %" },
];

export default function DebattBuddy() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const { hasAccess, loading: betaLoading } = useBetaAccess("debate_buddy");
  const { usage: aiUsage, refresh: refreshUsage } = useAiUsage();

  const mode: Mode = searchParams.get("mode") === "reply" ? "reply" : "speech";
  const parentSessionId = searchParams.get("parent");

  const [issue, setIssue] = useState("");
  const [speech, setSpeech] = useState("");
  const [opponentArgs, setOpponentArgs] = useState<string[]>([""]);
  const [freedom, setFreedom] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [parent, setParent] = useState<ParentSession | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Hämta parent-session vid reply-läge
  useEffect(() => {
    if (mode !== "reply" || !parentSessionId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("debate_sessions")
        .select("id, issue_text, original_text, improved_text")
        .eq("id", parentSessionId)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Kunde inte hitta originalanförandet", variant: "destructive" });
        return;
      }
      setParent(data as ParentSession);
      setIssue(data.issue_text || "");
    })();
  }, [mode, parentSessionId, user]);

  const charCap = useMemo(() => {
    if (mode === "speech") return Math.round(speech.length * (freedom / 100));
    const opp = opponentArgs.reduce((n, s) => n + s.trim().length, 0);
    return Math.max(400, Math.round(opp * (freedom / 100)));
  }, [mode, speech, opponentArgs, freedom]);

  const run = async () => {
    if (running) return;
    setResult(null);

    if (mode === "speech") {
      if (speech.trim().length < 20) {
        toast({ title: "Skriv ditt anförande först (minst 20 tecken)", variant: "destructive" });
        return;
      }
    } else {
      if (!parent) {
        toast({ title: "Originalanförandet saknas", variant: "destructive" });
        return;
      }
      const cleanArgs = opponentArgs.map((a) => a.trim()).filter(Boolean);
      if (cleanArgs.length === 0) {
        toast({ title: "Lägg till minst ett argument från motdebattören", variant: "destructive" });
        return;
      }
    }

    setRunning(true);
    try {
      const fnName = mode === "speech" ? "debate-improve" : "debate-counter";
      const body =
        mode === "speech"
          ? { speech, issue, maxLengthPercent: freedom }
          : {
              original_speech: parent!.improved_text || parent!.original_text,
              issue,
              opponent_arguments: opponentArgs.map((a) => a.trim()).filter(Boolean),
              maxLengthPercent: freedom,
            };

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) {
        const msg = (data as any)?.error || error.message || "Okänt fel";
        if (msg === "monthly_limit_reached") {
          toast({ title: "Månadens AI-kvot är slut", description: "Försök igen nästa månad.", variant: "destructive" });
        } else if (msg === "ai_credits_exhausted") {
          toast({ title: "AI-tjänsten saknar kredit just nu", variant: "destructive" });
        } else if (msg === "ai_rate_limited") {
          toast({ title: "För många AI-anrop just nu", description: "Vänta en stund och försök igen.", variant: "destructive" });
        } else if (msg === "beta_locked") {
          toast({ title: "BETA-funktionen är inte upplåst för dig", variant: "destructive" });
        } else if (msg === "pro_required") {
          toast({ title: "PRO krävs för Debatt-buddy", variant: "destructive" });
        } else {
          toast({ title: "AI-anrop misslyckades", description: msg, variant: "destructive" });
        }
        return;
      }

      const r = data as AiResult;
      setResult(r);
      refreshUsage();
    } catch (e) {
      toast({ title: "Fel", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const publishAsManuscript = async () => {
    if (!result || !user || publishing) return;
    setPublishing(true);
    try {
      // 1. Skapa debate_session
      const sessionPayload = {
        user_id: user.id,
        kind: mode,
        parent_session_id: mode === "reply" ? parent?.id ?? null : null,
        issue_text: issue,
        original_text: mode === "speech" ? speech : opponentArgs.join("\n\n"),
        improved_text: result.improved_text,
        card_split: result.card_split as unknown as object,
        max_length_percent: freedom,
      };
      const { data: session, error: sessErr } = await supabase
        .from("debate_sessions")
        .insert(sessionPayload)
        .select()
        .single();
      if (sessErr || !session) throw new Error(sessErr?.message || "Kunde inte spara session");

      // 2. Skapa manuscript
      const titleBase = mode === "speech" ? (issue || "Debattanförande") : `Replik – ${parent?.issue_text || "Debatt"}`;
      const title = titleBase.slice(0, 80);
      const { data: ms, error: msErr } = await supabase
        .from("manuscripts")
        .insert({
          user_id: user.id,
          title,
          mode: "debate",
          debate_session_id: session.id,
        })
        .select()
        .single();
      if (msErr || !ms) throw new Error(msErr?.message || "Kunde inte skapa manus");

      // 3. Skapa kort
      const cardRows = result.card_split.map((c, idx) => ({
        manuscript_id: ms.id,
        user_id: user.id,
        position: idx,
        role: "speaker" as const,
        title: c.title || "",
        content_html: `<p>${escapeHtml(c.content).replace(/\n/g, "</p><p>")}</p>`,
      }));
      const { error: cardErr } = await supabase.from("cards").insert(cardRows);
      if (cardErr) throw new Error(cardErr.message);

      // 4. Uppdatera session med manuscript_id
      await supabase.from("debate_sessions").update({ manuscript_id: ms.id }).eq("id", session.id);

      toast({ title: "Publicerat som manus" });
      navigate(`/manus/${ms.id}`);
    } catch (e) {
      toast({ title: "Kunde inte publicera", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  // Gating
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
          <p className="text-v2-muted">
            Funktionen är fortfarande i beta och låses upp manuellt. Hör av dig om du vill testa!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-v2-surface">
      <SEO title="Debatt-buddy – AI för debatter | Manuskort" description="AI-stöd för att skärpa debattanföranden och skapa repliker." canonical="/debatt-buddy" />
      <BackHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 pb-24">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-v2-ink">
              {mode === "speech" ? "Debatt-buddy" : "Skriv replik"}
            </h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-v2-violet/10 text-v2-violet">BETA</span>
          </div>
          <p className="text-v2-muted text-[15px]">
            {mode === "speech"
              ? "Lägg in ditt anförande och ärendet. AI skärper argumenten och delar upp talet i kort."
              : "AI hittar motargument mot motdebattörens punkter och skapar en skarp replik."}
          </p>
          {aiUsage && aiUsage.limit > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 text-[13px] text-v2-muted">
              <Sparkles className="h-3.5 w-3.5 text-v2-violet" />
              <span>{aiUsage.remaining} / {aiUsage.limit} AI-förbättringar kvar denna månad</span>
            </div>
          )}
        </div>

        {/* Parent context (reply) */}
        {mode === "reply" && parent && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-v2-line">
            <div className="text-[12px] uppercase tracking-wider text-v2-muted font-semibold mb-2">Originalanförande</div>
            <p className="text-[14px] text-v2-ink whitespace-pre-wrap line-clamp-6">{parent.improved_text || parent.original_text}</p>
          </div>
        )}

        {/* Issue (kontext) */}
        <Section label="Ärende (valfritt)">
          <Textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Beskriv det ärende som debatteras (t.ex. budgetförslag, motion, paragraf)…"
            rows={3}
            className="rounded-xl"
          />
        </Section>

        {mode === "speech" ? (
          <Section label="Ditt anförande">
            <Textarea
              value={speech}
              onChange={(e) => setSpeech(e.target.value)}
              placeholder="Klistra in eller skriv ditt anförande här…"
              rows={10}
              className="rounded-xl"
            />
            <div className="mt-1 text-right text-[12px] text-v2-muted">{speech.length} tecken</div>
          </Section>
        ) : (
          <Section label="Argument från motdebattören">
            <div className="space-y-3">
              {opponentArgs.map((arg, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={arg}
                    onChange={(e) => {
                      const next = [...opponentArgs];
                      next[i] = e.target.value;
                      setOpponentArgs(next);
                    }}
                    placeholder={`Argument ${i + 1}…`}
                    rows={2}
                    className="rounded-xl"
                  />
                  {opponentArgs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpponentArgs(opponentArgs.filter((_, j) => j !== i))}
                      className="shrink-0 mt-1 text-v2-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpponentArgs([...opponentArgs, ""])}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" /> Lägg till argument
              </Button>
            </div>
          </Section>
        )}

        {/* Frihet / längd */}
        <Section label="AI:s frihet med längden">
          <div className="flex flex-wrap gap-2">
            {FREEDOM_PRESETS.map((p) => {
              const active = freedom === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFreedom(p.value)}
                  className={`px-4 py-2 rounded-full border text-[13px] transition-all ${
                    active
                      ? "border-v2-violet bg-v2-violet/10 text-v2-violet font-semibold"
                      : "border-v2-line bg-white text-v2-ink hover:border-v2-violet/40"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="ml-2 text-v2-muted">{p.sub}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[12px] text-v2-muted">
            Maxlängd för AI:s svar: ~{charCap} tecken
          </div>
        </Section>

        <div className="mt-8 flex justify-end">
          <Button onClick={run} disabled={running} size="lg" className="rounded-full">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {mode === "speech" ? "Förbättra med AI" : "Generera replik"}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-12">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold text-v2-ink">AI-resultat</h2>
              <span className="text-[12px] text-v2-muted">
                {result.char_count} / max ~{result.char_cap} tecken
              </span>
            </div>

            {result.rationale && (
              <div className="mb-4 p-3 rounded-xl bg-v2-violet/5 border border-v2-violet/20 text-[13px] text-v2-ink">
                <MessageSquare className="inline h-3.5 w-3.5 mr-1.5 text-v2-violet" />
                {result.rationale}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {result.card_split.map((c, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border border-v2-line">
                  <div className="text-[12px] uppercase tracking-wider text-v2-muted font-semibold mb-1">Kort {i + 1}</div>
                  <div className="font-display text-lg font-semibold text-v2-ink mb-2">{c.title}</div>
                  <p className="text-[15px] text-v2-ink whitespace-pre-wrap leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResult(null)} className="rounded-full">
                Förkasta
              </Button>
              <Button onClick={publishAsManuscript} disabled={publishing} className="rounded-full">
                {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Publicera som manus
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="block text-[13px] font-semibold uppercase tracking-wider text-v2-muted mb-2">{label}</label>
      {children}
    </div>
  );
}

function BackHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-v2-line bg-white/80 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
        <Link to="/bibliotek" className="inline-flex items-center gap-2 text-[14px] text-v2-muted hover:text-v2-ink">
          <ArrowLeft className="h-4 w-4" /> Tillbaka till biblioteket
        </Link>
      </div>
    </header>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
