import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TurnCardOpponentDisplay, type OpponentTurnKind } from "./TurnCardOpponent";
import { TurnCardOwnDisplay, TurnCardWaivedDisplay, type OwnTurnKind } from "./TurnCardOwn";

interface Turn {
  id: string;
  position: number;
  kind: string;
  opponent_input_mode: "structured" | "freeform" | null;
  source_text: string;
  ai_output_text: string;
  ai_card_split: { title: string; content: string }[];
  ai_rationale: string;
  parent_turn_id: string | null;
  speaker_label: string;
  round_number: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turn: Turn | null;
  parentTurn?: Turn | null;
}

export function TurnReadOnlySheet({ open, onOpenChange, turn, parentTurn }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Tur {turn ? turn.position + 1 : ""} — Runda {turn?.round_number ?? ""}</SheetTitle>
          <SheetDescription>Läsläge — tidigare turer kan inte redigeras.</SheetDescription>
        </SheetHeader>

        {turn && (
          <div>
            {(turn.kind === "opponent_input" ||
              turn.kind === "opponent_speech" ||
              turn.kind === "reply") && (
              <TurnCardOpponentDisplay
                position={turn.position}
                sourceText={turn.source_text}
                mode={turn.opponent_input_mode}
                kind={turn.kind as OpponentTurnKind}
                speakerLabel={turn.speaker_label}
              />
            )}

            {turn.kind === "rebuttal_waived" && (
              <TurnCardWaivedDisplay
                position={turn.position}
                contextLabel={
                  parentTurn
                    ? `Du valde att avstå genmäle på ${parentTurn.speaker_label || "repliken"}.`
                    : "Du valde att avstå genmäle."
                }
              />
            )}

            {(turn.kind === "own_speech" ||
              turn.kind === "own_reply" ||
              turn.kind === "rebuttal") && (
              <TurnCardOwnDisplay
                position={turn.position}
                turnKind={turn.kind as OwnTurnKind}
                sourceText={turn.source_text}
                aiOutputText={turn.ai_output_text}
                cardSplit={turn.ai_card_split || []}
                rationale={turn.ai_rationale}
                contextLabel={
                  turn.kind === "rebuttal" && parentTurn
                    ? `Genmäle till ${parentTurn.speaker_label || "replik"}`
                    : turn.kind === "own_reply"
                    ? "Min replik"
                    : undefined
                }
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
