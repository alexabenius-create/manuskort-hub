// Globalt sparstatus-tillstånd för spar-indikatorn i toppbaren.
import { useSyncExternalStore } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

let status: SaveStatus = "idle";
let savingCount = 0;
let savedTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function beginSave() {
  savingCount++;
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null; }
  if (status !== "saving") { status = "saving"; emit(); }
}

export function endSave(ok: boolean) {
  savingCount = Math.max(0, savingCount - 1);
  if (savingCount > 0) return;
  if (!ok) {
    status = "error";
    emit();
    return;
  }
  status = "saved";
  emit();
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    status = "idle";
    emit();
  }, 2000);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => status, () => status);
}
