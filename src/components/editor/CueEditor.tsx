import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pause, Zap, X, Plus, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Cue,
  type CueKind,
  CUE_KINDS_ENABLED,
  CUE_KIND_LABEL,
  CUE_KIND_DESCRIPTION,
  newCueId,
} from "@/lib/cues";
import { hexToRgba, hexToDarkText } from "@/lib/panelistColors";
import type { Panelist } from "@/hooks/usePanelists";

/* -------------------------- mm:ss helpers (lokala) ------------------------- */

/** Parse "mm:ss", "m:ss" eller bara sekunder ("90"). Returnerar null vid ogiltigt. */
function parseMmSs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [mStr, sStr] = trimmed.split(":");
    const m = parseInt(mStr, 10);
    const s = parseInt(sStr, 10);
    if (!Number.isFinite(m) || !Number.isFinite(s) || s < 0 || s >= 60 || m < 0) return null;
    return m * 60 + s;
  }
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatMmSs(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

interface CueChipProps {
  cue: Cue;
  panelists?: Panelist[];
  /** Effektiv måltid på kortet (manual ?? estimerat). Används för validering av time-cues. */
  targetSeconds?: number | null;
  onSave: (next: Cue) => void;
  onRemove: () => void;
}

const KIND_STYLE: Record<Exclude<CueKind, "panel">, { chip: string; icon: React.ReactNode }> = {
  energy: {
    chip: "bg-[hsl(var(--cue-red)/0.12)] text-[hsl(var(--cue-red))] border-[hsl(var(--cue-red)/0.35)] hover:bg-[hsl(var(--cue-red)/0.18)]",
    icon: <Pause className="h-3 w-3" />,
  },
  action: {
    chip: "bg-[hsl(var(--accent-blue)/0.12)] text-[hsl(var(--accent-blue))] border-[hsl(var(--accent-blue)/0.35)] hover:bg-[hsl(var(--accent-blue)/0.18)]",
    icon: <Zap className="h-3 w-3" />,
  },
  time: {
    chip: "bg-[hsl(var(--cue-amber)/0.12)] text-[hsl(var(--cue-amber))] border-[hsl(var(--cue-amber)/0.35)] hover:bg-[hsl(var(--cue-amber)/0.18)]",
    icon: <Clock className="h-3 w-3" />,
  },
};

function panelChipStyle(color: string | null | undefined): React.CSSProperties {
  if (!color) {
    return {};
  }
  return {
    backgroundColor: hexToRgba(color, 0.18),
    color: hexToDarkText(color),
    borderColor: hexToRgba(color, 0.45),
  };
}

/** Klickbar chip som öppnar popover för redigering. */
export function CueChip({ cue, panelists = [], targetSeconds, onSave, onRemove }: CueChipProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(cue.text);
  const [kind, setKind] = useState<CueKind>(cue.kind);
  const [panelistId, setPanelistId] = useState<string | null>(cue.panelistId ?? null);
  const [atSecondsStr, setAtSecondsStr] = useState<string>(
    typeof cue.atSeconds === "number" ? formatMmSs(cue.atSeconds) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(cue.text);
      setKind(cue.kind);
      setPanelistId(cue.panelistId ?? null);
      setAtSecondsStr(typeof cue.atSeconds === "number" ? formatMmSs(cue.atSeconds) : "");
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, cue.text, cue.kind, cue.panelistId, cue.atSeconds]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onRemove();
      setOpen(false);
      return;
    }
    let parsedAt: number | null = null;
    if (kind === "time") {
      parsedAt = parseMmSs(atSecondsStr);
      if (parsedAt == null) return; // ogiltig tid → blockera spara
      if (typeof targetSeconds === "number" && targetSeconds > 0 && parsedAt > targetSeconds) {
        return; // över kortets målgräns → blockera
      }
    }
    onSave({
      ...cue,
      text: trimmed,
      kind,
      panelistId: kind === "panel" ? panelistId : null,
      atSeconds: kind === "time" ? parsedAt : null,
    });
    setOpen(false);
  };

  // Render chip — panel uses panelist color
  let chipClass = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors";
  let chipStyle: React.CSSProperties = {};
  let icon: React.ReactNode = null;
  let timePrefix: string | null = null;

  if (cue.kind === "panel") {
    const p = panelists.find((x) => x.id === cue.panelistId);
    chipClass = cn(chipClass, "border");
    chipStyle = panelChipStyle(p?.color);
    icon = <Users className="h-3 w-3" />;
  } else if (cue.kind === "time") {
    const s = KIND_STYLE.time;
    chipClass = cn(chipClass, s.chip);
    icon = s.icon;
    if (typeof cue.atSeconds === "number") {
      timePrefix = formatMmSs(cue.atSeconds);
    }
  } else if (cue.kind === "energy" || cue.kind === "action") {
    const s = KIND_STYLE[cue.kind];
    chipClass = cn(chipClass, s.chip);
    icon = s.icon;
  }

  const panelName = cue.kind === "panel"
    ? (panelists.find((x) => x.id === cue.panelistId)?.name || "Namnlös")
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass} style={chipStyle}>
          {icon}
          {panelName && <span className="opacity-70 font-mono text-[10px] uppercase tracking-wider">{panelName}</span>}
          {timePrefix && <span className="opacity-70 font-mono text-[10px] tabular-nums">{timePrefix}</span>}
          <span>{cue.text}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <CueForm
          kind={kind}
          text={text}
          panelistId={panelistId}
          panelists={panelists}
          atSecondsStr={atSecondsStr}
          targetSeconds={targetSeconds ?? null}
          onKindChange={setKind}
          onTextChange={setText}
          onPanelistChange={setPanelistId}
          onAtSecondsStrChange={setAtSecondsStr}
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
  panelists?: Panelist[];
  /** Effektiv måltid på kortet — används för validering av time-cues. */
  targetSeconds?: number | null;
  onAdd: (cue: Cue) => void;
}

/** "+ Signal"-knapp som öppnar popover för att skapa ny cue. */
export function AddCueButton({ panelists = [], targetSeconds, onAdd }: AddCueButtonProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CueKind>("energy");
  const [text, setText] = useState("");
  const [panelistId, setPanelistId] = useState<string | null>(null);
  const [atSecondsStr, setAtSecondsStr] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setKind("energy");
      setPanelistId(panelists[0]?.id ?? null);
      setAtSecondsStr("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, panelists]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    let parsedAt: number | null = null;
    if (kind === "time") {
      parsedAt = parseMmSs(atSecondsStr);
      if (parsedAt == null) return;
      if (typeof targetSeconds === "number" && targetSeconds > 0 && parsedAt > targetSeconds) return;
    }
    onAdd({
      id: newCueId(),
      kind,
      text: trimmed,
      ...(kind === "panel" ? { panelistId } : {}),
      ...(kind === "time" ? { atSeconds: parsedAt } : {}),
    });
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
          panelistId={panelistId}
          panelists={panelists}
          atSecondsStr={atSecondsStr}
          targetSeconds={targetSeconds ?? null}
          onKindChange={setKind}
          onTextChange={setText}
          onPanelistChange={setPanelistId}
          onAtSecondsStrChange={setAtSecondsStr}
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
  panelistId: string | null;
  panelists: Panelist[];
  atSecondsStr: string;
  targetSeconds: number | null;
  onKindChange: (k: CueKind) => void;
  onTextChange: (t: string) => void;
  onPanelistChange: (id: string | null) => void;
  onAtSecondsStrChange: (s: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onCommit: () => void;
  onCancel: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

function CueForm({
  kind, text, panelistId, panelists, atSecondsStr, targetSeconds,
  onKindChange, onTextChange, onPanelistChange, onAtSecondsStrChange,
  inputRef, onCommit, onCancel, onRemove, showRemove,
}: CueFormProps) {
  const panelDisabled = kind === "panel" && panelists.length === 0;

  // Validering för time-cues
  const parsedAt = kind === "time" ? parseMmSs(atSecondsStr) : null;
  const timeInvalid = kind === "time" && atSecondsStr.trim() !== "" && parsedAt == null;
  const timeOverLimit =
    kind === "time" &&
    parsedAt != null &&
    typeof targetSeconds === "number" &&
    targetSeconds > 0 &&
    parsedAt > targetSeconds;
  const timeMissing = kind === "time" && atSecondsStr.trim() === "";
  const timeError = timeInvalid
    ? "Ogiltigt format — använd mm:ss eller sekunder"
    : timeOverLimit
      ? `Max ${formatMmSs(targetSeconds!)} (kortets måltid)`
      : null;
  const commitDisabled = panelDisabled || timeInvalid || timeOverLimit || timeMissing;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Kategori</span>
        <div className="inline-flex bg-surface-2 rounded-lg p-1 gap-1 flex-wrap">
          {CUE_KINDS_ENABLED.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              className={cn(
                "flex-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CUE_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{CUE_KIND_DESCRIPTION[kind]}</p>
      </div>

      {kind === "panel" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Riktas till</span>
          {panelists.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              Lägg till paneldeltagare i sidopanelen först.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {panelists.map((p) => {
                const active = panelistId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPanelistChange(p.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] border transition-all",
                      active ? "ring-2 ring-foreground/30" : "hover:opacity-80",
                    )}
                    style={{
                      backgroundColor: hexToRgba(p.color, 0.18),
                      color: hexToDarkText(p.color),
                      borderColor: hexToRgba(p.color, 0.45),
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name || "Namnlös"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {kind === "time" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Triggas vid (mm:ss)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={atSecondsStr}
              onChange={(e) => onAtSecondsStrChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommit(); }
                if (e.key === "Escape") { e.preventDefault(); onCancel(); }
              }}
              placeholder="0:30"
              className={cn(
                "font-mono text-[13px] tabular-nums w-[96px] px-2.5 py-1.5 rounded-md bg-background border focus:outline-none focus:ring-2 focus:ring-ring",
                timeError ? "border-destructive" : "border-border",
              )}
            />
            {typeof targetSeconds === "number" && targetSeconds > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                av {formatMmSs(targetSeconds)}
              </span>
            )}
          </div>
          {timeError && (
            <p className="text-[11px] text-destructive">{timeError}</p>
          )}
        </div>
      )}

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
          placeholder={
            kind === "energy" ? "T.ex. Andas, paus" :
            kind === "action" ? "T.ex. Visa bild 3" :
            kind === "panel" ? "T.ex. Fråga om bakgrund" :
            "T.ex. Wrap upp"
          }
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
            disabled={commitDisabled}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}
