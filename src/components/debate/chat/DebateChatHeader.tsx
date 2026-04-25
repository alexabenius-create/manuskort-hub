import { Maximize2, Minimize2, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  expanded: boolean;
  phase?: string;
  onToggleExpand: () => void;
  onMinimize: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  intake_issue: "Beskriv ärendet",
  intake_mode: "Välj läge",
  drafting_speech: "Anförande",
  awaiting_perform: "Framför anförandet",
  post_perform_check: "Efter framförande",
  intake_opponent_name: "Motdebattör",
  intake_opponent_args: "Motargument",
  generating_rebuttal: "Genmäle",
  idle: "Redo",
};

export function DebateChatHeader({ expanded, phase, onToggleExpand, onMinimize }: Props) {
  const phaseLabel = phase ? PHASE_LABELS[phase] || phase : "Redo";
  return (
    <div className="relative flex items-center justify-between gap-2 px-4 py-3 border-b border-v2-line bg-gradient-to-br from-indigo-50 via-white to-pink-50/60 rounded-t-2xl overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-10 -left-6 h-24 w-24 rounded-full bg-indigo-400/20 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -top-8 right-10 h-20 w-20 rounded-full bg-pink-400/20 blur-2xl" />
      <div className="relative flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 ring-2 ring-white">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-v2-ink text-[14px] leading-tight truncate flex items-center gap-1.5">
            Debatt-buddy
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
          <div className="text-[11px] text-v2-muted truncate">{phaseLabel}</div>
        </div>
      </div>
      <div className="relative flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/70" onClick={onToggleExpand} aria-label={expanded ? "Minska" : "Förstora"}>
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/70" onClick={onMinimize} aria-label="Minimera">
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
