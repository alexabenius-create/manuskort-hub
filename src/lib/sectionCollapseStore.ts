/**
 * sectionCollapseStore — håller koll på vilka sections som är kollapsade i
 * editorn. Per-manuscript persistens i localStorage. Komponenter läser via
 * useCollapsedSections() och anropar toggleSection() för att växla.
 */
import { useSyncExternalStore } from "react";

type State = Record<string, Set<string>>; // manuscriptId -> Set<sectionId>

const LS_PREFIX = "manuskort:section-collapsed:";

const state: State = {};
const listeners = new Set<() => void>();

function load(manuscriptId: string): Set<string> {
  if (state[manuscriptId]) return state[manuscriptId];
  try {
    const raw = localStorage.getItem(LS_PREFIX + manuscriptId);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    state[manuscriptId] = new Set(arr);
  } catch {
    state[manuscriptId] = new Set();
  }
  return state[manuscriptId];
}

function persist(manuscriptId: string) {
  try {
    const set = state[manuscriptId];
    localStorage.setItem(
      LS_PREFIX + manuscriptId,
      JSON.stringify(set ? Array.from(set) : []),
    );
  } catch {
    /* ignore quota */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function toggleSection(manuscriptId: string, sectionId: string) {
  const set = load(manuscriptId);
  if (set.has(sectionId)) set.delete(sectionId);
  else set.add(sectionId);
  state[manuscriptId] = new Set(set); // ny referens för useSyncExternalStore
  persist(manuscriptId);
  emit();
}

export function isSectionCollapsed(manuscriptId: string, sectionId: string): boolean {
  return load(manuscriptId).has(sectionId);
}

export function useCollapsedSections(manuscriptId: string): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(manuscriptId),
    () => new Set<string>(),
  );
}
