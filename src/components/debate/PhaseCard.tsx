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

const phaseHeading = (state: PhaseState): { eyebrow: string; title: string } => {
  switch (state.phase) {
    case "speaker_awaiting_speech":
      return { eyebrow: "Steg 2", title: "Skriv ditt anförande" };
    case "replier_awaiting_opponent_speech":
      return { eyebrow: "Steg 2", title: "Lägg in motdebattörens anförande" };
    case "opponent_speech_open":
      return { eyebrow: "Din tur", title: "Skriv din replik" };
    case "replies_open":
      return { eyebrow: `Runda ${state.activeRound}`, title: "Repliker väntas" };
    case "awaiting_rebuttal":
      return {
        eyebrow: `Replik från ${state.pendingReplyLabel}`,
        title: "Välj nästa steg",
      };
    case "round_complete":
      return { eyebrow: `Runda ${state.activeRound} klar`, title: "Vad gör du nu?" };
    default:
      return { eyebrow: "", title: "Nästa steg" };
  }
};

export function PhaseCard({ state, onAction }: Props) {
  const primary = state.actions.find((a) => a.primary) ?? state.actions[0];
  const secondaries = state.actions.filter((a) => a !== primary);

  if (!primary) return null;

  const { eyebrow, title } = phaseHeading(state);

  return (
    <div className="rounded-3xl border border-v2-violet/30 bg-gradient-to-br from-v2-violet/5 via-white to-white p-8 sm:p-10 space-y-6 shadow-sm">
      <div className="text-center space-y-2.5">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-v2-violet">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-v2-ink">
          {title}
        </h2>
        {primary.hint && (
          <p className="text-[14px] text-v2-muted max-w-md mx-auto leading-relaxed">
            {primary.hint}
          </p>
        )}
      </div>

      <div className="flex justify-center pt-2">
        <Button
          onClick={() => onAction(primary)}
          className="rounded-full h-12 px-8 text-[15px] font-semibold"
          size="lg"
        >
          {iconFor(primary.id)}
          {primary.label}
        </Button>
      </div>

      {secondaries.length > 0 && (
        <div className="pt-5 border-t border-v2-line/60 space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted text-center">
            Eller
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-center sm:flex-wrap gap-2">
            {secondaries.map((a) => (
              <button
                key={a.id + (a.parentTurnId ?? "")}
                onClick={() => onAction(a)}
                className="text-[13px] text-v2-muted hover:text-v2-ink hover:bg-v2-surface px-3 py-1.5 rounded-full transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
