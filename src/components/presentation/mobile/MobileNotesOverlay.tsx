import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

interface Props {
  card: Card;
  onNotesChange: (cardId: string, notes: string) => void;
  onClose: () => void;
}

/**
 * Mobil-v2 anteckningsöverlägg.
 *
 * Fullskärms-overlay (z-50) ovanpå manustexten. Stor mono-textarea, autosparas
 * via onNotesChange. Stäng med X, tap på mörk bakgrund eller Escape.
 */
export function MobileNotesOverlay({ card, onNotesChange, onClose }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

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
        // Tap på mörk bakgrund (utanför textarea) stänger
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Anteckningar
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 active:bg-zinc-800/60"
          aria-label="Stäng anteckningar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 px-4 pb-4"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <textarea
          ref={textareaRef}
          value={card.notes ?? ""}
          onChange={(e) => onNotesChange(card.id, e.target.value)}
          onKeyDown={(e) => {
            // Låt Escape bubbla till window-listenern, men stoppa övriga genvägar
            if (e.key !== "Escape") e.stopPropagation();
          }}
          placeholder="Skriv anteckningar för det här kortet…"
          className="font-mono text-zinc-200 placeholder:text-zinc-600 w-full h-full bg-transparent border-0 outline-none resize-none focus:ring-0 focus:outline-none caret-zinc-300 selection:bg-zinc-700/60 text-center"
          style={{ fontSize: "16px", lineHeight: 1.6 }}
        />
      </div>
    </div>
  );
}
