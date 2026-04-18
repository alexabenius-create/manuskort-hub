// useAutosave — debouncad sparning per kort (eller per manus).
// Diff:ar mot snapshot, kör en UPDATE per "row".
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerFlush, unregisterFlush } from "@/lib/flushRegistry";
import { beginSave, endSave } from "@/lib/saveStatus";

type Table = "cards" | "manuscripts";

interface Options<T extends Record<string, any>> {
  table: Table;
  id: string;
  data: T;
  enabled?: boolean;
  delay?: number; // ms
}

function shallowDiff<T extends Record<string, any>>(a: T, b: T): Partial<T> | null {
  const out: Partial<T> = {};
  let changed = false;
  for (const k of Object.keys(b) as (keyof T)[]) {
    if (a[k] !== b[k]) { out[k] = b[k]; changed = true; }
  }
  return changed ? out : null;
}

export function useAutosave<T extends Record<string, any>>({ table, id, data, enabled = true, delay = 800 }: Options<T>) {
  const snapshotRef = useRef<T>(data);
  const latestRef = useRef<T>(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const initRef = useRef(false);
  const key = `${table}:${id}`;

  // Initial snapshot på första render — hoppa över första sparningen
  useEffect(() => {
    if (!initRef.current) {
      snapshotRef.current = data;
      initRef.current = true;
    }
    latestRef.current = data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const doSave = async () => {
    const diff = shallowDiff(snapshotRef.current, latestRef.current);
    if (!diff) return;
    const payload = { ...diff } as any;
    const snapshotAtSend = { ...latestRef.current };
    beginSave();
    try {
      const { error } = await supabase.from(table).update(payload).eq("id", id);
      if (error) throw error;
      snapshotRef.current = snapshotAtSend;
      endSave(true);
    } catch (e) {
      console.error(`[autosave ${key}]`, e);
      endSave(false);
      // Enkel retry: lämna snapshot orörd så nästa diff försöker igen
    }
  };

  const flush = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    void doSave();
  };

  useEffect(() => {
    if (!enabled || !initRef.current) return;
    const diff = shallowDiff(snapshotRef.current, latestRef.current);
    if (!diff) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void doSave();
    }, delay);
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), enabled, delay]);

  // Registrera flush för beforeunload
  useEffect(() => {
    if (!enabled) return;
    registerFlush(key, flush);
    return () => unregisterFlush(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, id]);

  return { flush };
}
