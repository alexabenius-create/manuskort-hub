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
// Persisterad state är endast giltig om den är "färsk" — annars startar vi om
// från nedräkning. Skyddar mot att en gammal session i sessionStorage (efter
// reload, kraschad flik eller utveckling med HMR) hoppar över countdown och
// gör att klockan/scroll-offset hoppar långt fram.
const PERSIST_FRESHNESS_MS = 5 * 60 * 1000;

function loadState(manuscriptId: string): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + manuscriptId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed.startedAtMs !== "number") return null;
    // Om referensklockan (paus eller startedAt) är äldre än TTL → behandla som stale.
    const reference = parsed.pausedAtMs ?? parsed.startedAtMs;
    if (Date.now() - reference > PERSIST_FRESHNESS_MS) {
      sessionStorage.removeItem(STORAGE_PREFIX + manuscriptId);
      return null;
    }
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
  // Återställ från sessionStorage om finns. Vid första render där enabled=false
  // (typiskt när Presentation.tsx monteras med startMode=null) ignorerar vi
  // initial helt — annars riskerar vi att hoppa över countdown vid nästa start.
  // Persisterad state ska bara återupplivas om hooken aktiveras direkt vid mount
  // (t.ex. efter reload mitt under en pågående presentation).
  const initialRef = useRef<PersistedState | null>(enabled ? loadState(manuscriptId) : null);
  const initial = initialRef.current;

  const [now, setNow] = useState<number>(Date.now());
  // Initiera countdown till 0 om timern inte är aktiv än — sätts korrekt när enabled blir true.
  const [countdown, setCountdown] = useState<number>(
    initial ? 0 : enabled && countdownSeconds > 0 ? countdownSeconds : 0
  );

  const [direction, setDirection] = useState<ElapsedDirection>(initial?.direction ?? "down");

  // Drift-fri tidshantering med wall-clock + ackumulerad paustid
  const startedAtRef = useRef<number>(initial?.startedAtMs ?? Date.now());
  const accumulatedPauseRef = useRef<number>(initial?.accumulatedPauseMs ?? 0);
  const pausedAtRef = useRef<number | null>(initial?.pausedAtMs ?? null);

  // När timern aktiveras (enabled false → true): starta countdown om sådan ska köras.
  // Tidigare användes en hasInitializedRef som kunde hänga kvar i fel state mellan
  // start-försök; nu kollar vi en explicit "har vi redan startat denna session"-flagga.
  const hasStartedRef = useRef(!!initial || (enabled && countdownSeconds === 0));
  useEffect(() => {
    if (!enabled) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    if (countdownSeconds > 0) {
      setCountdown(countdownSeconds);
    } else {
      // Starta direkt utan countdown — nollställ tidsreferenser.
      startedAtRef.current = Date.now();
      accumulatedPauseRef.current = 0;
      pausedAtRef.current = null;
      setCountdown(0);
    }
  }, [enabled, countdownSeconds]);

  const persist = useCallback(() => {
    saveState(manuscriptId, {
      startedAtMs: startedAtRef.current,
      accumulatedPauseMs: accumulatedPauseRef.current,
      pausedAtMs: pausedAtRef.current,
      direction,
    });
  }, [manuscriptId, direction]);

  // Countdown-fasen (3-2-1) — drift-fri via wall-clock
  const countdownStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (countdown <= 0) {
      countdownStartRef.current = null;
      return;
    }
    if (countdownStartRef.current === null) {
      countdownStartRef.current = Date.now();
    }
    const tick = () => {
      const start = countdownStartRef.current;
      if (start === null) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = countdownSeconds - elapsed;
      if (remaining <= 0) {
        startedAtRef.current = Date.now();
        accumulatedPauseRef.current = 0;
        pausedAtRef.current = null;
        countdownStartRef.current = null;
        setCountdown(0);
        persist();
      } else {
        setCountdown(remaining);
      }
    };
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [enabled, countdown, countdownSeconds, persist]);

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

/** HH:MM eller HH:MM:SS utifrån Date. */
export function formatClock(date: Date, withSeconds = false): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base;
}

/** "X min kvar" — avrundat uppåt. Sekundprecision under 1 min. */
export function formatMinutesLeft(seconds: number): string {
  if (seconds < 0) {
    const abs = Math.abs(seconds);
    if (abs < 60) return `${abs} sek över`;
    const m = Math.ceil(abs / 60);
    return `${m} min över`;
  }
  if (seconds < 60) return `${seconds} sek kvar`;
  const m = Math.ceil(seconds / 60);
  return `${m} min kvar`;
}
