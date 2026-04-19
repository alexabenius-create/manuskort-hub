/**
 * CardChainTimeChip — visar ackumulerad tids-range (start–slut) för ett kort
 * baserat på kedjan av manuella måltider.
 *
 * Disabled/icke-klickbar; visuellt likt CardTargetTimePopover men neutral/dim.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

interface Props {
  startSeconds: number;
  endSeconds: number;
}

export function CardChainTimeChip({ startSeconds, endSeconds }: Props) {
  const label = `${fmt(startSeconds)}–${fmt(endSeconds)}`;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          contentEditable={false}
          aria-disabled="true"
          className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border bg-surface-2 text-muted-foreground border-border/40 text-[11px] font-mono uppercase tracking-wider cursor-default select-none"
        >
          <Clock className="h-3 w-3" />
          <span className="tabular-nums">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[12px] rounded-lg">
        Ackumulerad tid baserat på måltider
      </TooltipContent>
    </Tooltip>
  );
}
