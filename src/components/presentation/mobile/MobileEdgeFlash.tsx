import { useEffect, useState } from "react";

interface Props {
  /** Aktuellt kortindex — ändring triggar flash. */
  currentIndex: number;
}

/**
 * Subtil edge-flash vid kortbyte i mobil-v2.
 *
 * Lyssnar på currentIndex. Vid ökning → flash från höger kant (kom in från höger).
 * Vid minskning → flash från vänster kant. Försvinner efter ~280 ms.
 * Ignorerar första render (ingen flash vid mount).
 */
export function MobileEdgeFlash({ currentIndex }: Props) {
  const [flash, setFlash] = useState<"left" | "right" | null>(null);
  const [prev, setPrev] = useState<number>(currentIndex);

  useEffect(() => {
    if (currentIndex === prev) return;
    const dir = currentIndex > prev ? "right" : "left";
    setPrev(currentIndex);
    setFlash(dir);
    const t = window.setTimeout(() => setFlash(null), 280);
    return () => window.clearTimeout(t);
  }, [currentIndex, prev]);

  if (!flash) return null;

  const gradient =
    flash === "right"
      ? "linear-gradient(to left, hsl(0 0% 100% / 0.10), transparent 35%)"
      : "linear-gradient(to right, hsl(0 0% 100% / 0.10), transparent 35%)";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 animate-fade-in"
      style={{ background: gradient }}
      aria-hidden="true"
    />
  );
}
