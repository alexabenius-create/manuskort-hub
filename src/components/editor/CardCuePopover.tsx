/**
 * CardCuePopover — popover för att lägga till en cue.
 */
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, Zap, Play, Users, type LucideIcon } from "lucide-react";
import { newCueId, type Cue, type CueKind } from "@/lib/cues";
import { useTranslation } from "react-i18next";

interface Props {
  onAdd: (cue: Cue) => void;
}

const KIND_OPTIONS: { value: CueKind; labelKey: string; icon: LucideIcon }[] = [
  { value: "energy", labelKey: "editor.card.cue_kind_energy", icon: Zap },
  { value: "action", labelKey: "editor.card.cue_kind_action", icon: Play },
  { value: "panel", labelKey: "editor.card.cue_kind_panel", icon: Users },
];

const PLACEHOLDER_KEY: Record<CueKind, string> = {
  energy: "editor.card.cue_placeholder_energy",
  action: "editor.card.cue_placeholder_action",
  panel: "editor.card.cue_placeholder_panel",
};

export function CardCuePopover({ onAdd }: Props) {
  const { t } = useTranslation();
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
          {t("editor.card.cue_add_long")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("editor.card.cue_category_label")}
            </Label>
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v as CueKind)}
              className="grid grid-cols-3 gap-2 mt-1.5"
            >
              {KIND_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <Label
                    key={o.value}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer text-[12px] transition-colors ${
                      kind === o.value
                        ? "border-foreground/40 bg-accent"
                        : "border-border/40 hover:border-border"
                    }`}
                  >
                    <RadioGroupItem value={o.value} className="sr-only" />
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(o.labelKey)}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("editor.card.cue_text_label")}
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t(PLACEHOLDER_KEY[kind])}
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
              {t("editor.card.cue_cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!text.trim()}>
              {t("editor.card.cue_save")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
