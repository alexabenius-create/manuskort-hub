import { X, Pause, Play, Clock, Timer, ArrowUpDown } from "lucide-react";
import type { TimerMode, ElapsedDirection } from "@/hooks/usePresentationTimer";
import {
  formatClock,
  formatElapsedSeconds,
  formatMinutesLeft,
} from "@/hooks/usePresentationTimer";
import type { WakeLockStatus } from "@/hooks/useWakeLock";

interface Props {
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  direction: ElapsedDirection;
  onDirectionToggle: () => void;
  isPaused: boolean;
  onPauseToggle: () => void;
  elapsedSeconds: number;
  remainingSeconds: number;
  targetSeconds: number;
  now: number;
  isWarning: boolean;
  isOverdue: boolean;
  wakeLockStatus: WakeLockStatus;
  onExit: () => void;
  xVisible: boolean;
  countdownActive: boolean;
}

export function PresentationTopbar({
  mode,
  onModeChange,
  direction,
  onDirectionToggle,
  isPaused,
  onPauseToggle,
  elapsedSeconds,
  remainingSeconds,
  targetSeconds,
  now,
  isWarning,
  isOverdue,
  wakeLockStatus,
  onExit,
  xVisible,
  countdownActive,
}: Props) {
  const targetClockTime = (() => {
    const target = new Date(now + remainingSeconds * 1000);
    return formatClock(target, true);
  })();

  const timeColor = isOverdue
    ? "text-red-400"
    : isWarning
      ? "text-amber-400 animate-pulse"
      : "text-zinc-100";

  const wakeLockLabel = (() => {
    switch (wakeLockStatus) {
      case "active": return "Wake Lock aktiv";
      case "inactive": return "Wake Lock vilande";
      case "unsupported": return "Skärm kan slockna";
      case "error": return "Wake Lock-fel";
    }
  })();

  const wakeLockDot =
    wakeLockStatus === "active" ? "bg-emerald-400 animate-pulse"
      : wakeLockStatus === "unsupported" ? "bg-amber-400"
      : wakeLockStatus === "error" ? "bg-red-400"
      : "bg-zinc-500";

  return (
    <header
      className={`absolute top-0 inset-x-0 z-30 flex items-start justify-between px-3 md:px-10 gap-2 md:gap-4 pointer-events-none transition-all duration-300 ${
        xVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 md:opacity-100 md:translate-y-0"
      }`}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      {/* Vänster — X + wake lock dot */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onExit}
          className={`p-2 md:p-3 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-opacity duration-300 ${
            xVisible ? "opacity-100" : "opacity-0 hover:opacity-100"
          }`}
          aria-label="Avsluta presentationsläge"
        >
          <X className="h-5 w-5 md:h-7 md:w-7" />
        </button>
        <span
          className={`hidden md:inline-block h-2.5 w-2.5 rounded-full ${wakeLockDot}`}
          title={wakeLockLabel}
          aria-label={wakeLockLabel}
        />
      </div>

      {/* Höger — kompakt tidsblock */}
      <div className="pointer-events-auto">
        <div className="flex items-stretch gap-1 md:gap-2 bg-zinc-900 rounded-xl md:rounded-2xl p-1 md:p-2">
          {/* Mode-toggle ikon-only, vertikal på desktop, horisontell på mobil */}
          <div className="flex flex-row md:flex-col gap-0.5 md:gap-1">
            <button
              onClick={() => onModeChange("clock")}
              className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-colors ${
                mode === "clock" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
              title="Klockslag"
              aria-label="Klockslag"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => onModeChange("elapsed")}
              className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-colors ${
                mode === "elapsed" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
              title="Förfluten tid"
              aria-label="Förfluten tid"
            >
              <Timer className="h-4 w-4" />
            </button>
          </div>

          {/* Tidsdisplay */}
          <div className="flex flex-col items-end px-2 md:px-4 py-0.5 md:py-1 min-w-[140px] md:min-w-[260px]">
            {mode === "clock" ? (
              <>
                <span className={`font-mono text-[20px] md:text-[40px] tabular-nums leading-none ${timeColor}`}>
                  {formatClock(new Date(now), true)}
                  <span className="text-zinc-600 mx-1 md:mx-1.5">/</span>
                  <span className="text-zinc-400">{targetClockTime}</span>
                </span>
                <span className="font-mono text-[10px] md:text-[13px] text-zinc-500 mt-1 md:mt-1.5">
                  {formatMinutesLeft(remainingSeconds)}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={onDirectionToggle}
                  className={`font-mono text-[20px] md:text-[40px] tabular-nums leading-none inline-flex items-center gap-1 md:gap-2 hover:text-zinc-300 transition-colors ${timeColor}`}
                  title={direction === "down" ? "Visa förfluten tid istället" : "Visa återstående tid istället"}
                >
                  {direction === "down"
                    ? formatElapsedSeconds(remainingSeconds)
                    : formatElapsedSeconds(elapsedSeconds)}
                  <ArrowUpDown className="h-3 w-3 md:h-4 md:w-4 opacity-50" />
                </button>
                <span className="font-mono text-[10px] md:text-[13px] text-zinc-500 mt-1 md:mt-1.5">
                  {direction === "down" ? "kvar av" : "av"} {formatElapsedSeconds(targetSeconds)}
                </span>
              </>
            )}
          </div>

          {/* Pause-knapp — bara i förfluten-läge */}
          {mode === "elapsed" && (
            <button
              onClick={onPauseToggle}
              disabled={countdownActive}
              className="p-2 md:p-2.5 rounded-md md:rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-40 self-center"
              aria-label={isPaused ? "Återuppta timer" : "Pausa timer"}
              title={isPaused ? "Återuppta" : "Pausa"}
            >
              {isPaused ? <Play className="h-4 w-4 md:h-5 md:w-5" /> : <Pause className="h-4 w-4 md:h-5 md:w-5" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
