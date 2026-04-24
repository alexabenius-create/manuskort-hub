import { useState } from "react";
import { Mic, Loader2, Sparkles, MessageSquare, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FREEDOM_PRESETS = [
  { label: "Strikt", value: 100 },
  { label: "+10 %", value: 110 },
  { label: "+25 %", value: 125 },
  { label: "+50 %", value: 150 },
];

interface CardSplit {
  title: string;
  content: string;
}

export type OwnTurnKind = "own_speech" | "own_reply" | "rebuttal";

interface Props {
  threadId: string;
  position: number;
  turnKind: OwnTurnKind;
  parentTurnId?: string | null;
  roundNumber?: number;
  contextLabel?: string; // e.g. "Genmäle till Replikant A"
  onGenerated: () => void;
  onCancel?: () => void;
}

const titleFor = (kind: OwnTurnKind, fallback?: string): string => {
  if (fallback) return fallback;
  if (kind === "own_speech") return "Mitt anförande";
  if (kind === "rebuttal") return "Mitt genmäle";
  return "Min replik";
};

const placeholderFor = (kind: OwnTurnKind): string => {
  if (kind === "own_speech") return "Klistra in eller skriv ditt anförande här…";
  if (kind === "rebuttal") return "Skriv ditt utkast till genmäle på den specifika repliken — AI bemöter punktvis.";
  return "Skriv ditt utkast till replik — AI tar med motdebattörens anförande i kontexten.";
};

export function TurnCardOwnDraft({
  threadId,
  position,
  turnKind,
  parentTurnId,
  roundNumber,
  contextLabel,
  onGenerated,
  onCancel,
}: Props) {
  const [text, setText] = useState("");
  const [freedom, setFreedom] = useState(100);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const generate = async () => {
    if (running) return;
    if (text.trim().length < 20) {
      toast({ title: "Skriv minst 20 tecken först", variant: "destructive" });
      return;
    }
    setRunning(true);
    setElapsed(0);
    const startedAt = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250);
    try {
      const { data, error } = await supabase.functions.invoke("debate-turn", {
        body: {
          thread_id: threadId,
          turn_kind: turnKind,
          new_source_text: text,
          maxLengthPercent: freedom,
          parent_turn_id: parentTurnId ?? null,
          round_number: roundNumber ?? 1,
        },
      });
      if (error) {
        const msg = (data as any)?.error || error.message || "Okänt fel";
        const map: Record<string, string> = {
          monthly_limit_reached: "Månadens AI-kvot är slut.",
          ai_credits_exhausted: "AI-tjänsten saknar kredit just nu.",
          ai_rate_limited: "För många AI-anrop just nu, vänta en stund.",
          ai_timeout: "AI-tjänsten tog för lång tid. Försök igen.",
          beta_locked: "BETA-funktionen är inte upplåst.",
          pro_required: "PRO krävs för Debatt-buddy.",
        };
        toast({ title: "Kunde inte generera", description: map[msg] || msg, variant: "destructive" });
        return;
      }
      onGenerated();
    } finally {
      window.clearInterval(tick);
      setRunning(false);
    }
  };

  const heading = titleFor(turnKind, contextLabel);
  const verb = turnKind === "own_speech" ? "anförande" : turnKind === "rebuttal" ? "genmäle" : "replik";

  return (
    <div className="rounded-2xl bg-white border border-v2-violet/30 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center text-[12px] font-semibold shrink-0">
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-v2-violet" />
          <h3 className="text-[15px] font-semibold text-v2-ink">{heading}</h3>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholderFor(turnKind)}
        rows={turnKind === "own_speech" ? 10 : 6}
        className="rounded-xl"
      />
      <div className="text-right text-[11px] text-v2-muted">{text.length} tecken</div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted">
          AI:s frihet med längden
        </div>
        <div className="flex flex-wrap gap-2">
          {FREEDOM_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFreedom(p.value)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] border transition-all",
                freedom === p.value
                  ? "border-v2-violet bg-v2-violet/10 text-v2-violet font-semibold"
                  : "border-v2-line bg-white text-v2-muted hover:border-v2-violet/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {running && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-v2-violet/5 border border-v2-violet/20">
          <Loader2 className="h-4 w-4 animate-spin text-v2-violet shrink-0" />
          <div className="flex-1 text-[12.5px] text-v2-ink">
            <div className="font-semibold">AI skriver ditt {verb}…</div>
            <div className="text-v2-muted text-[11.5px]">
              Tar oftast 5–15 sekunder. {elapsed > 0 && <>Förflutet: {elapsed}s</>}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={running} className="rounded-full">
            Avbryt
          </Button>
        )}
        <Button type="button" onClick={generate} disabled={running} className="rounded-full">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {running ? "Genererar…" : turnKind === "own_speech" ? "Förbättra med AI" : `Generera ${verb}`}
        </Button>
      </div>
    </div>
  );
}

export function TurnCardOwnDisplay({
  position,
  turnKind,
  sourceText,
  aiOutputText,
  cardSplit,
  rationale,
  contextLabel,
}: {
  position: number;
  turnKind: OwnTurnKind;
  sourceText: string;
  aiOutputText: string;
  cardSplit: CardSplit[];
  rationale: string;
  contextLabel?: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const heading = titleFor(turnKind, contextLabel);

  return (
    <div className="rounded-2xl bg-white border border-v2-line p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center text-[12px] font-semibold shrink-0">
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-v2-violet" />
          <h3 className="text-[14px] font-semibold text-v2-ink">{heading}</h3>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-v2-violet/10 text-v2-violet font-semibold inline-flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        </div>
      </div>

      {rationale && (
        <div className="p-3 rounded-xl bg-v2-violet/5 border border-v2-violet/20 text-[12.5px] text-v2-ink">
          <MessageSquare className="inline h-3 w-3 mr-1.5 text-v2-violet" />
          {rationale}
        </div>
      )}

      <div className="space-y-2">
        {cardSplit.length > 0 ? (
          cardSplit.map((c, i) => (
            <div key={i} className="p-3 rounded-xl bg-v2-surface border border-v2-line">
              <div className="text-[10px] uppercase tracking-wider text-v2-muted font-semibold mb-1">
                Kort {i + 1}
              </div>
              <div className="font-display text-[15px] font-semibold text-v2-ink mb-1">{c.title}</div>
              <p className="text-[14px] text-v2-ink whitespace-pre-wrap leading-relaxed">{c.content}</p>
            </div>
          ))
        ) : (
          <p className="text-[14px] text-v2-ink whitespace-pre-wrap">{aiOutputText}</p>
        )}
      </div>

      {sourceText && (
        <div>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="text-[12px] text-v2-muted hover:text-v2-ink underline"
          >
            {showOriginal ? "Dölj mitt original" : "Visa mitt original"}
          </button>
          {showOriginal && (
            <div className="mt-2 p-3 rounded-xl bg-v2-surface text-[13px] text-v2-muted whitespace-pre-wrap">
              {sourceText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TurnCardWaivedDisplay({
  position,
  contextLabel,
}: {
  position: number;
  contextLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-v2-surface/60 border border-dashed border-v2-line p-4 flex items-center gap-3">
      <div className="h-7 w-7 rounded-full bg-v2-line/40 text-v2-muted flex items-center justify-center text-[12px] font-semibold shrink-0">
        {position + 1}
      </div>
      <div className="text-[13px] text-v2-muted">
        {contextLabel || "Du valde att avstå genmäle."}
      </div>
    </div>
  );
}
