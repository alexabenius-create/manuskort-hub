import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Mic, MessageSquareReply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { ThreadHeader } from "@/components/debate/ThreadHeader";
import {
  TurnCardOpponentDraft,
  TurnCardOpponentDisplay,
} from "@/components/debate/TurnCardOpponent";
import { TurnCardOwnDraft, TurnCardOwnDisplay } from "@/components/debate/TurnCardOwn";

interface DebateThread {
  id: string;
  title: string;
  topic_area: string;
  issue_text: string;
  issue_document_text: string;
  issue_document_filename: string | null;
  own_position: string;
}

interface DebateTurn {
  id: string;
  position: number;
  kind: "own_speech" | "opponent_input" | "own_reply";
  opponent_input_mode: "structured" | "freeform" | null;
  source_text: string;
  ai_output_text: string;
  ai_card_split: { title: string; content: string }[];
  ai_rationale: string;
}

type DraftMode = "none" | "own_speech" | "own_reply" | "opponent";

export default function DebattBuddyThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<DebateThread | null>(null);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftMode, setDraftMode] = useState<DraftMode>("none");

  const fetchAll = useCallback(async () => {
    if (!threadId) return;
    const [threadRes, turnsRes] = await Promise.all([
      supabase
        .from("debate_threads")
        .select("id, title, topic_area, issue_text, issue_document_text, issue_document_filename, own_position")
        .eq("id", threadId)
        .maybeSingle(),
      supabase
        .from("debate_turns")
        .select("id, position, kind, opponent_input_mode, source_text, ai_output_text, ai_card_split, ai_rationale")
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

  if (loading || !thread) {
    return (
      <div className="min-h-screen bg-v2-surface flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-v2-muted" />
      </div>
    );
  }

  const nextPosition = turns.length;
  const lastTurn = turns[turns.length - 1];
  // Föreslå standard-nästa beroende på vad som hänt
  const suggestedNext: "own" | "opponent" =
    !lastTurn || lastTurn.kind === "opponent_input" ? "own" : "opponent";
  const suggestedOwnKind: "own_speech" | "own_reply" =
    turns.some((t) => t.kind === "own_speech") ? "own_reply" : "own_speech";

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
        <ThreadHeader thread={thread} onChanged={(patch) => setThread({ ...thread, ...patch })} />

        {turns.length > 0 && (
          <div className="space-y-3">
            {turns.map((turn) =>
              turn.kind === "opponent_input" ? (
                <TurnCardOpponentDisplay
                  key={turn.id}
                  position={turn.position}
                  sourceText={turn.source_text}
                  mode={turn.opponent_input_mode}
                />
              ) : (
                <TurnCardOwnDisplay
                  key={turn.id}
                  position={turn.position}
                  turnKind={turn.kind}
                  sourceText={turn.source_text}
                  aiOutputText={turn.ai_output_text}
                  cardSplit={turn.ai_card_split || []}
                  rationale={turn.ai_rationale}
                />
              ),
            )}
          </div>
        )}

        {draftMode === "opponent" && (
          <TurnCardOpponentDraft
            threadId={thread.id}
            position={nextPosition}
            onAdded={() => {
              setDraftMode("none");
              fetchAll();
            }}
            onCancel={() => setDraftMode("none")}
          />
        )}

        {(draftMode === "own_speech" || draftMode === "own_reply") && (
          <TurnCardOwnDraft
            threadId={thread.id}
            position={nextPosition}
            turnKind={draftMode}
            onGenerated={() => {
              setDraftMode("none");
              fetchAll();
            }}
            onCancel={() => setDraftMode("none")}
          />
        )}

        {draftMode === "none" && (
          <div className="rounded-2xl border border-dashed border-v2-line bg-white/50 p-5 text-center space-y-3">
            <p className="text-[13px] text-v2-muted">Lägg till nästa tur i debatten</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={suggestedNext === "own" ? "default" : "outline"}
                onClick={() => setDraftMode(suggestedOwnKind)}
                className="rounded-full"
              >
                <Mic className="h-4 w-4 mr-2" />
                {suggestedOwnKind === "own_speech" ? "Mitt anförande" : "Mitt genmäle"}
              </Button>
              <Button
                variant={suggestedNext === "opponent" ? "default" : "outline"}
                onClick={() => setDraftMode("opponent")}
                className="rounded-full"
              >
                <MessageSquareReply className="h-4 w-4 mr-2" />
                Y säger något
              </Button>
              {suggestedOwnKind === "own_reply" && (
                <Button
                  variant="ghost"
                  onClick={() => setDraftMode("own_speech")}
                  className="rounded-full text-v2-muted"
                >
                  <Plus className="h-4 w-4 mr-1" /> Nytt anförande
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
