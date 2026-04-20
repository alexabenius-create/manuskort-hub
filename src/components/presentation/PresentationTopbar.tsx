import { X, Pause, Play, Clock, Timer, ArrowUpDown } from "lucide-react";
import type { TimerMode, ElapsedDirection } from "@/hooks/usePresentationTimer";
import {
  formatClock,
  formatElapsedSeconds,
  formatMinutesLeft,
} from "@/hooks/usePresentationTimer";
import type { WakeLockStatus } from "@/hooks/useWakeLock";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  const targetClockTime = (() => {
    const target = new Date(now + remainingSeconds * 1000);
    return formatClock(target, true);
  })();

  const timeColor = isOverdue
    ? "text-red-400"
    : isWarning
      ? "text-amber-400 animate-pulse"
      : "text-zinc-100";

  const statusDot = isOverdue
    ? "bg-red-400 animate-pulse"
    : isWarning
      ? "bg-amber-400"
      : wakeLockStatus === "active"
        ? "bg-emerald-400"
        : wakeLockStatus === "unsupported" || wakeLockStatus === "error"
          ? "bg-amber-400"
          : "bg-zinc-500";

  const wakeLockLabel = (() => {
    switch (wakeLockStatus) {
      case "active": return "Wake Lock aktiv";
      case "inactive": return "Wake Lock vilande";
      case "unsupported": return "Skärm kan slockna";
      case "error": return "Wake Lock-fel";
    }
  })();

  // ===== MOBIL: minimal — bara X uppe vänster + status-dot uppe höger =====
  if (isMobile) {
    return (
      <header
        className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-2 pointer-events-none"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.25rem)" }}
      >
        <button
          onClick={onExit}
          className={`pointer-events-auto p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/60 transition-opacity duration-300 ${
            xVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Avsluta presentationsläge"
        >
          <X className="h-4 w-4" />
        </button>
        <span
          className={`pointer-events-none inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusDot}`}
          title={wakeLockLabel}
          aria-label={wakeLockLabel}
        />
      </header>
    );
  }

  // ===== DESKTOP: oförändrad layout =====
  const wakeLockDot =
    wakeLockStatus === "active" ? "bg-emerald-400 animate-pulse"
      : wakeLockStatus === "unsupported" ? "bg-amber-400"
      : wakeLockStatus === "error" ? "bg-red-400"
      : "bg-zinc-500";

  return (
    <header
      className={`absolute top-0 inset-x-0 z-30 flex items-start justify-between px-10 gap-4 pointer-events-none transition-all duration-300 ${
        xVisible ? "opacity-100 translate-y-0" : "opacity-100 translate-y-0"
      }`}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onExit}
          className={`p-3 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-opacity duration-300 ${
            xVisible ? "opacity-100" : "opacity-0 hover:opacity-100"
          }`}
          aria-label="Avsluta presentationsläge"
        >
          <X className="h-7 w-7" />
        </button>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${wakeLockDot}`}
          title={wakeLockLabel}
          aria-label={wakeLockLabel}
        />
      </div>

      <div className="pointer-events-auto">
        <div className="flex items-stretch gap-2 bg-zinc-900 rounded-2xl p-2">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onModeChange("clock")}
              className={`p-2 rounded-lg transition-colors ${
                mode === "clock" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
              title="Klockslag"
              aria-label="Klockslag"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => onModeChange("elapsed")}
              className={`p-2 rounded-lg transition-colors ${
                mode === "elapsed" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
              title="Förfluten tid"
              aria-label="Förfluten tid"
            >
              <Timer className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-end px-4 py-1 min-w-[260px]">
            {mode === "clock" ? (
              <>
                <span className={`font-mono text-[40px] tabular-nums leading-none ${timeColor}`}>
                  {formatClock(new Date(now), true)}
                  <span className="text-zinc-600 mx-1.5">/</span>
                  <span className="text-zinc-400">{targetClockTime}</span>
                </span>
                <span className="font-mono text-[13px] text-zinc-500 mt-1.5">
                  {formatMinutesLeft(remainingSeconds)}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={onDirectionToggle}
                  className={`font-mono text-[40px] tabular-nums leading-none inline-flex items-center gap-2 hover:text-zinc-300 transition-colors ${timeColor}`}
                  title={direction === "down" ? "Visa förfluten tid istället" : "Visa återstående tid istället"}
                >
                  {direction === "down"
                    ? formatElapsedSeconds(remainingSeconds)
                    : formatElapsedSeconds(elapsedSeconds)}
                  <ArrowUpDown className="h-4 w-4 opacity-50" />
                </button>
                <span className="font-mono text-[13px] text-zinc-500 mt-1.5">
                  {direction === "down" ? "kvar av" : "av"} {formatElapsedSeconds(targetSeconds)}
                </span>
              </>
            )}
          </div>

          {mode === "elapsed" && (
            <button
              onClick={onPauseToggle}
              disabled={countdownActive}
              className="p-2.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-40 self-center"
              aria-label={isPaused ? "Återuppta timer" : "Pausa timer"}
              title={isPaused ? "Återuppta" : "Pausa"}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
