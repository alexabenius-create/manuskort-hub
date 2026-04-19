import { useMemo } from "react";
import { Clock } from "lucide-react";
import { readCuesWithLegacyFallback, type Cue } from "@/lib/cues";

interface Card {
  id: string;
  cues?: unknown;
  cue_red?: string | null;
  cue_amber?: string | null;
  cue_teal?: string | null;
}

interface Props {
  card: Card;
  /** Sekunder spenderade på aktuellt kort. */
  elapsedSeconds: number;
  /**
   * Antal sekunder en triggerad cue ska stanna kvar.
   * -1 = "tills nästa time-cue triggar".
   * Lagras på manuset (5/15/30/-1).
   */
  displayWindowSeconds: number;
}

function formatMmSs(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Dedikerad zon för time-cues under presentationen.
 *
 * Beteende (5A.3):
 *  - Time-cues triggas när `elapsedSeconds >= cue.atSeconds` och stannar
 *    kvar i `displayWindowSeconds` (5/15/30) — eller tills nästa time-cue
 *    triggar om `displayWindowSeconds === -1`.
 *  - Max 2 aktiva samtidigt; äldre fade:ar ut först.
 *  - Diskret preview av nästa kommande time-cue under den aktiva listan.
 *  - Fade-in/out ~500ms via Tailwind-keyframes (animate-fade-in/out).
 */
export function TimeCueZone({ card, elapsedSeconds, displayWindowSeconds }: Props) {
  // Sortera time-cues efter atSeconds
  const timeCues = useMemo(() => {
    const all: Cue[] = readCuesWithLegacyFallback(card as Parameters<typeof readCuesWithLegacyFallback>[0]);
    return all
      .filter((c): c is Cue & { atSeconds: number } =>
        c.kind === "time" && typeof c.atSeconds === "number" && c.atSeconds >= 0,
      )
      .sort((a, b) => a.atSeconds - b.atSeconds);
  }, [card]);

  // Triggade cues = de vars atSeconds har passerats
  // En cue är "aktiv" om:
  //   - displayWindow > 0: elapsed < atSeconds + displayWindow
  //   - displayWindow === -1: nästa time-cue har inte triggats än
  const active = useMemo(() => {
    const triggered = timeCues.filter((c) => elapsedSeconds >= c.atSeconds);
    if (triggered.length === 0) return [];

    if (displayWindowSeconds === -1) {
      // Visa alla triggade men dölj de som följs av en nyare triggad
      return triggered.slice(-2); // max 2 aktiva
    }

    return triggered
      .filter((c) => elapsedSeconds < c.atSeconds + displayWindowSeconds)
      .slice(-2);
  }, [timeCues, elapsedSeconds, displayWindowSeconds]);

  // Nästa otriggade cue
  const upcoming = useMemo(() => {
    return timeCues.find((c) => c.atSeconds > elapsedSeconds) ?? null;
  }, [timeCues, elapsedSeconds]);

  if (active.length === 0 && !upcoming) return null;

  return (
    <div
      className="pointer-events-none flex flex-col items-end gap-1.5"
      aria-live="polite"
    >
      {active.map((cue) => (
        <div
          key={cue.id}
          className="animate-fade-in inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--cue-amber)/0.18)] text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber)/0.45)] shadow-lg backdrop-blur-sm text-[13px] font-medium"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono text-[11px] tabular-nums opacity-70">
            {formatMmSs(cue.atSeconds)}
          </span>
          <span>{cue.text}</span>
        </div>
      ))}

      {upcoming && (
        <div className="text-[11px] text-zinc-400 font-mono inline-flex items-center gap-1.5 opacity-70">
          <Clock className="h-3 w-3" />
          <span>
            Nästa: {formatMmSs(upcoming.atSeconds - elapsedSeconds)} —{" "}
            <span className="text-zinc-200">{upcoming.text}</span>
          </span>
        </div>
      )}
    </div>
  );
}
