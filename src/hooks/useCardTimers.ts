import { useEffect, useRef, useState } from "react";

/**
 * Tracker för faktisk tid spenderad per kort.
 *
 * - När `currentCardId` ändras: ackumulera tid för det gamla kortet, börja räkna för det nya.
 * - När `paused` är true: pausa räkningen för aktuellt kort.
 * - När `active` är false (t.ex. countdown pågår eller meny öppen): pausa.
 *
 * Returnerar `getCardElapsed(cardId)` som ger faktiskt spenderad tid i sekunder.
 * Komponenter får ett `tick`-värde som uppdateras varje sekund så att UI re-renderas.
 */
export function useCardTimers(
  currentCardId: string | undefined,
  active: boolean,
  paused: boolean,
) {
  const accumulatedRef = useRef<Map<string, number>>(new Map());
  const segmentStartRef = useRef<number | null>(null);
  const lastCardIdRef = useRef<string | undefined>(undefined);
  const [tick, setTick] = useState(0);

  // Hantera kort-byte och pause/resume
  useEffect(() => {
    const now = Date.now();
    const prevCardId = lastCardIdRef.current;
    const isRunning = active && !paused && !!currentCardId;

    // Stäng pågående segment om vi hade ett
    if (segmentStartRef.current !== null && prevCardId) {
      const elapsed = (now - segmentStartRef.current) / 1000;
      const prev = accumulatedRef.current.get(prevCardId) ?? 0;
      accumulatedRef.current.set(prevCardId, prev + elapsed);
      segmentStartRef.current = null;
    }

    // Starta nytt segment om timer ska vara aktiv
    if (isRunning) {
      segmentStartRef.current = now;
    }

    lastCardIdRef.current = currentCardId;
    setTick((t) => t + 1);
  }, [currentCardId, active, paused]);

  // Tick varje sekund så UI uppdateras
  useEffect(() => {
    if (!active || paused) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [active, paused]);

  const getCardElapsed = (cardId: string | undefined): number => {
    if (!cardId) return 0;
    const base = accumulatedRef.current.get(cardId) ?? 0;
    if (cardId === lastCardIdRef.current && segmentStartRef.current !== null) {
      return base + (Date.now() - segmentStartRef.current) / 1000;
    }
    return base;
  };

  const resetAll = () => {
    accumulatedRef.current.clear();
    segmentStartRef.current = null;
  };

  return { getCardElapsed, resetAll, tick };
}
