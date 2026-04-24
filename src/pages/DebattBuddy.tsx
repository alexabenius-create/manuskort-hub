import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Lock,
  Loader2,
  MessageSquare,
  Mic,
  MessageSquareReply,
  ChevronDown,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useBetaAccess } from "@/hooks/useBetaAccess";
import { useAiUsage } from "@/hooks/useAiUsage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { IssueUpload } from "@/components/debate/IssueUpload";
import { cn } from "@/lib/utils";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier, loading: tierLoading } = useTier();
  const { hasAccess, loading: betaLoading } = useBetaAccess("debate_buddy");
  const { usage: aiUsage, refresh: refreshUsage } = useAiUsage();

  const mode: Mode = searchParams.get("mode") === "reply" ? "reply" : "speech";
  const parentSessionId = searchParams.get("parent");

  const [issue, setIssue] = useState("");
  const [issueDocumentText, setIssueDocumentText] = useState("");
  const [issueFileName, setIssueFileName] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [speech, setSpeech] = useState("");
  const [ownPosition, setOwnPosition] = useState("");
  const [opponentArgs, setOpponentArgs] = useState<string[]>([""]);
  const [freedom, setFreedom] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [parent, setParent] = useState<ParentSession | null>(null);
  const [publishing, setPublishing] = useState(false);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setResult(null);
    const params = new URLSearchParams(searchParams);
    params.set("mode", next);
    if (next === "speech") params.delete("parent");
    setSearchParams(params, { replace: true });
  };

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

  // Auto-öppna ärende-sektion om något redan är ifyllt (t.ex. från parent)
  useEffect(() => {
    if ((issue.trim().length > 0 || issueFileName) && !issueOpen) setIssueOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue, issueFileName]);

  const charCap = useMemo(() => {
    if (mode === "speech") return Math.round(speech.length * (freedom / 100));
    const opp = opponentArgs.reduce((n, s) => n + s.trim().length, 0);
    return Math.max(400, Math.round(opp * (freedom / 100)));
  }, [mode, speech, opponentArgs, freedom]);

  // Status-text till sticky bottom bar
  const statusText = useMemo(() => {
    if (mode === "speech") {
      if (speech.trim().length === 0) return "Inget anförande än";
      return `${speech.length} tecken · ~${charCap} tecken efter AI`;
    }
    const argCount = opponentArgs.filter((a) => a.trim()).length;
    if (!parent && ownPosition.trim().length === 0) return "Lägg in din ståndpunkt";
    if (argCount === 0) return "Lägg till motdebattörens argument";
    return `${argCount} argument · ~${charCap} tecken svar`;
  }, [mode, speech, charCap, opponentArgs, ownPosition, parent]);

  const canRun = useMemo(() => {
    if (mode === "speech") return speech.trim().length >= 20;
    if (!parent && ownPosition.trim().length < 20) return false;
    return opponentArgs.some((a) => a.trim().length > 0);
  }, [mode, speech, parent, ownPosition, opponentArgs]);

  const clearAll = () => {
    if (mode === "speech") setSpeech("");
    else {
      setOwnPosition("");
      setOpponentArgs([""]);
    }
    setResult(null);
  };

  const run = async () => {
    if (running) return;
    setResult(null);

    if (mode === "speech") {
      if (speech.trim().length < 20) {
        toast({ title: "Skriv ditt anförande först (minst 20 tecken)", variant: "destructive" });
        return;
      }
    } else {
      if (!parent && ownPosition.trim().length < 20) {
        toast({ title: "Skriv din ståndpunkt först (minst 20 tecken)", description: "AI behöver veta vad du står för.", variant: "destructive" });
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
          ? { speech, issue, issue_document_text: issueDocumentText || undefined, maxLengthPercent: freedom }
          : {
              original_speech: parent ? (parent.improved_text || parent.original_text) : undefined,
              own_position: !parent ? ownPosition : undefined,
              issue,
              issue_document_text: issueDocumentText || undefined,
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
      // Skrolla ner till resultatet
      setTimeout(() => {
        document.getElementById("ai-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
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
      const { data: session, error: sessErr } = await supabase
        .from("debate_sessions")
        .insert({
          user_id: user.id,
          kind: mode,
          parent_session_id: mode === "reply" ? parent?.id ?? null : null,
          issue_text: issue,
          original_text: mode === "speech" ? speech : opponentArgs.join("\n\n"),
          improved_text: result.improved_text,
          card_split: result.card_split as unknown as never,
          max_length_percent: freedom,
        })
        .select()
        .single();
      if (sessErr || !session) throw new Error(sessErr?.message || "Kunde inte spara session");

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

  const parentText = parent ? (parent.improved_text || parent.original_text) : "";

  return (
    <div className="min-h-screen bg-v2-surface">
      <SEO title="Debatt-buddy – AI för debatter | Manuskort" description="AI-stöd för att skärpa debattanföranden och skapa repliker." canonical="/debatt-buddy" />
      <BackHeader />

      {/* Sticky topbar med toggle + AI-kvot */}
      <div className="sticky top-14 z-20 border-b border-v2-line bg-white/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && switchMode(v as Mode)}
            className="inline-flex p-1 rounded-full bg-v2-surface border border-v2-line"
          >
            <ToggleGroupItem
              value="speech"
              className="rounded-full px-4 py-1.5 text-[13px] gap-2 data-[state=on]:bg-v2-violet/10 data-[state=on]:text-v2-violet data-[state=on]:font-semibold"
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Debattanförande</span>
              <span className="sm:hidden">Anförande</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="reply"
              className="rounded-full px-4 py-1.5 text-[13px] gap-2 data-[state=on]:bg-v2-violet/10 data-[state=on]:text-v2-violet data-[state=on]:font-semibold"
            >
              <MessageSquareReply className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Replikskifte</span>
              <span className="sm:hidden">Replik</span>
            </ToggleGroupItem>
          </ToggleGroup>

          {aiUsage && aiUsage.limit > 0 && (
            <div className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-v2-muted">
              <Sparkles className="h-3.5 w-3.5 text-v2-violet" />
              <span><span className="font-semibold text-v2-ink">{aiUsage.remaining}</span> / {aiUsage.limit} kvar</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pt-8 pb-32">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-v2-ink">Debatt-buddy</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-v2-violet/10 text-v2-violet">BETA</span>
          </div>
          <p className="text-v2-muted text-[15px]">
            {mode === "speech"
              ? "Skärp ditt debattanförande med AI – få en vassare version uppdelad i kort."
              : "Lägg in motdebattörens argument och få förslag på motargument vid ett replikskifte."}
          </p>
        </div>

        {/* Parent context (reply från Editor) – kompakt chip */}
        {mode === "reply" && parent && (
          <Collapsible open={parentOpen} onOpenChange={setParentOpen} className="mb-4">
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-v2-line hover:border-v2-violet/40 transition-colors text-left">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-v2-violet shrink-0" />
                <span className="text-[13px] font-semibold text-v2-ink shrink-0">Originalanförande</span>
                <span className="text-[12px] text-v2-muted truncate">· {parentText.length} tecken</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-v2-muted transition-transform shrink-0", parentOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-4 rounded-2xl bg-white border border-v2-line">
                <p className="text-[14px] text-v2-ink whitespace-pre-wrap">{parentText}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ① Ärende – kollapsbart */}
        <Collapsible open={issueOpen} onOpenChange={setIssueOpen} className="mb-4">
          <div className={cn("rounded-2xl border transition-colors", issueOpen ? "bg-white border-v2-line" : "bg-white/60 border-v2-line hover:border-v2-violet/40")}>
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <StepBadge n={1} muted={!issueOpen && !issue && !issueFileName} />
                <div>
                  <div className="text-[14px] font-semibold text-v2-ink">Ärende</div>
                  <div className="text-[12px] text-v2-muted">
                    {issueFileName ? `📎 ${issueFileName}` : issue ? `${issue.slice(0, 60)}${issue.length > 60 ? "…" : ""}` : "Valfritt – ladda upp dokument eller beskriv i text"}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-v2-muted transition-transform", issueOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5 space-y-3">
                <IssueUpload
                  loadedFileName={issueFileName}
                  onParsed={({ summary, fullText, fileName }) => {
                    setIssueDocumentText(fullText);
                    setIssueFileName(fileName);
                    if (!issue.trim()) setIssue(summary);
                  }}
                  onCleared={() => {
                    setIssueDocumentText("");
                    setIssueFileName(null);
                  }}
                />
                <Textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="…eller beskriv ärendet i fritext (motion, budgetförslag, paragraf)."
                  rows={3}
                  className="rounded-xl"
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* ② Egen ståndpunkt vid fristående replikskifte */}
        {mode === "reply" && !parent && (
          <StepCard n={2} title="Din ståndpunkt" hint="AI behöver veta var du står för att hitta skiljelinjen.">
            <Textarea
              value={ownPosition}
              onChange={(e) => setOwnPosition(e.target.value)}
              placeholder="Beskriv kort vad du står för i den här frågan…"
              rows={5}
              className="rounded-xl"
            />
            <CharMeter length={ownPosition.length} cap={Math.max(400, ownPosition.length)} />
          </StepCard>
        )}

        {/* Huvudinput */}
        {mode === "speech" ? (
          <StepCard n={2} title="Ditt anförande">
            <Textarea
              value={speech}
              onChange={(e) => setSpeech(e.target.value)}
              placeholder="Klistra in eller skriv ditt anförande här…"
              rows={10}
              className="rounded-xl"
            />
            <CharMeter length={speech.length} cap={charCap || speech.length} />
          </StepCard>
        ) : (
          <StepCard
            n={parent ? 2 : 3}
            title="Argument från motdebattören"
            hint="Lägg in varje argument separat – AI bemöter dem ett i taget."
          >
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
          </StepCard>
        )}

        {/* ③/④ Frihet */}
        <StepCard
          n={mode === "speech" ? 3 : parent ? 3 : 4}
          title="AI:s frihet med längden"
          hint={`Maxlängd för AI:s svar: ~${charCap} tecken`}
        >
          <div className="flex flex-wrap gap-2">
            {FREEDOM_PRESETS.map((p) => {
              const active = freedom === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFreedom(p.value)}
                  className={cn(
                    "px-4 py-2 rounded-full border text-[13px] transition-all",
                    active
                      ? "border-v2-violet bg-v2-violet/10 text-v2-violet font-semibold"
                      : "border-v2-line bg-white text-v2-ink hover:border-v2-violet/40"
                  )}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="ml-2 text-v2-muted">{p.sub}</span>
                </button>
              );
            })}
          </div>
        </StepCard>

        {/* Result */}
        {result && (
          <div id="ai-result" className="mt-12 scroll-mt-32">
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

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-v2-line bg-white/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-[12px] text-v2-muted truncate">{statusText}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="rounded-full text-v2-muted hover:text-v2-ink"
            >
              Rensa
            </Button>
            <Button
              onClick={run}
              disabled={running || !canRun}
              size="lg"
              className="rounded-full"
            >
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {mode === "speech" ? "Förbättra med AI" : "Generera replik"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBadge({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <div
      className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0",
        muted
          ? "bg-v2-surface text-v2-muted border border-v2-line"
          : "bg-v2-violet/10 text-v2-violet"
      )}
    >
      {n}
    </div>
  );
}

function StepCard({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl bg-white border border-v2-line p-5">
      <div className="flex items-start gap-3 mb-4">
        <StepBadge n={n} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-v2-ink leading-tight">{title}</h2>
          {hint && <p className="text-[12px] text-v2-muted mt-0.5">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function CharMeter({ length, cap }: { length: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((length / cap) * 100)) : 0;
  const tone =
    pct >= 95 ? "bg-orange-500" : pct >= 60 ? "bg-v2-violet" : "bg-v2-line";
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-v2-surface overflow-hidden">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-v2-muted shrink-0 tabular-nums">{length} tecken</span>
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
