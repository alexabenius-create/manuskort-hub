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
  /** Om X-knappen ska fade:as in (touch-läge). Default visa alltid. */
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
    // Målklocka beräknas som "nu + remainingSeconds" om timern går; annars när countdown är klar
    const target = new Date(now + remainingSeconds * 1000);
    return formatClock(target);
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

  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-start justify-between px-6 py-4 gap-4 pointer-events-none">
      {/* Vänster — X (touch-fade), läge */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onExit}
          className={`p-2.5 rounded-full text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 backdrop-blur-md transition-opacity duration-300 ${
            xVisible ? "opacity-100" : "opacity-0 hover:opacity-100"
          }`}
          aria-label="Avsluta presentationsläge"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Wake Lock indikator (diskret) */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/30 backdrop-blur-md font-mono text-[10px] text-zinc-500 opacity-55 hover:opacity-100 transition-opacity"
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              wakeLockStatus === "active" ? "bg-emerald-400 animate-pulse"
                : wakeLockStatus === "unsupported" ? "bg-amber-400"
                : wakeLockStatus === "error" ? "bg-red-400"
                : "bg-zinc-500"
            }`}
          />
          {wakeLockLabel}
        </div>
      </div>

      {/* Höger — tidsmodul */}
      <div className="flex items-center gap-2 pointer-events-auto opacity-55 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        {/* Mode toggle */}
        <div className="inline-flex bg-zinc-900/50 backdrop-blur-md rounded-full p-0.5 text-[11px] font-medium">
          <button
            onClick={() => onModeChange("clock")}
            className={`px-2.5 py-1 rounded-full transition-colors inline-flex items-center gap-1 ${
              mode === "clock" ? "bg-zinc-700/80 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Klockslag"
          >
            <Clock className="h-3 w-3" /> Klockslag
          </button>
          <button
            onClick={() => onModeChange("elapsed")}
            className={`px-2.5 py-1 rounded-full transition-colors inline-flex items-center gap-1 ${
              mode === "elapsed" ? "bg-zinc-700/80 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Förfluten tid"
          >
            <Timer className="h-3 w-3" /> Förfluten
          </button>
        </div>

        {/* Tidsdisplay */}
        <div className="flex flex-col items-end px-3 py-2 rounded-2xl bg-zinc-900/50 backdrop-blur-md min-w-[140px]">
          {mode === "clock" ? (
            <>
              <span className={`font-mono text-[20px] tabular-nums leading-none ${timeColor}`}>
                {formatClock(new Date(now))}
                <span className="text-zinc-600 mx-1">/</span>
                <span className="text-zinc-400">{targetClockTime}</span>
              </span>
              <span className="font-mono text-[10px] text-zinc-500 mt-1">
                {formatMinutesLeft(remainingSeconds)}
              </span>
            </>
          ) : (
            <>
              <button
                onClick={onDirectionToggle}
                className={`font-mono text-[20px] tabular-nums leading-none inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors ${timeColor}`}
                title={direction === "down" ? "Visa förfluten tid istället" : "Visa återstående tid istället"}
              >
                {direction === "down"
                  ? formatElapsedSeconds(remainingSeconds)
                  : formatElapsedSeconds(elapsedSeconds)}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
              </button>
              <span className="font-mono text-[10px] text-zinc-500 mt-1">
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
            className="p-2.5 rounded-full bg-zinc-900/50 backdrop-blur-md text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors disabled:opacity-40"
            aria-label={isPaused ? "Återuppta timer" : "Pausa timer"}
            title={isPaused ? "Återuppta" : "Pausa"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        )}
      </div>
    </header>
  );
}
