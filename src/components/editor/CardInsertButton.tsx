/**
 * CardInsertButton — "+"-pill mellan kort. Permanent synlig så användaren
 * direkt ser var nya kort kan infogas.
 *
 * Touch-target: minst 44×44 CSS-px (WCAG / Apple HIG) — vi lägger en osynlig
 * "padding-hitbox" runt själva knappen så den är lika lättklickad på iPad
 * oavsett zoom/orientering. Visuell storlek skalar inte med pixel-zoom
 * eftersom vi använder rem/px-baserade Tailwind-tokens.
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
              aria-label="Lägg till kort här"
              // Hitbox: minst 44×44 CSS-px för touch. Visuell knapp ligger inuti.
              className="pointer-events-auto relative inline-flex items-center justify-center h-11 w-11 -my-4 bg-transparent group/btn touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center h-6 w-6 shrink-0 rounded-full border border-border/70 bg-background text-muted-foreground opacity-70 shadow-sm transition-all group-hover/btn:opacity-100 group-hover/btn:text-accent-blue group-hover/btn:border-accent-blue/60 group-hover/btn:scale-110 group-active/btn:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
              </span>
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
