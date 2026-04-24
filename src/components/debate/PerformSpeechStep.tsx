import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mic, Play, Pencil, ArrowRight, MessageSquareReply, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Turn {
  id: string;
  kind: string;
  ai_output_text: string;
  ai_card_split: { title: string; content: string }[];
  source_text: string;
  manuscript_id: string | null;
  speaker_label: string;
}

interface Props {
  turn: Turn;
  threadTitle: string;
  allTurns: Turn[];
  onContinue: () => void; // användaren markerar "klart" — gå till nästa fas
  onManuscriptCreated: (manuscriptId: string) => void;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const textToHtml = (text: string): string => {
  // Konvertera till enkla paragrafer; tomma rader → ny paragraf.
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return "<p></p>";
  return blocks
    .map((b) => `<p>${escapeHtml(b).replace(/\n/g, "<br>")}</p>`)
    .join("");
};

const turnLabel = (kind: string): string => {
  if (kind === "rebuttal") return "Genmäle";
  if (kind === "own_reply") return "Replik";
  return "Anförande";
};

export function PerformSpeechStep({ turn, threadTitle, allTurns, onContinue, onManuscriptCreated }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const label = turnLabel(turn.kind);
  const hasManuscript = Boolean(turn.manuscript_id);

  const buildContentHtmlList = (): { title: string; content_html: string }[] => {
    if (turn.ai_card_split && turn.ai_card_split.length > 0) {
      return turn.ai_card_split.map((c) => ({
        title: c.title || "",
        content_html: textToHtml(c.content || ""),
      }));
    }
    const text = turn.ai_output_text || turn.source_text;
    return [{ title: label, content_html: textToHtml(text) }];
  };

  const openInEditor = async () => {
    if (!user || creating) return;

    // Om manus redan kopplats — bara navigera.
    if (turn.manuscript_id) {
      navigate(`/manus/${turn.manuscript_id}`);
      return;
    }

    setCreating(true);
    try {
      const cards = buildContentHtmlList();
      const manuscriptTitle = `${label}: ${threadTitle || "Debatt"}`;
      const { data: manus, error: mErr } = await supabase
        .from("manuscripts")
        .insert({ user_id: user.id, title: manuscriptTitle, mode: "speaker" })
        .select()
        .single();
      if (mErr || !manus) {
        toast({
          title: "Kunde inte skapa manus",
          description: mErr?.message,
          variant: "destructive",
        });
        return;
      }

      const cardRows = cards.map((c, i) => ({
        manuscript_id: manus.id,
        user_id: user.id,
        position: i,
        role: "speaker" as const,
        title: c.title,
        content_html: c.content_html,
      }));
      const { error: cErr } = await supabase.from("cards").insert(cardRows);
      if (cErr) {
        toast({
          title: "Kunde inte spara kort",
          description: cErr.message,
          variant: "destructive",
        });
        return;
      }

      // Koppla manuset till debatturen.
      await supabase
        .from("debate_turns")
        .update({ manuscript_id: manus.id })
        .eq("id", turn.id);

      onManuscriptCreated(manus.id);
      navigate(`/manus/${manus.id}`);
    } finally {
      setCreating(false);
    }
  };

  const startPresentation = () => {
    if (turn.manuscript_id) {
      navigate(`/manus/${turn.manuscript_id}/presentera`);
    }
  };

  return (
    <div className="rounded-3xl border border-v2-violet/30 bg-gradient-to-br from-v2-violet/5 via-white to-white p-8 sm:p-10 space-y-6 shadow-sm">
      <div className="text-center space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-v2-violet">
          {label} sparat
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-v2-ink">
          Dags att genomföra ditt {label.toLowerCase()}
        </h2>
        <p className="text-[14px] text-v2-muted max-w-md mx-auto leading-relaxed">
          Öppna texten som ett manuskort så kan du redigera, skriva ut eller köra
          presentationsläget i talarstolen.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button
          onClick={openInEditor}
          disabled={creating}
          className="rounded-full h-12 px-6 text-[14px] font-semibold"
          size="lg"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : hasManuscript ? (
            <Pencil className="h-4 w-4 mr-2" />
          ) : (
            <Mic className="h-4 w-4 mr-2" />
          )}
          {creating
            ? "Skapar manus…"
            : hasManuscript
            ? "Öppna manuskort"
            : "Öppna i manuskort"}
        </Button>

        {hasManuscript && (
          <Button
            type="button"
            variant="outline"
            onClick={startPresentation}
            className="rounded-full h-12 px-6 text-[14px] font-semibold"
            size="lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Starta presentation
          </Button>
        )}
      </div>

      <div className="pt-5 border-t border-v2-line/60 space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted text-center">
          När {label.toLowerCase()}t är genomfört
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={onContinue}
            className="rounded-full"
          >
            <MessageSquareReply className="h-4 w-4 mr-2" />
            {turn.kind === "own_speech" ? "Det kom en replik" : "Fortsätt debatten"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onContinue}
            className="rounded-full text-v2-muted"
          >
            <Check className="h-4 w-4 mr-2" />
            Inget mothugg — gå vidare
          </Button>
        </div>
      </div>
    </div>
  );
}
