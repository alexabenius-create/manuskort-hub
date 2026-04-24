/**
 * CardInsertButton — "+"-pill mellan kort. Permanent synlig så användaren
 * direkt ser var nya kort kan infogas.
 */
import { Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  position: "above" | "below";
  onClick: () => void;
}

export function CardInsertButton({ position, onClick }: Props) {
  return (
    <div
      contentEditable={false}
      className={`group/insert relative h-3 -my-1 z-10 ${position === "above" ? "mt-2" : ""}`}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
        {/* Subtil linje över hela bredden — accentueras vid hover */}
        <div className="absolute inset-x-6 sm:inset-x-10 top-1/2 -translate-y-1/2 h-px bg-border/40 group-hover/insert:bg-accent-blue/40 transition-colors pointer-events-none" />
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              className="pointer-events-auto relative inline-flex items-center justify-center h-6 w-6 rounded-full border border-border/70 bg-background text-muted-foreground opacity-70 hover:opacity-100 hover:text-accent-blue hover:border-accent-blue/60 hover:scale-110 transition-all shadow-sm"
              aria-label="Lägg till kort här"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[12px] rounded-lg">
            Lägg till kort här
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
