import { X } from "lucide-react";
import type { WakeLockStatus } from "@/hooks/useWakeLock";

interface Props {
  onExit: () => void;
  wakeLockStatus: WakeLockStatus;
  isWarning: boolean;
  isOverdue: boolean;
  xVisible: boolean;
}

/**
 * Mobil-v2 topbar: en 28px-rad. Bara X-knapp (vänster) + statusprick (höger).
 * Inga timers, inga lägesväljare — allt det ligger i MobileFooter.
 */
export function MobileTopbar({ onExit, wakeLockStatus, isWarning, isOverdue, xVisible }: Props) {
  const dotColor = isOverdue
    ? "bg-red-400 animate-pulse"
    : isWarning
      ? "bg-amber-400"
      : wakeLockStatus === "active"
        ? "bg-emerald-400"
        : wakeLockStatus === "unsupported" || wakeLockStatus === "error"
          ? "bg-amber-400"
          : "bg-zinc-500";

  const dotLabel = (() => {
    if (isOverdue) return "Övertid";
    if (isWarning) return "Varning – snart slut";
    switch (wakeLockStatus) {
      case "active": return "Wake Lock aktiv";
      case "inactive": return "Wake Lock vilande";
      case "unsupported": return "Skärm kan slockna";
      case "error": return "Wake Lock-fel";
    }
  })();

  return (
    <header
      className="row-start-1 flex items-center justify-between px-2 bg-black"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        onClick={onExit}
        className={`p-1 rounded text-zinc-400 hover:text-zinc-100 active:bg-zinc-800/60 transition-opacity duration-200 ${
          xVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Avsluta presentationsläge"
      >
        <X className="h-4 w-4" />
      </button>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
        title={dotLabel}
        aria-label={dotLabel}
      />
    </header>
  );
}
