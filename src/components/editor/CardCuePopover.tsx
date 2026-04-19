/**
 * CardCuePopover — popover för att lägga till en cue.
 *
 * En enda "+ Lägg till cue"-knapp triggar popovern. Inuti väljer användaren typ
 * (energy/action/time) via radio-group + skriver text + sparar.
 */
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { newCueId, type Cue, type CueKind } from "@/lib/cues";

interface Props {
  onAdd: (cue: Cue) => void;
}

const KIND_OPTIONS: { value: CueKind; label: string; icon: string }[] = [
  { value: "energy", label: "Energi", icon: "⚡" },
  { value: "action", label: "Action", icon: "▶" },
  { value: "panel", label: "Panel", icon: "👥" },
];

const PLACEHOLDER: Record<CueKind, string> = {
  energy: "T.ex. Andas, sänk tempo",
  action: "T.ex. Visa bild 3, byt plats",
  panel: "T.ex. Be om konkret exempel",
};

export function CardCuePopover({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CueKind>("energy");
  const [text, setText] = useState("");

  const reset = () => {
    setKind("energy");
    setText("");
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({ id: newCueId(), kind, text: trimmed });
    reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 h-6 rounded-full border border-dashed border-border/60 hover:border-border"
          contentEditable={false}
        >
          <Plus className="h-3 w-3" />
          Lägg till cue
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Typ</Label>
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v as CueKind)}
              className="grid grid-cols-3 gap-2 mt-1.5"
            >
              {KIND_OPTIONS.map((o) => (
                <Label
                  key={o.value}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer text-[12px] transition-colors ${
                    kind === o.value
                      ? "border-foreground/40 bg-accent"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <RadioGroupItem value={o.value} className="sr-only" />
                  <span aria-hidden="true">{o.icon}</span>
                  <span>{o.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Text</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER[kind]}
              className="mt-1.5 min-h-[60px] text-[13px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { reset(); setOpen(false); }}>
              Avbryt
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!text.trim()}>
              Spara
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
