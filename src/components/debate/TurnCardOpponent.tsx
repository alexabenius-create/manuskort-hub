import { useState } from "react";
import { Plus, Trash2, Loader2, MessageSquareReply, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type OpponentTurnKind = "opponent_input" | "opponent_speech" | "reply";

interface Props {
  threadId: string;
  position: number;
  kind: OpponentTurnKind;
  defaultSpeakerLabel?: string;
  parentTurnId?: string | null;
  roundNumber?: number;
  onAdded: () => void;
  onCancel: () => void;
}

type InputMode = "structured" | "freeform";

const headingFor = (kind: OpponentTurnKind, label: string): string => {
  if (kind === "opponent_speech") return `${label || "Y"}:s anförande`;
  if (kind === "reply") return `Replik från ${label || "motdebattör"}`;
  return "Y säger";
};

export function TurnCardOpponentDraft({
  threadId,
  position,
  kind,
  defaultSpeakerLabel = "",
  parentTurnId,
  roundNumber,
  onAdded,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<InputMode>(kind === "opponent_speech" ? "freeform" : "structured");
  const [args, setArgs] = useState<string[]>([""]);
  const [freeText, setFreeText] = useState("");
  const [speakerLabel, setSpeakerLabel] = useState(defaultSpeakerLabel || (kind === "opponent_speech" ? "Y" : ""));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    const cleanArgs = args.map((a) => a.trim()).filter(Boolean);
    if (mode === "structured" && cleanArgs.length === 0) {
      toast({ title: "Lägg till minst ett argument", variant: "destructive" });
      return;
    }
    if (mode === "freeform" && freeText.trim().length < 5) {
      toast({ title: "Skriv minst en mening", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-opponent-turn", {
        body: {
          thread_id: threadId,
          mode,
          arguments: mode === "structured" ? cleanArgs : undefined,
          text: mode === "freeform" ? freeText : undefined,
          kind,
          parent_turn_id: parentTurnId ?? null,
          speaker_label: speakerLabel,
          round_number: roundNumber ?? 1,
        },
      });
      if (error) {
        const msg = (data as any)?.error || error.message || "Okänt fel";
        toast({ title: "Kunde inte spara", description: msg, variant: "destructive" });
        return;
      }
      onAdded();
    } finally {
      setSaving(false);
    }
  };

  const Icon = kind === "opponent_speech" ? Mic : MessageSquareReply;

  return (
    <div className="rounded-2xl bg-white border border-v2-line p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-[12px] font-semibold shrink-0">
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-rose-500" />
          <h3 className="text-[15px] font-semibold text-v2-ink">{headingFor(kind, speakerLabel)}</h3>
        </div>
      </div>

      {kind === "reply" && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-v2-muted">
            Replikant
          </label>
          <Input
            value={speakerLabel}
            onChange={(e) => setSpeakerLabel(e.target.value)}
            placeholder="t.ex. Replikant A eller Anders Andersson"
            className="rounded-xl"
            maxLength={40}
          />
        </div>
      )}

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setMode(v as InputMode)}
        className="inline-flex p-1 rounded-full bg-v2-surface border border-v2-line"
      >
        <ToggleGroupItem
          value="structured"
          className="rounded-full px-3 py-1 text-[12px] data-[state=on]:bg-white data-[state=on]:text-v2-ink data-[state=on]:font-semibold"
        >
          Ett argument i taget
        </ToggleGroupItem>
        <ToggleGroupItem
          value="freeform"
          className="rounded-full px-3 py-1 text-[12px] data-[state=on]:bg-white data-[state=on]:text-v2-ink data-[state=on]:font-semibold"
        >
          Fritext
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-[11px] text-v2-muted -mt-2">
        {mode === "structured"
          ? "Rekommenderas — AI bemöter varje argument punktvis."
          : "Snabbare, men AI kan missa nyanser om argumentationen är komplex."}
      </p>

      {mode === "structured" ? (
        <div className="space-y-2">
          {args.map((arg, i) => (
            <div key={i} className="flex gap-2">
              <Textarea
                value={arg}
                onChange={(e) => {
                  const next = [...args];
                  next[i] = e.target.value;
                  setArgs(next);
                }}
                placeholder={`Argument ${i + 1}…`}
                rows={2}
                className="rounded-xl"
              />
              {args.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setArgs(args.filter((_, j) => j !== i))}
                  className="shrink-0 mt-1 text-v2-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setArgs([...args, ""])}
            className="rounded-full"
          >
            <Plus className="h-4 w-4 mr-1" /> Lägg till argument
          </Button>
        </div>
      ) : (
        <Textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={kind === "opponent_speech" ? "Skriv ner motdebattörens anförande…" : "Skriv ner vad de sa…"}
          rows={6}
          className="rounded-xl"
        />
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-full">
          Avbryt
        </Button>
        <Button type="button" onClick={submit} disabled={saving} className="rounded-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Spara
        </Button>
      </div>
    </div>
  );
}

export function TurnCardOpponentDisplay({
  position,
  sourceText,
  mode,
  kind,
  speakerLabel,
}: {
  position: number;
  sourceText: string;
  mode: "structured" | "freeform" | null;
  kind?: OpponentTurnKind;
  speakerLabel?: string;
}) {
  const Icon = kind === "opponent_speech" ? Mic : MessageSquareReply;
  const heading =
    kind === "opponent_speech"
      ? `${speakerLabel || "Y"} höll anförande`
      : kind === "reply"
      ? `${speakerLabel || "Replikant"} sa`
      : "Y sa";
  return (
    <div className="rounded-2xl bg-rose-50/40 border border-rose-100 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0",
          "bg-rose-100 text-rose-700",
        )}>
          {position + 1}
        </div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-rose-500" />
          <h3 className="text-[14px] font-semibold text-v2-ink">{heading}</h3>
          {mode === "freeform" && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-semibold">
              Fritext
            </span>
          )}
        </div>
      </div>
      <p className="text-[14px] text-v2-ink whitespace-pre-wrap leading-relaxed">{sourceText}</p>
    </div>
  );
}
