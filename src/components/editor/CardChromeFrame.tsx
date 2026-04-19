import { useState, useMemo } from "react";
import {
  GripVertical, MoreHorizontal, Pause, Flag, ArrowRight, Triangle, StickyNote, Clock,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { parseCues, serializeCues, upsertCue, removeCue } from "@/lib/cues";
import { CueChip, AddCueButton } from "./CueEditor";
import { usePanelists } from "@/hooks/usePanelists";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

interface Props {
  card: Card | null; // null = inget DB-id ännu (nytt virtuellt kort vid förändring)
  number: number;
  total: number;
  topPx: number;
  heightPx: number;
  isActive: boolean;
  contentHtml: string; // beräknad text för detta kort (för wordcount)
  showNotes: boolean;
  showTimes: boolean;
  wpm: number;
  onChange: (patch: Partial<Card>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

/**
 * CardChromeFrame — v1:s kort-chrome (toppmeta + bottenfält) renderad
 * absolut-positionerad ovanpå en sektion av v2:s långa editor.
 *
 * Själva text-zonen i mitten är tom (pointer-events: none) — där visas
 * editor-texten igenom. Bara meta/notes/cues fångar pointer-events.
 */
export function CardChromeFrame({
  card, number, total, topPx, heightPx, isActive, contentHtml,
  showNotes, showTimes, wpm,
  onChange, onDelete, onDuplicate,
}: Props) {
  const { panelists } = usePanelists();
  const [notesOpen, setNotesOpen] = useState(false);

  const words = wordCount(contentHtml);
  const seconds = estimateSeconds(words, wpm);

  const cues = useMemo(() => parseCues(card?.cues ?? null), [card?.cues]);
  const updateCues = (next: ReturnType<typeof parseCues>) =>
    onChange({ cues: serializeCues(next) });

  const hasNotes = !!card?.notes?.trim();
  const notesVisible = showNotes && (hasNotes || notesOpen);
  const hasAnyCue = cues.length > 0;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-2xl border transition-colors",
        "pointer-events-none", // mitten släpper igenom till editorn
        isActive
          ? "border-accent-blue/40 ring-1 ring-accent-blue/20 bg-surface/40"
          : "border-border/50 bg-surface/20",
      )}
      style={{ top: `${topPx}px`, height: `${heightPx}px` }}
      data-card-frame={card?.id ?? "virtual"}
    >
      {/* Topp-meta — pointer-events auto */}
      <div className="absolute top-0 left-0 right-0 px-5 pt-2 pb-2 flex items-center gap-2 flex-wrap text-[12px] font-mono text-muted-foreground pointer-events-auto">
        <span className="px-1 tracking-wide">Kort {String(number).padStart(2, "0")} / {total}</span>
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{words} ord</span>
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{formatDuration(seconds)}</span>

        {card?.is_panic_card && (
          <>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1 text-[hsl(35_85%_38%)]">
              <Triangle className="h-3 w-3 fill-current" strokeWidth={0} />
              <span className="text-[11px] uppercase tracking-wider">panik</span>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {showNotes && !hasNotes && !notesOpen && (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              aria-label="Lägg till anteckning"
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Anteckning</span>
            </button>
          )}

          {card && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                  aria-label="Kortmeny"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={onDuplicate}>Duplicera kort</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onChange({ is_panic_card: !card.is_panic_card } as Partial<Card>)}
                >
                  <Triangle className="h-3.5 w-3.5 mr-2 fill-current" strokeWidth={0} />
                  {card.is_panic_card ? "Ta bort panik-markering" : "Markera som panik-kort"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Radera kort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="p-1.5 rounded-full text-muted-foreground/50 cursor-not-allowed">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px] rounded-lg max-w-[200px]">
              I v3 följer ordningen textflödet — drag är inaktiverat.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Bottenrad — anteckningar + cues */}
      {(notesVisible || hasAnyCue || (showNotes && hasNotes === false && notesOpen === false)) && card && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-2 pointer-events-auto">
          {hasAnyCue && (
            <div className="flex gap-2 flex-wrap items-center mb-1">
              {cues.map((c) => (
                <CueChip
                  key={c.id}
                  cue={c}
                  panelists={panelists}
                  targetSeconds={card.target_seconds ?? seconds}
                  onSave={(next) => updateCues(upsertCue(cues, next))}
                  onRemove={() => updateCues(removeCue(cues, c.id))}
                />
              ))}
              <AddCueButton
                panelists={panelists}
                targetSeconds={card.target_seconds ?? seconds}
                onAdd={(c) => updateCues(upsertCue(cues, c))}
              />
            </div>
          )}
          {notesVisible && (
            <textarea
              value={card.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Anteckning för det här kortet…"
              rows={1}
              className="w-full resize-none bg-transparent text-[12px] text-muted-foreground border-l-2 border-border/50 pl-2 outline-none focus:text-foreground focus:border-accent-blue/40 transition-colors"
            />
          )}
        </div>
      )}
    </div>
  );
}
