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
  /** Faktiskt spenderad tid på detta kort i sekunder. */
  cardElapsedSeconds: number;
  /** Måltid för aktuellt kort (manuellt satt). Fallback till start/end-diff. */
  cardTargetSeconds: number | null;
  timeFormat: "clock" | "elapsed";
  sizeOffset: number;
  onSizeChange: (offset: number) => void;
}

const SIZE_MIN = -2;
const SIZE_MAX = 2;

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Räknar ut planerad tid från start_time/end_time som fallback. */
function fallbackPlannedSeconds(card: Card, format: "clock" | "elapsed"): number | null {
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
  cardTargetSeconds,
  timeFormat,
  sizeOffset,
  onSizeChange,
}: Props) {
  const planned = cardTargetSeconds ?? fallbackPlannedSeconds(current, timeFormat);
  const cardElapsed = Math.max(0, elapsedSeconds - cardStartedAtElapsedSeconds);
  const ratio = planned ? cardElapsed / planned : 0;
  const percent = Math.min(100, ratio * 100);
  const isOver = planned !== null && cardElapsed > planned;
  const isWarn = planned !== null && !isOver && ratio >= 0.8;

  const barColor = isOver
    ? "bg-red-400"
    : isWarn
      ? "bg-amber-400"
      : "bg-emerald-400";
  const timeColor = isOver
    ? "text-red-400"
    : isWarn
      ? "text-amber-300"
      : "text-zinc-200";

  const nextRoleLabel = next?.role === "moderator" ? "Moderator" : "Talare";

  return (
    <footer
      className="absolute bottom-0 inset-x-0 z-20 px-6 md:px-10 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-3 items-center gap-4">
        {/* Vänster — A−/A+ */}
        <div className="flex items-center gap-1.5 pointer-events-auto justify-self-start">
          <button
            onClick={() => onSizeChange(Math.max(SIZE_MIN, sizeOffset - 1))}
            disabled={sizeOffset <= SIZE_MIN}
            className="p-2.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Mindre text"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={() => onSizeChange(Math.min(SIZE_MAX, sizeOffset + 1))}
            disabled={sizeOffset >= SIZE_MAX}
            className="p-2.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Större text"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>

        {/* Mitten — per-kort-timer (centrerad) */}
        <div className="flex flex-col items-center gap-2 pointer-events-none justify-self-center">
          <div className={`font-mono text-[28px] tabular-nums leading-none ${timeColor}`}>
            {formatMmSs(cardElapsed)}
            {planned && (
              <span className="text-zinc-600">
                {" / "}
                <span className="text-zinc-400">{formatMmSs(planned)}</span>
              </span>
            )}
          </div>
          {planned && (
            <div className="h-1.5 w-[200px] rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor} ${isOver ? "animate-pulse" : ""}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>

        {/* Höger — kortnummer + nästa + panik */}
        <div className="flex items-center gap-3 justify-self-end">
          <div className="flex flex-col items-end pointer-events-none">
            <span className="font-mono text-[18px] text-zinc-200 tabular-nums leading-none">
              {String(index + 1).padStart(2, "0")}
              <span className="text-zinc-600">/{String(total).padStart(2, "0")}</span>
            </span>
            {next ? (
              <p className="text-[12px] text-zinc-500 font-mono uppercase tracking-wider truncate max-w-[260px] text-right mt-1.5">
                Nästa: {nextRoleLabel}{next.title ? ` · ${next.title}` : ""}
              </p>
            ) : (
              <p className="text-[12px] text-zinc-700 font-mono uppercase tracking-wider mt-1.5">
                Sista kortet
              </p>
            )}
          </div>

          {hasPanicCards && (
            <button
              onClick={onPanic}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 hover:text-amber-200 border border-amber-700/40 transition-colors text-[14px] font-medium pointer-events-auto"
              title="Hoppa till nästa panik-kort (P)"
            >
              <Triangle className="h-4 w-4 fill-current" strokeWidth={0} />
              Panik
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
