import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThreadHeader } from "@/components/debate/ThreadHeader";
import { TurnCardOpponentDraft, type OpponentTurnKind } from "@/components/debate/TurnCardOpponent";
import { TurnCardOwnDraft, type OwnTurnKind } from "@/components/debate/TurnCardOwn";
import { PhaseCard } from "@/components/debate/PhaseCard";
import { GuidedStep } from "@/components/debate/GuidedStep";
import { CollapsedTurnStrip } from "@/components/debate/CollapsedTurnStrip";
import { TurnReadOnlySheet } from "@/components/debate/TurnReadOnlySheet";
import { RoleSelectorStep } from "@/components/debate/RoleSelectorStep";
import { RoleSelectorDialog } from "@/components/debate/RoleSelectorDialog";
import { PerformSpeechStep } from "@/components/debate/PerformSpeechStep";
import {
  computePhase,
  nextReplierLabel,
  type PhaseAction,
  type PhaseTurn,
  type UserRole,
  type TurnKind,
} from "@/lib/debatePhase";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";

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
  manuscript_id: string | null;
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

const roleConfirmedKey = (threadId: string) => `debattbuddy:role-confirmed:${threadId}`;
const performedKey = (threadId: string) => `debattbuddy:performed:${threadId}`;

const loadPerformedSet = (threadId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(performedKey(threadId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const savePerformedSet = (threadId: string, set: Set<string>) => {
  try {
    localStorage.setItem(performedKey(threadId), JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
};

const isOwnSpeechKind = (k: string): boolean =>
  k === "own_speech" || k === "own_reply" || k === "rebuttal";

export default function DebattBuddyThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<DebateThread | null>(null);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftState>({ kind: "none" });
  const [waiving, setWaiving] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [activeReadTurnId, setActiveReadTurnId] = useState<string | null>(null);
  const [performedTurnIds, setPerformedTurnIds] = useState<Set<string>>(new Set());

  // Ladda "performed"-set när tråd-id ändras
  useEffect(() => {
    if (!threadId) return;
    setPerformedTurnIds(loadPerformedSet(threadId));
  }, [threadId]);

  // Analytics: editor_opened när tråden mountas
  useEffect(() => {
    if (!threadId) return;
    void trackEvent(ANALYTICS_EVENTS.EDITOR_OPENED, {}, { thread_id: threadId });
  }, [threadId]);

  const markPerformed = useCallback(
    (turnId: string) => {
      if (!threadId) return;
      setPerformedTurnIds((prev) => {
        const next = new Set(prev);
        next.add(turnId);
        savePerformedSet(threadId, next);
        return next;
      });
    },
    [threadId],
  );

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
        .select("id, position, kind, opponent_input_mode, source_text, ai_output_text, ai_card_split, ai_rationale, parent_turn_id, speaker_label, round_number, manuscript_id")
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

  // En gång rollen bekräftats (eller om tråden redan har turer) — kom ihåg det.
  useEffect(() => {
    if (!threadId) return;
    const stored = localStorage.getItem(roleConfirmedKey(threadId));
    if (stored === "1") setRoleConfirmed(true);
  }, [threadId]);

  useEffect(() => {
    // Om tråden redan har turer så är rollen "implicit bekräftad".
    if (turns.length > 0 && !roleConfirmed) {
      setRoleConfirmed(true);
      if (threadId) localStorage.setItem(roleConfirmedKey(threadId), "1");
    }
  }, [turns.length, roleConfirmed, threadId]);

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

  const turnById = new Map(turns.map((t) => [t.id, t]));
  const activeReadTurn = activeReadTurnId ? turnById.get(activeReadTurnId) ?? null : null;
  const activeReadParent =
    activeReadTurn?.parent_turn_id ? turnById.get(activeReadTurn.parent_turn_id) ?? null : null;

  // En "pending perform"-turn = senaste egna anförande/replik/genmäle som inte
  // ännu markerats som genomförd lokalt.
  const lastTurn = turns[turns.length - 1] ?? null;
  const performTurn =
    lastTurn && isOwnSpeechKind(lastTurn.kind) && !performedTurnIds.has(lastTurn.id)
      ? lastTurn
      : null;

  // Determine which guided step to show
  const showRoleStep = !roleConfirmed && turns.length === 0;
  const showDraft = draft.kind !== "none";
  const showPerform = !showRoleStep && !showDraft && Boolean(performTurn);
  const stepKey = showRoleStep
    ? "role"
    : showDraft
    ? `draft-${draft.kind}-${(draft as any).turnKind}-${nextPosition}`
    : showPerform
    ? `perform-${performTurn!.id}`
    : `phase-${phase.phase}-${turns.length}`;

  // Header summary line for collapsible header
  const summaryParts: string[] = [];
  if (thread.user_role === "replier") summaryParts.push("Replikant");
  else summaryParts.push("Talare");
  if (thread.topic_area) summaryParts.push(thread.topic_area);
  if (thread.issue_document_filename) summaryParts.push(`📎 ${thread.issue_document_filename}`);

  return (
    <div className="min-h-screen bg-v2-surface flex flex-col">
      <SEO
        title={`${thread.title} | Debatt-buddy`}
        description="Trådbaserad debattsession med AI."
        canonical={`/debatt-buddy/${thread.id}`}
      />

      <header className="sticky top-0 z-30 border-b border-v2-line bg-white/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <Link
            to="/debatt-buddy"
            className="inline-flex items-center gap-2 text-[14px] text-v2-muted hover:text-v2-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Mina debatter
          </Link>
          <div className="text-[13px] font-semibold text-v2-ink truncate max-w-[60%]">
            {thread.title || "Ny debatt"}
          </div>
        </div>
      </header>

      {/* Chip-rad med historik (sticky strax under headern) */}
      <CollapsedTurnStrip
        turns={turns}
        activeTurnId={activeReadTurnId}
        onSelect={(id) => setActiveReadTurnId(id)}
      />

      {/* Komprimerat trådhuvud (collapsible) — innehåller titel, roll, sakområde, ärende, ståndpunkt */}
      <div className="border-b border-v2-line bg-white/60">
        <div className="max-w-3xl mx-auto px-6">
          <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 py-3 text-left group">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted">
                  Debattens uppgifter
                </div>
                <div className="text-[12.5px] text-v2-ink/80 truncate">
                  {summaryParts.join(" · ")}
                </div>
              </div>
              <span className="text-[12px] text-v2-muted group-hover:text-v2-ink shrink-0 inline-flex items-center gap-1">
                {headerOpen ? "Dölj" : "Visa & redigera"}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", headerOpen && "rotate-180")}
                />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pb-6 pt-2">
                <ThreadHeader
                  thread={thread}
                  onEditRole={() => setRoleDialogOpen(true)}
                  onChanged={(patch) => setThread({ ...thread, ...patch })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <RoleSelectorDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        value={thread.user_role}
        onChange={async (role) => {
          const { error } = await supabase
            .from("debate_threads")
            .update({ user_role: role })
            .eq("id", thread.id);
          if (!error) setThread({ ...thread, user_role: role });
        }}
      />

      <TurnReadOnlySheet
        open={Boolean(activeReadTurnId)}
        onOpenChange={(o) => !o && setActiveReadTurnId(null)}
        turn={activeReadTurn}
        parentTurn={activeReadParent}
      />

      <main className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        {showRoleStep ? (
          <GuidedStep
            stepKey={stepKey}
            eyebrow="Steg 1 av 2"
            title="Vilken roll har du i debatten?"
            description="Välj din roll så vägleder verktyget dig genom rätt steg i rätt ordning."
          >
            <RoleSelectorStep
              value={thread.user_role}
              onPick={async (role) => {
                if (role !== thread.user_role) {
                  const { error } = await supabase
                    .from("debate_threads")
                    .update({ user_role: role })
                    .eq("id", thread.id);
                  if (error) {
                    toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
                    return;
                  }
                  setThread({ ...thread, user_role: role });
                }
                if (threadId) localStorage.setItem(roleConfirmedKey(threadId), "1");
                setRoleConfirmed(true);
              }}
            />
          </GuidedStep>
        ) : draft.kind === "opponent" ? (
          <GuidedStep stepKey={stepKey}>
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
          </GuidedStep>
        ) : draft.kind === "own" ? (
          <GuidedStep stepKey={stepKey}>
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
          </GuidedStep>
        ) : showPerform && performTurn ? (
          <GuidedStep stepKey={stepKey}>
            <PerformSpeechStep
              turn={performTurn}
              threadTitle={thread.title}
              allTurns={turns}
              onContinue={() => markPerformed(performTurn.id)}
              onManuscriptCreated={(manuscriptId) => {
                // Uppdatera lokal state direkt så knappen byts till "Öppna manuskort"/"Starta presentation"
                setTurns((prev) =>
                  prev.map((t) => (t.id === performTurn.id ? { ...t, manuscript_id: manuscriptId } : t)),
                );
              }}
            />
          </GuidedStep>
        ) : (
          <GuidedStep stepKey={stepKey}>
            <PhaseCard state={phase} onAction={handleAction} />
          </GuidedStep>
        )}
      </main>
    </div>
  );
}
