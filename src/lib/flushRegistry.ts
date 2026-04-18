// Globalt register över pending autospar-flushes.
// beforeunload / pagehide / visibilitychange → kör alla synkront.
type FlushFn = () => void;

const pending = new Map<string, FlushFn>();

export function registerFlush(key: string, fn: FlushFn) {
  pending.set(key, fn);
}

export function unregisterFlush(key: string) {
  pending.delete(key);
}

export function flushAll() {
  for (const fn of pending.values()) {
    try { fn(); } catch (e) { console.error("flush error", e); }
  }
}

let installed = false;
export function installFlushHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const handler = () => flushAll();
  window.addEventListener("beforeunload", handler);
  window.addEventListener("pagehide", handler);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}
