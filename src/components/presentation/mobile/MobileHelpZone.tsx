import { useRef } from "react";

interface Props {
  /** Anropas när användaren tappar i mitten — togglar UI-synlighet (X, ?, zoom). */
  onCenterTap: () => void;
  /** Anropas vid svep åt vänster (→ nästa). */
  onSwipeLeft: () => void;
  /** Anropas vid svep åt höger (← föregående). */
  onSwipeRight: () => void;
}

/**
 * Mobil-v2 central tap-zone.
 *
 * Osynlig overlay över manustextytan (row-start-2). Hanterar:
 *  - Tap i mittenzonen (30–70% bredd × 35–75% höjd) → toggla UI
 *  - Svep vänster/höger → byt kort
 *
 * Vi exkluderar topp/botten via mittenzonen så vi inte stör topbar/footer-tap.
 */
export function MobileHelpZone({ onCenterTap, onSwipeLeft, onSwipeRight }: Props) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const handleStart = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };

  const handleEnd = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
      return;
    }

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const inHorizCenter = e.clientX > w * 0.3 && e.clientX < w * 0.7;
      const inVertCenter = e.clientY > h * 0.35 && e.clientY < h * 0.75;
      if (inHorizCenter && inVertCenter) {
        onCenterTap();
      }
    }
  };

  return (
    <div
      className="absolute inset-0 z-20 bg-transparent"
      style={{ touchAction: "pan-y" }}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      aria-hidden="true"
    />
  );
}

