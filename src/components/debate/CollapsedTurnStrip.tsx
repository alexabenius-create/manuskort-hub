import { Mic, MessageSquareReply, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StripTurn {
  id: string;
  position: number;
  kind: string; // TurnKind
  parent_turn_id: string | null;
  speaker_label: string;
  round_number: number;
}

interface Props {
  turns: StripTurn[];
  activeTurnId?: string | null;
  onSelect: (turnId: string) => void;
}

const labelFor = (turn: StripTurn, parentLabel?: string): string => {
  switch (turn.kind) {
    case "own_speech":
      return `Anförande R${turn.round_number}`;
    case "opponent_speech":
      return `${turn.speaker_label || "Y"}:s anförande R${turn.round_number}`;
    case "reply":
      return turn.speaker_label || "Replik";
    case "opponent_input":
      return "Y säger";
    case "own_reply":
      return "Min replik";
    case "rebuttal":
      return parentLabel ? `Genmäle → ${parentLabel}` : "Genmäle";
    case "rebuttal_waived":
      return parentLabel ? `Avstått → ${parentLabel}` : "Avstått";
    default:
      return "Tur";
  }
};

const iconFor = (kind: string) => {
  if (kind === "own_speech" || kind === "opponent_speech") return Mic;
  if (kind === "rebuttal") return Sparkles;
  if (kind === "rebuttal_waived") return X;
  return MessageSquareReply;
};

const styleFor = (kind: string): string => {
  if (kind === "own_speech" || kind === "rebuttal" || kind === "own_reply") {
    return "bg-v2-violet/10 text-v2-violet border-v2-violet/20 hover:bg-v2-violet/15";
  }
  if (kind === "rebuttal_waived") {
    return "bg-v2-surface text-v2-muted border-dashed border-v2-line hover:border-v2-muted/40";
  }
  return "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100";
};

export function CollapsedTurnStrip({ turns, activeTurnId, onSelect }: Props) {
  if (turns.length === 0) return null;

  const byId = new Map(turns.map((t) => [t.id, t]));
  // Group by round for visual separators
  const groups: { round: number; items: StripTurn[] }[] = [];
  for (const t of turns) {
    const r = t.round_number || 1;
    const last = groups[groups.length - 1];
    if (!last || last.round !== r) groups.push({ round: r, items: [t] });
    else last.items.push(t);
  }

  return (
    <div className="sticky top-14 z-20 bg-v2-surface/85 backdrop-blur-md border-b border-v2-line">
      <div className="max-w-3xl mx-auto px-6 py-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted shrink-0 mr-1">
            Historik
          </span>
          {groups.map((g, gi) => (
            <div key={g.round} className="flex items-center gap-1.5 shrink-0">
              {gi > 0 && (
                <span className="text-v2-line text-[11px] px-0.5" aria-hidden>
                  •
                </span>
              )}
              {g.items.map((t) => {
                const Icon = iconFor(t.kind);
                const parent = t.parent_turn_id ? byId.get(t.parent_turn_id) : undefined;
                const label = labelFor(t, parent?.speaker_label);
                const isActive = activeTurnId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium whitespace-nowrap transition-colors",
                      styleFor(t.kind),
                      isActive && "ring-2 ring-v2-violet/40 ring-offset-1 ring-offset-v2-surface",
                    )}
                    title={`Tur ${t.position + 1}: ${label}`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
