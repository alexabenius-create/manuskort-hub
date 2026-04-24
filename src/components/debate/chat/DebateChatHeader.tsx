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
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-v2-line bg-gradient-to-r from-v2-violet/10 to-transparent rounded-t-2xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-v2-violet/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-v2-violet" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-v2-ink text-[14px] leading-tight truncate">Debatt-buddy</div>
          <div className="text-[11px] text-v2-muted truncate">{phaseLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onToggleExpand} aria-label={expanded ? "Minska" : "Förstora"}>
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onMinimize} aria-label="Minimera">
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
