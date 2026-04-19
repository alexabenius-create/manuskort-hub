import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpSheet } from "./HelpSheet";

interface Props {
  /** Extra klass om du vill justera storlek/marginal i specifika topbars. */
  className?: string;
}

/**
 * Frågetecken-knapp som öppnar en kontextkänslig hjälppanel (HelpSheet).
 * Placeras i topbar (vanligen höger sida) på alla huvudvyer.
 */
export function HelpButton({ className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Hjälp"
            className={
              "inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors " +
              (className ?? "")
            }
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px]">
          Hjälp för den här vyn
        </TooltipContent>
      </Tooltip>

      <HelpSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
