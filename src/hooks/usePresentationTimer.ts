import { useCallback, useEffect, useRef, useState } from "react";

export type TimerMode = "clock" | "elapsed";
export type ElapsedDirection = "down" | "up";

interface PersistedState {
  startedAtMs: number;
  accumulatedPauseMs: number;
  pausedAtMs: number | null;
  direction: ElapsedDirection;
}

interface Options {
  manuscriptId: string;
  /** Måltid i sekunder — krävs för countdown och målklocka. */
  targetSeconds: number;
  /** "clock" eller "elapsed" — visningsläge. */
  mode: TimerMode;
  /** Antal sekunders countdown innan timern startar (3-2-1). */
  countdownSeconds?: number;
  /** Aktivera direkt? Default true. */
  enabled?: boolean;
}

const STORAGE_PREFIX = "presentation-timer:";

function loadState(manuscriptId: string): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + manuscriptId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed.startedAtMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(manuscriptId: string, state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + manuscriptId, JSON.stringify(state));
  } catch { /* ignore */ }
}

function clearState(manuscriptId: string) {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + manuscriptId);
  } catch { /* ignore */ }
}

export function usePresentationTimer({
  manuscriptId,
  targetSeconds,
  mode,
  countdownSeconds = 3,
  enabled = true,
}: Options) {
  // Återställ från sessionStorage om finns
  const initial = loadState(manuscriptId);

  const [now, setNow] = useState<number>(Date.now());
  const [countdown, setCountdown] = useState<number>(initial ? 0 : countdownSeconds);
  const [direction, setDirection] = useState<ElapsedDirection>(initial?.direction ?? "down");

  // Drift-fri tidshantering med wall-clock + ackumulerad paustid
  const startedAtRef = useRef<number>(initial?.startedAtMs ?? Date.now());
  const accumulatedPauseRef = useRef<number>(initial?.accumulatedPauseMs ?? 0);
  const pausedAtRef = useRef<number | null>(initial?.pausedAtMs ?? null);

  const persist = useCallback(() => {
    saveState(manuscriptId, {
      startedAtMs: startedAtRef.current,
      accumulatedPauseMs: accumulatedPauseRef.current,
      pausedAtMs: pausedAtRef.current,
      direction,
    });
  }, [manuscriptId, direction]);

  // Countdown-fasen (3-2-1)
  useEffect(() => {
    if (!enabled || countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          // När countdown är klar → sätt verklig start nu
          startedAtRef.current = Date.now();
          accumulatedPauseRef.current = 0;
          pausedAtRef.current = null;
          persist();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown, enabled, persist]);

  // Tick — uppdaterar `now` varje sekund
  useEffect(() => {
    if (!enabled || countdown > 0) return;
    setNow(Date.now()); // omedelbar uppdatering
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled, countdown]);

  // Persistera vid mode-byten
  useEffect(() => {
    if (countdown === 0) persist();
  }, [direction, countdown, persist]);

  const isPaused = pausedAtRef.current !== null;

  // Förfluten tid sen start, exklusive paustid
  const elapsedMs = (() => {
    const reference = pausedAtRef.current ?? now;
    return Math.max(0, reference - startedAtRef.current - accumulatedPauseRef.current);
  })();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds = targetSeconds - elapsedSeconds;

  const pause = useCallback(() => {
    if (pausedAtRef.current !== null) return;
    pausedAtRef.current = Date.now();
    persist();
    setNow(Date.now());
  }, [persist]);

  const resume = useCallback(() => {
    if (pausedAtRef.current === null) return;
    accumulatedPauseRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = null;
    persist();
    setNow(Date.now());
  }, [persist]);

  const togglePause = useCallback(() => {
    if (pausedAtRef.current !== null) resume(); else pause();
  }, [pause, resume]);

  const toggleDirection = useCallback(() => {
    setDirection((d) => (d === "down" ? "up" : "down"));
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = Date.now();
    accumulatedPauseRef.current = 0;
    pausedAtRef.current = null;
    setCountdown(countdownSeconds);
    persist();
  }, [countdownSeconds, persist]);

  // Cleanup vid manuscript-byte (rensar inte vid vanlig unmount — vill bevara reload)
  // Anropare ansvarar för att rensa via clearTimer() vid exit.

  // Varningsfaser
  const warningThreshold = Math.min(120, Math.max(30, targetSeconds * 0.1));
  const isWarning = remainingSeconds > 0 && remainingSeconds <= warningThreshold;
  const isOverdue = remainingSeconds < 0;

  return {
    now,
    countdown,
    elapsedSeconds,
    remainingSeconds,
    targetSeconds,
    direction,
    isPaused,
    isWarning,
    isOverdue,
    mode,
    pause,
    resume,
    togglePause,
    toggleDirection,
    reset,
    /** Anropa vid exit för att inte återuppta vid nästa entry. */
    clearPersisted: () => clearState(manuscriptId),
  };
}

/** Formaterar HH:MM eller MM:SS beroende på antal sekunder. Negativ → "-MM:SS". */
export function formatElapsedSeconds(totalSeconds: number, alwaysShowSeconds = true): string {
  const sign = totalSeconds < 0 ? "−" : "";
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${sign}${h}:${pad(m)}:${pad(s)}`;
  return alwaysShowSeconds ? `${sign}${pad(m)}:${pad(s)}` : `${sign}${m} min`;
}

/** HH:MM utifrån Date. */
export function formatClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "X min kvar" — avrundat uppåt. */
export function formatMinutesLeft(seconds: number): string {
  if (seconds < 0) {
    const m = Math.ceil(Math.abs(seconds) / 60);
    return `${m} min över`;
  }
  if (seconds < 60) return "<1 min kvar";
  const m = Math.ceil(seconds / 60);
  return `${m} min kvar`;
}
