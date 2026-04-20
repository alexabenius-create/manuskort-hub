import { Triangle, Pause, Play, ZoomIn, ZoomOut, HelpCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { parseTime } from "@/lib/timeChain";
import { formatClock, formatElapsedSeconds } from "@/hooks/usePresentationTimer";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

interface Props {
  current: Card;
  index: number;
  total: number;
  hasPanicCards: boolean;
  onPanic: () => void;
  cardElapsedSeconds: number;
  cardTargetSeconds: number | null;
  isOverdueDismissed: boolean;
  onDismissOverdue: () => void;
  timeFormat: "clock" | "elapsed";
  totalRemainingSeconds: number;
  totalTimerMode: "clock" | "elapsed";
  totalNow: number;
  isPaused: boolean;
  onPauseToggle: () => void;
  countdownActive: boolean;
}

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fallbackPlannedSeconds(card: Card, format: "clock" | "elapsed"): number | null {
  const start = parseTime(card.start_time ?? "", format);
  const end = parseTime(card.end_time ?? "", format);
  if (start === null || end === null) return null;
  const diff = end - start;
  return diff > 0 ? diff : null;
}

/**
 * Mobil-v2 footer: alltid synlig 36px-rad + 2px progress-bar längst nederst.
 * Innehåller: kort-räknare · kort-tid | total-tid + paus | panik
 * Zoom-knappar och hjälp ligger i central tap-zone (MobileHelpZone).
 */
export function MobileFooter({
  current,
  index,
  total,
  hasPanicCards,
  onPanic,
  cardElapsedSeconds,
  cardTargetSeconds,
  isOverdueDismissed,
  onDismissOverdue,
  timeFormat,
  totalRemainingSeconds,
  totalTimerMode,
  totalNow,
  isPaused,
  onPauseToggle,
  countdownActive,
}: Props) {
  const planned = cardTargetSeconds ?? fallbackPlannedSeconds(current, timeFormat);
  const cardElapsed = Math.max(0, Math.floor(cardElapsedSeconds));
  const ratio = planned ? cardElapsed / planned : 0;
  const percent = Math.min(100, ratio * 100);
  const rawIsOver = planned !== null && cardElapsed > planned;
  const isOver = rawIsOver && !isOverdueDismissed;
  const isWarn = planned !== null && !isOver && !rawIsOver && ratio >= 0.8;

  const barColor = isOver
    ? "bg-red-400"
    : isWarn
      ? "bg-amber-400"
      : "bg-emerald-400";
  const cardTimeColor = isOver
    ? "text-red-400"
    : isWarn
      ? "text-amber-300"
      : "text-zinc-200";

  const totalLabel = totalTimerMode === "clock"
    ? formatClock(new Date(totalNow), true)
    : formatElapsedSeconds(totalRemainingSeconds);

  return (
    <footer
      className="row-start-3 flex flex-col bg-black"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* 2px progress-bar längst upp i footern */}
      <div className="h-[2px] w-full bg-zinc-900">
        {planned && (
          <div
            className={`h-full transition-all duration-700 ${barColor} ${isOver ? "animate-pulse" : ""}`}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-2 h-[34px] gap-2">
        {/* Vänster: kort-räknare + kort-tid */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
          <span className="text-zinc-300">
            {String(index + 1).padStart(2, "0")}
            <span className="text-zinc-600">/{String(total).padStart(2, "0")}</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className={cardTimeColor}>
            {formatMmSs(cardElapsed)}
            {planned && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">{formatMmSs(planned)}</span>
              </>
            )}
          </span>
          {rawIsOver && !isOverdueDismissed && (
            <button
              onClick={onDismissOverdue}
              className="ml-0.5 px-1 rounded bg-red-950/60 text-red-200 text-[9px]"
              aria-label="Stäng av övertidsvarningen"
              title="Stäng av övertidsvarningen"
            >
              ✕
            </button>
          )}
        </div>

        {/* Mitten: total tid + paus */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] tabular-nums text-zinc-100">
            {totalLabel}
          </span>
          {totalTimerMode === "elapsed" && (
            <button
              onClick={onPauseToggle}
              disabled={countdownActive}
              className="p-0.5 rounded text-zinc-300 hover:text-zinc-100 active:bg-zinc-800/60 disabled:opacity-40"
              aria-label={isPaused ? "Återuppta" : "Pausa"}
              title={isPaused ? "Återuppta" : "Pausa"}
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Höger: panik (alltid synlig om finns) */}
        <div className="flex items-center min-w-[44px] justify-end">
          {hasPanicCards && (
            <button
              onClick={onPanic}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 text-[10px] font-medium active:bg-amber-900/80"
              title="Hoppa till nästa panik-kort (P)"
              aria-label="Panik"
            >
              <Triangle className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
              Panik
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
