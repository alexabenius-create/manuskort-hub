import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { ThreadHeader } from "@/components/debate/ThreadHeader";
import {
  TurnCardOpponentDraft,
  TurnCardOpponentDisplay,
  type OpponentTurnKind,
} from "@/components/debate/TurnCardOpponent";
import {
  TurnCardOwnDraft,
  TurnCardOwnDisplay,
  TurnCardWaivedDisplay,
  type OwnTurnKind,
} from "@/components/debate/TurnCardOwn";
import { PhaseCard } from "@/components/debate/PhaseCard";
import { RoleSelectorDialog } from "@/components/debate/RoleSelectorDialog";
import {
  computePhase,
  nextReplierLabel,
  type PhaseAction,
  type PhaseTurn,
  type UserRole,
  type TurnKind,
} from "@/lib/debatePhase";

interface DebateThread {
  id: string;
  title: string;
  topic_area: string;
  issue_text: string;
  issue_document_text: string;
  issue_document_filename: string | null;
  own_position: string;
  user_role: UserRole;
}

interface DebateTurn {
  id: string;
  position: number;
  kind: TurnKind;
  opponent_input_mode: "structured" | "freeform" | null;
  source_text: string;
  ai_output_text: string;
  ai_card_split: { title: string; content: string }[];
  ai_rationale: string;
  parent_turn_id: string | null;
  speaker_label: string;
  round_number: number;
}

type DraftState =
  | { kind: "none" }
  | {
      kind: "own";
      turnKind: OwnTurnKind;
      parentTurnId: string | null;
      roundNumber: number;
      contextLabel?: string;
    }
  | {
      kind: "opponent";
      turnKind: OpponentTurnKind;
      parentTurnId: string | null;
      defaultSpeakerLabel: string;
      roundNumber: number;
    };

export default function DebattBuddyThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<DebateThread | null>(null);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftState>({ kind: "none" });
  const [waiving, setWaiving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!threadId) return;
    const [threadRes, turnsRes] = await Promise.all([
      supabase
        .from("debate_threads")
        .select("id, title, topic_area, issue_text, issue_document_text, issue_document_filename, own_position, user_role")
        .eq("id", threadId)
        .maybeSingle(),
      supabase
        .from("debate_turns")
        .select("id, position, kind, opponent_input_mode, source_text, ai_output_text, ai_card_split, ai_rationale, parent_turn_id, speaker_label, round_number")
        .eq("thread_id", threadId)
        .order("position", { ascending: true }),
    ]);
    setLoading(false);
    if (threadRes.error || !threadRes.data) {
      toast({ title: "Tråden hittades inte", variant: "destructive" });
      navigate("/debatt-buddy");
      return;
    }
    setThread(threadRes.data as DebateThread);
    if (!turnsRes.error && turnsRes.data) {
      setTurns(turnsRes.data as unknown as DebateTurn[]);
    }
  }, [threadId, navigate]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  const phaseTurns: PhaseTurn[] = useMemo(
    () =>
      turns.map((t) => ({
        id: t.id,
        position: t.position,
        kind: t.kind,
        parent_turn_id: t.parent_turn_id,
        speaker_label: t.speaker_label,
        round_number: t.round_number,
      })),
    [turns],
  );

  const phase = useMemo(
    () => computePhase(phaseTurns, thread?.user_role ?? "speaker"),
    [phaseTurns, thread?.user_role],
  );

  const nextPosition = turns.length;

  const handleWaiveRebuttal = useCallback(
    async (parentReplyId: string, roundNumber: number) => {
      if (!threadId || !user || waiving) return;
      setWaiving(true);
      const { error } = await supabase.from("debate_turns").insert({
        thread_id: threadId,
        user_id: user.id,
        position: nextPosition,
        kind: "rebuttal_waived",
        source_text: "",
        parent_turn_id: parentReplyId,
        round_number: roundNumber,
        speaker_label: "X",
      });
      setWaiving(false);
      if (error) {
        toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
        return;
      }
      fetchAll();
    },
    [threadId, user, waiving, nextPosition, fetchAll],
  );

  const handleAction = useCallback(
    (action: PhaseAction) => {
      if (!thread) return;
      const round = phase.activeRound || 1;
      switch (action.id) {
        case "write_own_speech":
          setDraft({
            kind: "own",
            turnKind: "own_speech",
            parentTurnId: null,
            roundNumber: turns.length === 0 ? 1 : round + 1,
          });
          break;
        case "start_new_round":
          setDraft({
            kind: "own",
            turnKind: "own_speech",
            parentTurnId: null,
            roundNumber: round + 1,
          });
          break;
        case "log_opponent_speech":
          setDraft({
            kind: "opponent",
            turnKind: "opponent_speech",
            parentTurnId: null,
            defaultSpeakerLabel: "Y",
            roundNumber: turns.length === 0 ? 1 : round + 1,
          });
          break;
        case "log_opponent_reply":
          setDraft({
            kind: "opponent",
            turnKind: "reply",
            parentTurnId: phase.activeSpeechId,
            defaultSpeakerLabel: nextReplierLabel(phaseTurns, round),
            roundNumber: round,
          });
          break;
        case "write_own_reply_to_opponent_speech":
          setDraft({
            kind: "own",
            turnKind: "own_reply",
            parentTurnId: action.parentTurnId ?? phase.activeSpeechId,
            roundNumber: round,
            contextLabel: "Min replik",
          });
          break;
        case "write_rebuttal":
          if (action.parentTurnId) {
            setDraft({
              kind: "own",
              turnKind: "rebuttal",
              parentTurnId: action.parentTurnId,
              roundNumber: round,
              contextLabel: `Genmäle till ${action.parentSpeakerLabel || "Replikant"}`,
            });
          }
          break;
        case "waive_rebuttal":
          if (action.parentTurnId) {
            handleWaiveRebuttal(action.parentTurnId, round);
          }
          break;
      }
    },
    [thread, phase, turns.length, phaseTurns, handleWaiveRebuttal],
  );

  if (loading || !thread) {
    return (
      <div className="min-h-screen bg-v2-surface flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-v2-muted" />
      </div>
    );
  }

  // Render turns. Look up parent labels for rebuttals.
  const turnById = new Map(turns.map((t) => [t.id, t]));

  return (
    <div className="min-h-screen bg-v2-surface">
      <SEO title={`${thread.title} | Debatt-buddy`} description="Trådbaserad debattsession med AI." canonical={`/debatt-buddy/${thread.id}`} />
      <header className="sticky top-0 z-30 border-b border-v2-line bg-white/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link to="/debatt-buddy" className="inline-flex items-center gap-2 text-[14px] text-v2-muted hover:text-v2-ink">
            <ArrowLeft className="h-4 w-4" /> Mina debatter
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6 pb-32">
        <ThreadHeader
          thread={thread}
          showRoleSelector={turns.length === 0}
          onChanged={(patch) => setThread({ ...thread, ...patch })}
        />

        {turns.length > 0 && (
          <div className="space-y-3">
            {turns.map((turn) => {
              if (turn.kind === "opponent_input" || turn.kind === "opponent_speech" || turn.kind === "reply") {
                return (
                  <TurnCardOpponentDisplay
                    key={turn.id}
                    position={turn.position}
                    sourceText={turn.source_text}
                    mode={turn.opponent_input_mode}
                    kind={turn.kind as OpponentTurnKind}
                    speakerLabel={turn.speaker_label}
                  />
                );
              }
              if (turn.kind === "rebuttal_waived") {
                const parent = turn.parent_turn_id ? turnById.get(turn.parent_turn_id) : null;
                return (
                  <TurnCardWaivedDisplay
                    key={turn.id}
                    position={turn.position}
                    contextLabel={
                      parent
                        ? `Du valde att avstå genmäle på ${parent.speaker_label || "repliken"}.`
                        : "Du valde att avstå genmäle."
                    }
                  />
                );
              }
              // own_speech | own_reply | rebuttal
              const parent = turn.parent_turn_id ? turnById.get(turn.parent_turn_id) : null;
              const ctx =
                turn.kind === "rebuttal" && parent
                  ? `Genmäle till ${parent.speaker_label || "replik"}`
                  : turn.kind === "own_reply"
                  ? "Min replik"
                  : undefined;
              return (
                <TurnCardOwnDisplay
                  key={turn.id}
                  position={turn.position}
                  turnKind={turn.kind as OwnTurnKind}
                  sourceText={turn.source_text}
                  aiOutputText={turn.ai_output_text}
                  cardSplit={turn.ai_card_split || []}
                  rationale={turn.ai_rationale}
                  contextLabel={ctx}
                />
              );
            })}
          </div>
        )}

        {draft.kind === "opponent" && (
          <TurnCardOpponentDraft
            threadId={thread.id}
            position={nextPosition}
            kind={draft.turnKind}
            defaultSpeakerLabel={draft.defaultSpeakerLabel}
            parentTurnId={draft.parentTurnId}
            roundNumber={draft.roundNumber}
            onAdded={() => {
              setDraft({ kind: "none" });
              fetchAll();
            }}
            onCancel={() => setDraft({ kind: "none" })}
          />
        )}

        {draft.kind === "own" && (
          <TurnCardOwnDraft
            threadId={thread.id}
            position={nextPosition}
            turnKind={draft.turnKind}
            parentTurnId={draft.parentTurnId}
            roundNumber={draft.roundNumber}
            contextLabel={draft.contextLabel}
            onGenerated={() => {
              setDraft({ kind: "none" });
              fetchAll();
            }}
            onCancel={() => setDraft({ kind: "none" })}
          />
        )}

        {draft.kind === "none" && <PhaseCard state={phase} onAction={handleAction} />}
      </main>
    </div>
  );
}
