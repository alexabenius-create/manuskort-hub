import { useEffect, useState } from "react";
import { Hand, MoveHorizontal } from "lucide-react";

interface Props {
  onDismiss: () => void;
}

/**
 * Mobil-v2 första-gången-tips.
 *
 * Visar kort overlay med två gester: "Tap i mitten för kontroller" och
 * "Svep för att byta kort". Försvinner efter 3 sek eller vid tap. Visas
 * bara första gången per enhet (kontrolleras av parent via localStorage).
 *
 * Fade-out under sista 400 ms innan unmount.
 */
export function MobileFirstRunHint({ onDismiss }: Props) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 2600);
    const dismissTimer = window.setTimeout(() => onDismiss(), 3000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center transition-opacity duration-400 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      onPointerDown={onDismiss}
      role="dialog"
      aria-label="Snabbtips"
    >
      <div className="flex flex-col gap-6 items-center px-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Hand className="h-10 w-10 text-zinc-200" strokeWidth={1.5} />
          <p className="font-mono text-zinc-100 text-base">
            Tap i mitten för kontroller
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <MoveHorizontal className="h-10 w-10 text-zinc-200" strokeWidth={1.5} />
          <p className="font-mono text-zinc-100 text-base">
            Svep för att byta kort
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 mt-2">
          Tap för att stänga
        </p>
      </div>
    </div>
  );
}
