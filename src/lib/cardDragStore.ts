/**
 * cardDragStore — minimalt pub/sub-state för pågående cardBlock-drag.
 * Används av CardBlockView för att visa/dölja drop-zoner och dim:a källkortet.
 */
import { useSyncExternalStore } from "react";

let draggingPos: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setDraggingCardPos(pos: number | null) {
  if (draggingPos === pos) return;
  draggingPos = pos;
  emit();
}

export function getDraggingCardPos(): number | null {
  return draggingPos;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDraggingCardPos(): number | null {
  return useSyncExternalStore(subscribe, getDraggingCardPos, getDraggingCardPos);
}
