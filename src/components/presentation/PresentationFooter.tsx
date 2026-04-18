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

  // SVG progress-ring (runt kortnumret) — 2x storlek
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - ringPercent / 100);

  const nextRoleLabel = next?.role === "moderator" ? "Moderator" : "Talare";

  return (
    <footer className="absolute bottom-0 inset-x-0 z-20 px-6 md:px-10 pb-6 pointer-events-none">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Vänster — A−/A+ i svart panelkort */}
        <div className="flex items-center gap-2 pointer-events-auto bg-black rounded-3xl shadow-2xl shadow-black/40 p-3">
          <button
            onClick={() => onSizeChange(Math.max(SIZE_MIN, sizeOffset - 1))}
            disabled={sizeOffset <= SIZE_MIN}
            className="p-4 rounded-2xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Mindre text"
          >
            <ZoomOut className="h-7 w-7" />
          </button>
          <button
            onClick={() => onSizeChange(Math.min(SIZE_MAX, sizeOffset + 1))}
            disabled={sizeOffset >= SIZE_MAX}
            className="p-4 rounded-2xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Större text"
          >
            <ZoomIn className="h-7 w-7" />
          </button>
        </div>

        {/* Mitten — kortnummer + nästa-preview i svart panelkort */}
        <div className="flex flex-col items-center gap-3 pointer-events-none bg-black rounded-3xl shadow-2xl shadow-black/40 px-8 py-5">
          <div className="relative h-24 w-24 flex items-center justify-center">
            {planned && (
              <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  strokeWidth="5"
                  fill="none"
                  className="stroke-zinc-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                  className={ringOver ? "stroke-red-400 animate-pulse" : "stroke-emerald-400"}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
            )}
            <span className="font-mono text-[26px] text-zinc-200 tabular-nums">
              {String(index + 1).padStart(2, "0")}
              <span className="text-zinc-600">/{String(total).padStart(2, "0")}</span>
            </span>
          </div>
          {next ? (
            <p className="text-[18px] text-zinc-500 font-mono uppercase tracking-wider truncate max-w-[600px] text-center">
              Nästa: {nextRoleLabel}{next.title ? ` · ${next.title}` : ""}
            </p>
          ) : (
            <p className="text-[18px] text-zinc-700 font-mono uppercase tracking-wider">
              Sista kortet
            </p>
          )}
        </div>

        {/* Höger — panik-knapp i svart panelkort */}
        <div className="flex items-center pointer-events-auto bg-black rounded-3xl shadow-2xl shadow-black/40 p-3">
          {hasPanicCards ? (
            <button
              onClick={onPanic}
              className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 hover:text-amber-200 border-2 border-amber-700/40 transition-colors text-[24px] font-medium"
              title="Hoppa till nästa panik-kort (P)"
            >
              <Triangle className="h-6 w-6 fill-current" strokeWidth={0} />
              Panik
            </button>
          ) : (
            // Osynlig spacer så mittsektionen håller centrering
            <div className="px-8 py-5 opacity-0 pointer-events-none" aria-hidden>
              <Triangle className="h-6 w-6" />
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
