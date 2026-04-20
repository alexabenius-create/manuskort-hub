import { useEffect } from "react";
import { X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

interface Props {
  card: Card;
  /** Behålls för API-kompatibilitet men används inte — anteckningar är read-only på mobil. */
  onNotesChange?: (cardId: string, notes: string) => void;
  onClose: () => void;
}

/**
 * Mobil-v2 anteckningsöverlägg (read-only).
 *
 * Fullskärms-overlay (z-50) ovanpå manustexten. Visar kortets anteckningar i
 * läsläge — redigering sker i editorn, inte här. Stäng med stort kryss,
 * tap på bakgrunden eller Escape.
 */
export function MobileNotesOverlay({ card, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const notes = (card.notes ?? "").trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Anteckningar
        </span>
        <button
          onClick={onClose}
          className="p-3 -mr-1 rounded-lg text-zinc-300 hover:text-zinc-100 active:bg-zinc-800/60 touch-manipulation"
          aria-label="Stäng anteckningar"
          style={{ minWidth: 48, minHeight: 48 }}
        >
          <X className="h-7 w-7" strokeWidth={2.25} />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto flex items-center justify-center"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {notes ? (
          <p
            className="font-mono text-zinc-200 whitespace-pre-wrap text-center max-w-prose"
            style={{ fontSize: "16px", lineHeight: 1.6 }}
          >
            {notes}
          </p>
        ) : (
          <p className="font-mono text-zinc-600 text-center" style={{ fontSize: "14px" }}>
            Inga anteckningar för det här kortet.
          </p>
        )}
      </div>
    </div>
  );
}
