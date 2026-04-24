import { useState } from "react";
import { Mic, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
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

interface Props {
  threadId: string;
  position: number;
  turnKind: "own_speech" | "own_reply";
  onGenerated: () => void;
  onCancel?: () => void;
}

export function TurnCardOwnDraft({ threadId, position, turnKind, onGenerated, onCancel }: Props) {
  const [text, setText] = useState("");
  const [freedom, setFreedom] = useState(100);
  const [running, setRunning] = useState(false);

  const isReply = turnKind === "own_reply";

  const generate = async () => {
    if (running) return;
    if (text.trim().length < 20) {
      toast({ title: "Skriv minst 20 tecken först", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("debate-turn", {
        body: {
          thread_id: threadId,
          turn_kind: turnKind,
          new_source_text: text,
          maxLengthPercent: freedom,
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
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-v2-violet/30 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center text-[12px] font-semibold shrink-0">
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-v2-violet" />
          <h3 className="text-[15px] font-semibold text-v2-ink">
            {isReply ? "Mitt genmäle" : "Mitt anförande"}
          </h3>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          isReply
            ? "Skriv ditt utkast till genmäle… AI tar med hela debatten i kontexten."
            : "Klistra in eller skriv ditt anförande här…"
        }
        rows={isReply ? 6 : 10}
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

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-full">
            Avbryt
          </Button>
        )}
        <Button type="button" onClick={generate} disabled={running} className="rounded-full">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {isReply ? "Generera genmäle" : "Förbättra med AI"}
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
}: {
  position: number;
  turnKind: "own_speech" | "own_reply";
  sourceText: string;
  aiOutputText: string;
  cardSplit: CardSplit[];
  rationale: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const isReply = turnKind === "own_reply";

  return (
    <div className="rounded-2xl bg-white border border-v2-line p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-v2-violet/10 text-v2-violet flex items-center justify-center text-[12px] font-semibold shrink-0">
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-v2-violet" />
          <h3 className="text-[14px] font-semibold text-v2-ink">
            {isReply ? "Mitt genmäle" : "Mitt anförande"}
          </h3>
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
