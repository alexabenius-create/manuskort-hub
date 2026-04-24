// State machine for Debatt-buddy v3 phase-guided flow.
// Pure function: given the turns + the user's role, return what can/should happen next.

export type TurnKind =
  | "own_speech" // X holds the speech
  | "opponent_speech" // Y holds the speech (when X is replier)
  | "opponent_input" // legacy v2 free Y input
  | "own_reply" // legacy v2
  | "reply" // a replier's reply on a speech
  | "rebuttal" // speech-holder's rebuttal on a specific reply
  | "rebuttal_waived"; // speech-holder declined to rebut a specific reply

export type UserRole = "speaker" | "replier";

export interface PhaseTurn {
  id: string;
  position: number;
  kind: TurnKind;
  parent_turn_id: string | null;
  speaker_label: string;
  round_number: number;
}

export type ActionId =
  | "write_own_speech"
  | "log_opponent_speech"
  | "write_own_reply_to_opponent_speech" // X is replier and reacts to Y:s anförande
  | "log_opponent_reply" // log a Y-reply on X:s anförande
  | "write_rebuttal" // write rebuttal to a specific reply
  | "waive_rebuttal" // explicitly waive
  | "end_round" // close the current round
  | "start_new_round"; // begin a fresh anförande/round

export interface PhaseAction {
  id: ActionId;
  label: string;
  hint?: string;
  primary?: boolean;
  // Context payload to feed into the draft cards
  parentTurnId?: string | null;
  parentSpeakerLabel?: string;
}

export type PhaseId =
  | "empty"
  | "speaker_awaiting_speech"
  | "replier_awaiting_opponent_speech"
  | "replies_open" // X (speaker) has spoken; replies may come in
  | "opponent_speech_open" // Y has spoken; X (replier) may reply or wait
  | "awaiting_rebuttal" // a reply needs to be addressed
  | "round_complete"; // ready to start next round or end

export interface PhaseState {
  phase: PhaseId;
  activeSpeechId: string | null;
  activeRound: number;
  pendingReplyId: string | null; // reply that needs rebuttal/waive
  pendingReplyLabel: string;
  actions: PhaseAction[];
}

function isSpeech(t: PhaseTurn): boolean {
  return t.kind === "own_speech" || t.kind === "opponent_speech";
}

function isReply(t: PhaseTurn): boolean {
  return t.kind === "reply" || t.kind === "opponent_input" || t.kind === "own_reply";
}

function isRebuttalOrWaive(t: PhaseTurn): boolean {
  return t.kind === "rebuttal" || t.kind === "rebuttal_waived";
}

export function computePhase(turnsIn: PhaseTurn[], userRole: UserRole): PhaseState {
  const turns = [...turnsIn].sort((a, b) => a.position - b.position);

  // Empty thread
  if (turns.length === 0) {
    if (userRole === "speaker") {
      return {
        phase: "speaker_awaiting_speech",
        activeSpeechId: null,
        activeRound: 1,
        pendingReplyId: null,
        pendingReplyLabel: "",
        actions: [
          {
            id: "write_own_speech",
            label: "Skriv mitt anförande",
            hint: "Börja debatten med ditt huvudanförande — AI skärper texten.",
            primary: true,
          },
        ],
      };
    }
    return {
      phase: "replier_awaiting_opponent_speech",
      activeSpeechId: null,
      activeRound: 1,
      pendingReplyId: null,
      pendingReplyLabel: "",
      actions: [
        {
          id: "log_opponent_speech",
          label: "Lägg in motdebattörens anförande",
          hint: "Skriv ner vad anförande-hållaren sa innan du skriver din replik.",
          primary: true,
        },
      ],
    };
  }

  // Find the latest round and its speech
  const latestRound = turns[turns.length - 1].round_number || 1;
  const roundTurns = turns.filter((t) => (t.round_number || 1) === latestRound);
  const speech = roundTurns.find(isSpeech) ?? null;

  // Replies in this round, ordered
  const replies = roundTurns.filter(isReply);
  const rebuttals = roundTurns.filter(isRebuttalOrWaive);

  // For each reply, has it been addressed (rebut or waive)?
  const addressedParentIds = new Set(
    rebuttals.map((r) => r.parent_turn_id).filter((x): x is string => Boolean(x)),
  );
  const pendingReply = replies.find((r) => !addressedParentIds.has(r.id)) ?? null;

  // CASE A: User is replier, latest turn is an opponent_speech with no own reply yet from X
  if (userRole === "replier" && speech?.kind === "opponent_speech") {
    const ownReplies = replies.filter((r) => r.kind === "reply" && r.speaker_label === "X");
    if (ownReplies.length === 0) {
      return {
        phase: "opponent_speech_open",
        activeSpeechId: speech.id,
        activeRound: latestRound,
        pendingReplyId: null,
        pendingReplyLabel: "",
        actions: [
          {
            id: "write_own_reply_to_opponent_speech",
            label: "Skriv min replik",
            hint: "AI bygger din replik på motdebattörens anförande och din ståndpunkt.",
            primary: true,
            parentTurnId: speech.id,
          },
          { id: "start_new_round", label: "Avsluta — starta ny runda" },
        ],
      };
    }
    // X has replied; now potentially Y rebuts? In replier-mode we treat the round as done after own reply.
    return {
      phase: "round_complete",
      activeSpeechId: speech.id,
      activeRound: latestRound,
      pendingReplyId: null,
      pendingReplyLabel: "",
      actions: [
        { id: "log_opponent_speech", label: "Lägg in nytt anförande från Y", primary: true },
        { id: "start_new_round", label: "Starta ny runda (jag håller anförandet)" },
      ],
    };
  }

  // CASE B: User is speaker, X's anförande exists in latest round
  if (speech?.kind === "own_speech") {
    if (pendingReply) {
      const label = pendingReply.speaker_label || "Replikant";
      return {
        phase: "awaiting_rebuttal",
        activeSpeechId: speech.id,
        activeRound: latestRound,
        pendingReplyId: pendingReply.id,
        pendingReplyLabel: label,
        actions: [
          {
            id: "write_rebuttal",
            label: `Skriv genmäle till ${label}`,
            hint: `${label} har lagt en replik. AI bemöter den punktvis.`,
            primary: true,
            parentTurnId: pendingReply.id,
            parentSpeakerLabel: label,
          },
          {
            id: "waive_rebuttal",
            label: "Avstå genmäle",
            hint: "Markera att du valt att inte bemöta denna replik.",
            parentTurnId: pendingReply.id,
            parentSpeakerLabel: label,
          },
          { id: "log_opponent_reply", label: "Lägg in en till replik" },
        ],
      };
    }
    // No pending replies — speaker may add more replies, end round, or start new round
    return {
      phase: "replies_open",
      activeSpeechId: speech.id,
      activeRound: latestRound,
      pendingReplyId: null,
      pendingReplyLabel: "",
      actions: [
        {
          id: "log_opponent_reply",
          label: "Lägg in en replik från motdebattör",
          hint: "Lägg till nästa replikant som begärt replik på ditt anförande.",
          primary: true,
        },
        {
          id: "start_new_round",
          label: "Starta nytt anförande",
          hint: "Avsluta denna runda och håll ett nytt anförande.",
        },
      ],
    };
  }

  // Fallback (shouldn't normally hit): treat as round complete
  return {
    phase: "round_complete",
    activeSpeechId: speech?.id ?? null,
    activeRound: latestRound,
    pendingReplyId: null,
    pendingReplyLabel: "",
    actions: [
      userRole === "speaker"
        ? { id: "start_new_round", label: "Starta nytt anförande", primary: true }
        : { id: "log_opponent_speech", label: "Lägg in nytt anförande från Y", primary: true },
    ],
  };
}

// Suggest next speaker label for a Y-reply: A, B, C, …
export function nextReplierLabel(turns: PhaseTurn[], round: number): string {
  const used = new Set(
    turns
      .filter((t) => (t.round_number || 1) === round && t.kind === "reply" && t.speaker_label !== "X")
      .map((t) => t.speaker_label),
  );
  const letters = "ABCDEFGHIJKLMN".split("");
  for (const l of letters) {
    const candidate = `Replikant ${l}`;
    if (!used.has(candidate)) return candidate;
  }
  return "Replikant";
}
