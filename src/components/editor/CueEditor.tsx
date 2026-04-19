import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pause, Zap, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Cue,
  type CueKind,
  CUE_KINDS_ENABLED_5A1,
  CUE_KIND_LABEL,
  CUE_KIND_DESCRIPTION,
  newCueId,
} from "@/lib/cues";

interface CueChipProps {
  cue: Cue;
  onSave: (next: Cue) => void;
  onRemove: () => void;
}

const KIND_STYLE: Record<CueKind, { chip: string; icon: React.ReactNode }> = {
  energy: {
    chip: "bg-[hsl(var(--cue-red)/0.12)] text-[hsl(var(--cue-red))] border-[hsl(var(--cue-red)/0.35)] hover:bg-[hsl(var(--cue-red)/0.18)]",
    icon: <Pause className="h-3 w-3" />,
  },
  action: {
    chip: "bg-[hsl(var(--accent-blue)/0.12)] text-[hsl(var(--accent-blue))] border-[hsl(var(--accent-blue)/0.35)] hover:bg-[hsl(var(--accent-blue)/0.18)]",
    icon: <Zap className="h-3 w-3" />,
  },
  // 5A.2/5A.3 — placeholder-stil tills aktiverade
  panel: { chip: "bg-muted text-muted-foreground border-border", icon: null },
  time: { chip: "bg-muted text-muted-foreground border-border", icon: null },
};

/** Klickbar chip som öppnar popover för redigering. */
export function CueChip({ cue, onSave, onRemove }: CueChipProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(cue.text);
  const [kind, setKind] = useState<CueKind>(cue.kind);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(cue.text);
      setKind(cue.kind);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, cue.text, cue.kind]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onRemove();
    } else if (trimmed !== cue.text || kind !== cue.kind) {
      onSave({ ...cue, text: trimmed, kind });
    }
    setOpen(false);
  };

  const style = KIND_STYLE[cue.kind];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors",
            style.chip,
          )}
        >
          {style.icon}
          <span>{cue.text}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <CueForm
          kind={kind}
          text={text}
          onKindChange={setKind}
          onTextChange={setText}
          inputRef={inputRef}
          onCommit={commit}
          onCancel={() => setOpen(false)}
          onRemove={() => {
            onRemove();
            setOpen(false);
          }}
          showRemove
        />
      </PopoverContent>
    </Popover>
  );
}

interface AddCueButtonProps {
  onAdd: (cue: Cue) => void;
}

/** "+ Signal"-knapp som öppnar popover för att skapa ny cue. */
export function AddCueButton({ onAdd }: AddCueButtonProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CueKind>("energy");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setKind("energy");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onAdd({ id: newCueId(), kind, text: trimmed });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-dashed border-border/60 transition-colors"
          aria-label="Lägg till signal"
        >
          <Plus className="h-3 w-3" /> Signal
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <CueForm
          kind={kind}
          text={text}
          onKindChange={setKind}
          onTextChange={setText}
          inputRef={inputRef}
          onCommit={commit}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface CueFormProps {
  kind: CueKind;
  text: string;
  onKindChange: (k: CueKind) => void;
  onTextChange: (t: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onCommit: () => void;
  onCancel: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

function CueForm({ kind, text, onKindChange, onTextChange, inputRef, onCommit, onCancel, onRemove, showRemove }: CueFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Kategori</span>
        <div className="inline-flex bg-surface-2 rounded-lg p-1 gap-1">
          {CUE_KINDS_ENABLED_5A1.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CUE_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{CUE_KIND_DESCRIPTION[kind]}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Text</span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder={kind === "energy" ? "T.ex. Andas, paus" : "T.ex. Visa bild 3"}
          className="w-full px-3 py-2 rounded-md bg-background border border-border text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {showRemove && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-[12px] text-destructive hover:text-destructive/80"
          >
            <X className="h-3 w-3" /> Ta bort
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onCommit}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:bg-foreground/90"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}
