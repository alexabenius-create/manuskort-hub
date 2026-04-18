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

  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-start justify-between px-6 md:px-10 pt-6 gap-4 pointer-events-none">
      {/* Vänster — X (touch-fade) + wakelock */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <button
          onClick={onExit}
          className={`p-5 rounded-2xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-opacity duration-300 ${
            xVisible ? "opacity-100" : "opacity-0 hover:opacity-100"
          }`}
          aria-label="Avsluta presentationsläge"
        >
          <X className="h-10 w-10" />
        </button>

        {/* Wake Lock indikator (diskret) */}
        <div
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900 font-mono text-[12px] text-zinc-500"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 rounded-full ${
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
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Mode toggle */}
        <div className="inline-flex bg-zinc-900 rounded-2xl p-2 text-[22px] font-medium">
          <button
            onClick={() => onModeChange("clock")}
            className={`px-5 py-2 rounded-xl transition-colors inline-flex items-center gap-2 ${
              mode === "clock" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Klockslag"
          >
            <Clock className="h-6 w-6" /> Klockslag
          </button>
          <button
            onClick={() => onModeChange("elapsed")}
            className={`px-5 py-2 rounded-xl transition-colors inline-flex items-center gap-2 ${
              mode === "elapsed" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Förfluten tid"
          >
            <Timer className="h-6 w-6" /> Förfluten
          </button>
        </div>

        {/* Tidsdisplay */}
        <div className="flex flex-col items-end px-6 py-4 rounded-2xl bg-zinc-900 min-w-[400px]">
          {mode === "clock" ? (
            <>
              <span className={`font-mono text-[56px] tabular-nums leading-none ${timeColor}`}>
                {formatClock(new Date(now), true)}
                <span className="text-zinc-600 mx-2">/</span>
                <span className="text-zinc-400">{targetClockTime}</span>
              </span>
              <span className="font-mono text-[20px] text-zinc-500 mt-3">
                {formatMinutesLeft(remainingSeconds)}
              </span>
            </>
          ) : (
            <>
              <button
                onClick={onDirectionToggle}
                className={`font-mono text-[56px] tabular-nums leading-none inline-flex items-center gap-3 hover:text-zinc-300 transition-colors ${timeColor}`}
                title={direction === "down" ? "Visa förfluten tid istället" : "Visa återstående tid istället"}
              >
                {direction === "down"
                  ? formatElapsedSeconds(remainingSeconds)
                  : formatElapsedSeconds(elapsedSeconds)}
                <ArrowUpDown className="h-6 w-6 opacity-50" />
              </button>
              <span className="font-mono text-[20px] text-zinc-500 mt-3">
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
            className="p-5 rounded-2xl bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-40"
            aria-label={isPaused ? "Återuppta timer" : "Pausa timer"}
            title={isPaused ? "Återuppta" : "Pausa"}
          >
            {isPaused ? <Play className="h-8 w-8" /> : <Pause className="h-8 w-8" />}
          </button>
        )}
      </div>
    </header>
  );
}
