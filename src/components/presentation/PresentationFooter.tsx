import { Triangle, ZoomIn, ZoomOut, Pause, Play, RotateCcw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { parseTime } from "@/lib/timeChain";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatClock, formatElapsedSeconds } from "@/hooks/usePresentationTimer";

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
  cardElapsedSeconds: number;
  cardTargetSeconds: number | null;
  isOverdueDismissed: boolean;
  onDismissOverdue: () => void;
  timeFormat: "clock" | "elapsed";
  sizeOffset: number;
  onSizeChange: (offset: number) => void;
  visible?: boolean;
  // Mobil-only: total tid (flyttad från topbar)
  totalRemainingSeconds?: number;
  totalTimerMode?: "clock" | "elapsed";
  totalNow?: number;
  isPaused?: boolean;
  onPauseToggle?: () => void;
  countdownActive?: boolean;
  showZoomButtons?: boolean;
  // Per-kort timer-kontroller
  isCardPaused?: boolean;
  onCardPauseToggle?: () => void;
  onCardReset?: () => void;
}

const SIZE_MIN = -2;
const SIZE_MAX = 2;

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

export function PresentationFooter({
  current,
  next,
  index,
  total,
  hasPanicCards,
  onPanic,
  cardElapsedSeconds,
  cardTargetSeconds,
  isOverdueDismissed,
  onDismissOverdue,
  timeFormat,
  sizeOffset,
  onSizeChange,
  visible = true,
  totalRemainingSeconds = 0,
  totalTimerMode = "elapsed",
  totalNow = Date.now(),
  isPaused = false,
  onPauseToggle,
  countdownActive = false,
  showZoomButtons = true,
  isCardPaused = false,
  onCardPauseToggle,
  onCardReset,
}: Props) {
  const isMobile = useIsMobile();
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
  const timeColor = isOver
    ? "text-red-400"
    : isWarn
      ? "text-amber-300"
      : "text-zinc-200";

  const nextRoleLabel = next?.role === "moderator" ? "Moderator" : "Talare";

  // ===== MOBIL: alltid synlig, kompakt rad med all tidsinfo =====
  if (isMobile) {
    const totalLabel = totalTimerMode === "clock"
      ? formatClock(new Date(totalNow), true)
      : formatElapsedSeconds(totalRemainingSeconds);

    return (
      <footer
        className="absolute bottom-0 inset-x-0 z-20 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Tunn 2px progress-bar längst nederst */}
        {planned && (
          <div className="h-[2px] w-full bg-zinc-800/60 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${barColor} ${isOver ? "animate-pulse" : ""}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between px-2 py-1 gap-2 bg-black/40 backdrop-blur-sm">
          {/* Vänster: kort-räknare + kort-tid */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums pointer-events-auto">
            <span className="text-zinc-300">
              {String(index + 1).padStart(2, "0")}
              <span className="text-zinc-600">/{String(total).padStart(2, "0")}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className={timeColor}>
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

          {/* Mitten: total tid + pause */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <span className="font-mono text-[12px] tabular-nums text-zinc-100">
              {totalLabel}
            </span>
            {totalTimerMode === "elapsed" && onPauseToggle && (
              <button
                onClick={onPauseToggle}
                disabled={countdownActive}
                className="p-0.5 rounded text-zinc-300 hover:text-zinc-100 disabled:opacity-40"
                aria-label={isPaused ? "Återuppta" : "Pausa"}
                title={isPaused ? "Återuppta" : "Pausa"}
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Höger: zoom (auto-hide) + panik (alltid) */}
          <div className="flex items-center gap-0.5 pointer-events-auto">
            {showZoomButtons && (
              <>
                <button
                  onClick={() => onSizeChange(Math.max(SIZE_MIN, sizeOffset - 1))}
                  disabled={sizeOffset <= SIZE_MIN}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                  aria-label="Mindre text"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onSizeChange(Math.min(SIZE_MAX, sizeOffset + 1))}
                  disabled={sizeOffset >= SIZE_MAX}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                  aria-label="Större text"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              </>
            )}
            {hasPanicCards && (
              <button
                onClick={onPanic}
                className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 text-[10px] font-medium"
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

  // ===== DESKTOP: tre-kolumns layout med stabilt centerblock =====
  return (
    <footer
      className="absolute bottom-0 inset-x-0 z-20 px-10 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="w-full max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-end gap-8">
        {/* VÄNSTER: zoom-knappar */}
        <div className="flex items-center gap-1.5 pointer-events-auto justify-self-start pb-1">
          <button
            onClick={() => onSizeChange(Math.max(SIZE_MIN, sizeOffset - 1))}
            disabled={sizeOffset <= SIZE_MIN}
            className="p-2.5 rounded-xl bg-zinc-900/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Mindre text"
            title="Mindre text"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={() => onSizeChange(Math.min(SIZE_MAX, sizeOffset + 1))}
            disabled={sizeOffset >= SIZE_MAX}
            className="p-2.5 rounded-xl bg-zinc-900/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
            aria-label="Större text"
            title="Större text"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>

        {/* MITTEN: per-kort timer-block (stabil höjd) */}
        <div className="flex flex-col items-center gap-1.5 justify-self-center pointer-events-none">
          {/* Liten kontrollrad: pause + reset (alltid renderad så layouten inte hoppar) */}
          <div className="flex items-center gap-1 pointer-events-auto h-7">
            {onCardPauseToggle && (
              <button
                onClick={onCardPauseToggle}
                className="p-1.5 rounded-lg bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                aria-label={isCardPaused ? "Återuppta kort-timer" : "Pausa kort-timer"}
                title={isCardPaused ? "Återuppta kort-timer" : "Pausa kort-timer"}
              >
                {isCardPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
            {onCardReset && (
              <button
                onClick={onCardReset}
                className="p-1.5 rounded-lg bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                aria-label="Nollställ kort-timer"
                title="Nollställ kort-timer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tid-siffrorna */}
          <div className={`font-mono text-[28px] tabular-nums leading-none ${timeColor} ${isCardPaused ? "opacity-60" : ""}`}>
            {formatMmSs(cardElapsed)}
            {planned && (
              <span className="text-zinc-600">
                {" / "}
                <span className="text-zinc-400">{formatMmSs(planned)}</span>
              </span>
            )}
          </div>

          {/* Progress-bar (alltid samma yta även när planned saknas) */}
          <div className="h-1.5 w-[220px] rounded-full bg-zinc-800/70 overflow-hidden">
            {planned && (
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor} ${isOver ? "animate-pulse" : ""}`}
                style={{ width: `${percent}%` }}
              />
            )}
          </div>

          {/* Reserverad rad för "stäng av övertidsvarningen" — höjd alltid avsatt */}
          <div className="h-7 flex items-center pointer-events-auto">
            {rawIsOver && !isOverdueDismissed && (
              <button
                onClick={onDismissOverdue}
                className="inline-flex items-center px-3 py-1 rounded-full bg-red-950/60 hover:bg-red-900/70 text-red-200 hover:text-red-100 border border-red-800/50 transition-colors text-[11px] font-mono uppercase tracking-wider"
                aria-label="Stäng av övertidsvarningen för detta kort"
                title="Stäng av övertidsvarningen för detta kort"
              >
                Stäng av övertidsvarningen
              </button>
            )}
          </div>
        </div>

        {/* HÖGER: kort-räknare + nästa-info + panik */}
        <div className="flex items-center gap-3 justify-self-end pb-1">
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
