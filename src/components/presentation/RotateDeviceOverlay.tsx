import { Smartphone } from "lucide-react";

interface Props {
  onContinueAnyway: () => void;
}

/**
 * Overlay som uppmanar användaren att vrida telefonen till liggande läge
 * för bästa läsupplevelse. Visas bara på mobil i porträtt under aktiv presentation.
 */
export function RotateDeviceOverlay({ onContinueAnyway }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-sm flex flex-col items-center justify-center px-8 text-center"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
      }}
      role="dialog"
      aria-label="Vänd telefonen för bästa läsupplevelse"
    >
      <div className="relative mb-8">
        <Smartphone
          className="h-24 w-24 text-zinc-300 animate-rotate-device"
          strokeWidth={1.5}
        />
      </div>
      <h2 className="text-zinc-100 text-[22px] font-display font-semibold mb-3 leading-tight">
        Vrid telefonen
      </h2>
      <p className="text-zinc-400 text-[15px] leading-relaxed max-w-xs">
        Liggande läge ger dig en mycket större läsyta för manuset.
      </p>
      <p className="text-zinc-500 text-[12px] leading-relaxed max-w-xs mt-6">
        💡 Tips för iPhone: tryck på <span className="text-zinc-300">Dela</span> i Safari och välj{" "}
        <span className="text-zinc-300">Lägg till på hemskärmen</span> för att köra Manuskort i fullskärm utan adressfält.
      </p>
      <button
        onClick={onContinueAnyway}
        className="mt-8 text-zinc-500 hover:text-zinc-300 text-[13px] underline underline-offset-4 transition-colors"
      >
        Fortsätt ändå i stående läge
      </button>
    </div>
  );
}
