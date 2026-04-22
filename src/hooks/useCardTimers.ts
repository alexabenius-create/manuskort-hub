import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracker för faktisk tid spenderad per kort.
 *
 * - När `currentCardId` ändras: ackumulera tid för det gamla kortet, börja räkna för det nya.
 * - När `paused` är true (global paus): pausa räkningen för aktuellt kort.
 * - När `active` är false (t.ex. countdown pågår eller meny öppen): pausa.
 * - Lokal per-kort-paus (`toggleCardPause`) pausar bara aktuellt kort utan att påverka global timer.
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
  const [cardPausedIds, setCardPausedIds] = useState<Set<string>>(new Set());
  const isCardPaused = currentCardId ? cardPausedIds.has(currentCardId) : false;

  // Hantera kort-byte och pause/resume
  useEffect(() => {
    const now = Date.now();
    const prevCardId = lastCardIdRef.current;
    const isRunning = active && !paused && !isCardPaused && !!currentCardId;

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
  }, [currentCardId, active, paused, isCardPaused]);

  // Tick varje sekund så UI uppdateras
  useEffect(() => {
    if (!active || paused || isCardPaused) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [active, paused, isCardPaused]);

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

  const toggleCardPause = useCallback(() => {
    if (!currentCardId) return;
    setCardPausedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCardId)) next.delete(currentCardId);
      else next.add(currentCardId);
      return next;
    });
  }, [currentCardId]);

  const resetCardElapsed = useCallback(() => {
    if (!currentCardId) return;
    // Stäng pågående segment om det är på aktuellt kort
    if (segmentStartRef.current !== null && lastCardIdRef.current === currentCardId) {
      segmentStartRef.current = active && !paused && !isCardPaused ? Date.now() : null;
    }
    accumulatedRef.current.set(currentCardId, 0);
    if (active && !paused && !isCardPaused && segmentStartRef.current === null) {
      segmentStartRef.current = Date.now();
    } else if (segmentStartRef.current !== null) {
      segmentStartRef.current = Date.now();
    }
    setTick((t) => t + 1);
  }, [currentCardId, active, paused, isCardPaused]);

  return {
    getCardElapsed,
    resetAll,
    tick,
    isCardPaused,
    toggleCardPause,
    resetCardElapsed,
  };
}
