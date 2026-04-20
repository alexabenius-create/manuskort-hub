import { useEffect, useState } from "react";

/**
 * Robust detektor för handhållen enhet (mobil/tablet).
 *
 * Använder en kombination av signaler som är stabila över rotationer:
 *  - `matchMedia("(pointer: coarse)")` — touch-primär enhet
 *  - `navigator.maxTouchPoints > 0` — har touchskärm
 *  - User Agent-fallback för mobil/tablet
 *
 * Till skillnad från `useIsMobile()` (som tittar på `window.innerWidth < 768`)
 * påverkas inte denna av att en iPhone i landskap kan ha bredd > 768 px.
 */
export function useIsHandheldDevice(): boolean {
  const [isHandheld, setIsHandheld] = useState<boolean>(() => detect());

  useEffect(() => {
    // Kör en gång till efter mount (SSR/hydration safety) och lyssna på pointer-ändringar.
    setIsHandheld(detect());
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => setIsHandheld(detect());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isHandheld;
}

function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const touch = (navigator.maxTouchPoints ?? 0) > 0;
    const ua = navigator.userAgent || "";
    const uaMobile =
      /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|Opera Mini|IEMobile/i.test(ua);
    return coarse || touch || uaMobile;
  } catch {
    return false;
  }
}
