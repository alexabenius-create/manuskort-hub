import { Mic, MessageSquareReply, Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhaseAction, PhaseState } from "@/lib/debatePhase";

interface Props {
  state: PhaseState;
  onAction: (action: PhaseAction) => void;
}

const iconFor = (id: PhaseAction["id"]) => {
  switch (id) {
    case "write_own_speech":
    case "start_new_round":
      return <Mic className="h-4 w-4 mr-2" />;
    case "log_opponent_speech":
    case "log_opponent_reply":
      return <MessageSquareReply className="h-4 w-4 mr-2" />;
    case "write_rebuttal":
    case "write_own_reply_to_opponent_speech":
      return <Sparkles className="h-4 w-4 mr-2" />;
    case "waive_rebuttal":
      return <X className="h-4 w-4 mr-2" />;
    case "end_round":
      return <ArrowRight className="h-4 w-4 mr-2" />;
  }
};

const phaseLabel = (state: PhaseState): string => {
  switch (state.phase) {
    case "speaker_awaiting_speech":
      return "Steg 2 — Skriv ditt anförande";
    case "replier_awaiting_opponent_speech":
      return "Steg 2 — Lägg in motdebattörens anförande";
    case "opponent_speech_open":
      return "Din tur — skriv replik";
    case "replies_open":
      return `Runda ${state.activeRound} — repliker väntas`;
    case "awaiting_rebuttal":
      return `Replik från ${state.pendingReplyLabel} — välj nästa steg`;
    case "round_complete":
      return `Runda ${state.activeRound} avslutad`;
    default:
      return "Nästa steg";
  }
};

export function PhaseCard({ state, onAction }: Props) {
  const primary = state.actions.find((a) => a.primary) ?? state.actions[0];
  const secondaries = state.actions.filter((a) => a !== primary);

  if (!primary) return null;

  return (
    <div className="rounded-2xl border border-v2-violet/30 bg-gradient-to-br from-v2-violet/5 to-white p-6 space-y-4">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-violet">
          {phaseLabel(state)}
        </div>
        {primary.hint && <p className="text-[14px] text-v2-ink">{primary.hint}</p>}
      </div>

      <Button
        onClick={() => onAction(primary)}
        className="w-full sm:w-auto rounded-full h-11 px-6 text-[14px] font-semibold"
        size="lg"
      >
        {iconFor(primary.id)}
        {primary.label}
      </Button>

      {secondaries.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-v2-line/60 text-[12px]">
          <span className="text-v2-muted">Eller:</span>
          {secondaries.map((a) => (
            <button
              key={a.id + (a.parentTurnId ?? "")}
              onClick={() => onAction(a)}
              className="text-v2-muted hover:text-v2-ink underline-offset-2 hover:underline"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
