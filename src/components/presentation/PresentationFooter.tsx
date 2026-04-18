import { Triangle, ZoomIn, ZoomOut } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { parseTime } from "@/lib/timeChain";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

interface Props {
  current: Card;
  next?: Card;
  index: number;
  total: number;
  hasPanicCards: boolean;
  onPanic: () => void;
  /** Sekunder förflutna sen presentationsstart (för progress-ring per kort). */
  elapsedSeconds: number;
  /** Sekunder presentationen pågått som inte hör till detta kort, så vi kan beräkna kortets "lokala" elapsed. */
  cardStartedAtElapsedSeconds: number;
  timeFormat: "clock" | "elapsed";
  sizeOffset: number;
  onSizeChange: (offset: number) => void;
}

const SIZE_MIN = -2;
const SIZE_MAX = 2;

/** Räknar ut hur många sekunder kortet är planerat att ta från start_time/end_time. */
function cardPlannedSeconds(card: Card, format: "clock" | "elapsed"): number | null {
  const start = parseTime(card.start_time ?? "", format);
  const end = parseTime(card.end_time ?? "", format);
  if (start === null || end === null) return null;
  const diff = end - start;
  return diff > 0 ? diff : null;
}

export function PresentationFooter({
  current,
  next,
  index,
  total,
  hasPanicCards,
  onPanic,
  elapsedSeconds,
  cardStartedAtElapsedSeconds,
  timeFormat,
  sizeOffset,
  onSizeChange,
}: Props) {
  const planned = cardPlannedSeconds(current, timeFormat);
  const cardElapsed = Math.max(0, elapsedSeconds - cardStartedAtElapsedSeconds);
  const ringPercent = planned ? Math.min(100, (cardElapsed / planned) * 100) : 0;
  const ringOver = planned !== null && cardElapsed > planned;

  // SVG progress-ring (runt kortnumret)
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - ringPercent / 100);

  const nextRoleLabel = next?.role === "moderator" ? "Moderator" : "Talare";

  return (
    <footer className="absolute bottom-0 inset-x-0 z-20 px-6 py-4 pointer-events-none">
      <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
        {/* Vänster — A−/A+ */}
        <div className="flex items-center gap-1 pointer-events-auto opacity-55 hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSizeChange(Math.max(SIZE_MIN, sizeOffset - 1))}
            disabled={sizeOffset <= SIZE_MIN}
            className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors disabled:opacity-30"
            aria-label="Mindre text"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSizeChange(Math.min(SIZE_MAX, sizeOffset + 1))}
            disabled={sizeOffset >= SIZE_MAX}
            className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors disabled:opacity-30"
            aria-label="Större text"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mitten — kortnummer med progress-ring + nästa-preview */}
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className="relative h-12 w-12 flex items-center justify-center">
            {planned && (
              <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r={ringRadius}
                  strokeWidth="2.5"
                  fill="none"
                  className="stroke-zinc-800"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={ringRadius}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                  className={ringOver ? "stroke-red-400 animate-pulse" : "stroke-emerald-400"}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
            )}
            <span className="font-mono text-[13px] text-zinc-200 tabular-nums">
              {String(index + 1).padStart(2, "0")}
              <span className="text-zinc-600">/{String(total).padStart(2, "0")}</span>
            </span>
          </div>
          {next ? (
            <p className="text-[11px] text-zinc-600 font-mono uppercase tracking-wider truncate max-w-[300px] text-center">
              Nästa: {nextRoleLabel}{next.title ? ` · ${next.title}` : ""}
            </p>
          ) : (
            <p className="text-[11px] text-zinc-700 font-mono uppercase tracking-wider">
              Sista kortet
            </p>
          )}
        </div>

        {/* Höger — panik-knapp */}
        <div className="flex items-center pointer-events-auto">
          {hasPanicCards && (
            <button
              onClick={onPanic}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-900/30 hover:bg-amber-900/50 backdrop-blur-md text-amber-300 hover:text-amber-200 border border-amber-700/40 transition-colors text-[12px] font-medium"
              title="Hoppa till nästa panik-kort (P)"
            >
              <Triangle className="h-3 w-3 fill-current" strokeWidth={0} />
              Panik
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
