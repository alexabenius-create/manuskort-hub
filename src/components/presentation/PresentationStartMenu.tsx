import { useEffect, useMemo, useState } from "react";

const MESSAGES = [
  "Du har förberett dig — nu är det din tur. ✨",
  "Andas. Du äger rummet. 🌬️",
  "Det här blir bra. 🌟",
  "Publiken är på din sida. 🤝",
  "Du har något viktigt att säga. 💬",
  "Lugn. Rak. Tydlig. 🧭",
  "En mening i taget. 🪜",
  "Du behöver inte vara perfekt — bara närvarande. 🌿",
  "Det är dina ord. Lita på dem. 📜",
  "Visa dem vad du kan. 🚀",
];

export type ViewMode = "cards" | "scroll";
export type FocusStyle = "line" | "sentence";

export interface SectionOption {
  id: string;
  label: string;
  cardCount: number;
}

interface Props {
  onStartCountdown: (opts: { viewMode: ViewMode; focusStyle: FocusStyle; sectionId: string | null }) => void;
  onStartInstant: (opts: { viewMode: ViewMode; focusStyle: FocusStyle; sectionId: string | null }) => void;
  onExit: () => void;
  /** Estimerad max-fart som krävs (1.0 = normalt). Om > 3.0 visas varning. */
  estimatedSpeedFactor?: number;
  /** Sektioner i manuset. Om ≥ 2, visas valet i menyn. */
  sections?: SectionOption[];
}

export function PresentationStartMenu({ onStartCountdown, onStartInstant, onExit, estimatedSpeedFactor, sections }: Props) {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [focusStyle, setFocusStyle] = useState<FocusStyle>("line");
  const hasSections = (sections?.length ?? 0) >= 2;
  // Default: senaste sektionen (sista i listan)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    hasSections ? sections![sections!.length - 1].id : null,
  );

  const speedWarning = useMemo(() => {
    if (viewMode !== "scroll") return null;
    if (!estimatedSpeedFactor || estimatedSpeedFactor <= 3.0) return null;
    return "Manuset är för långt för vald måltid vid normal läsfart — rullningen kapas vid 3.0×.";
  }, [viewMode, estimatedSpeedFactor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onStartCountdown({ viewMode, focusStyle, sectionId: selectedSectionId });
      } else if (e.key === " ") {
        e.preventDefault();
        onStartInstant({ viewMode, focusStyle, sectionId: selectedSectionId });
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [onStartCountdown, onStartInstant, onExit, viewMode, focusStyle, selectedSectionId]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-12 bg-zinc-900/95 backdrop-blur-md animate-in fade-in duration-500 px-8 overflow-y-auto py-12">
      <div className="flex flex-col items-center gap-4 text-center max-w-3xl">
        <h1 className="text-zinc-100 text-[44px] md:text-[56px] leading-tight font-medium tracking-tight">
          {message}
        </h1>
        <p className="text-zinc-500 text-[16px] md:text-[18px]">Du är redo.</p>
      </div>

      {/* Visningsläge */}
      <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Visningsläge</span>
        <div className="inline-flex bg-zinc-800/60 rounded-2xl p-2 gap-1">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-6 py-3 rounded-xl text-[15px] font-medium transition-colors ${
              viewMode === "cards" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Ett kort i taget
          </button>
          <button
            onClick={() => setViewMode("scroll")}
            className={`px-6 py-3 rounded-xl text-[15px] font-medium transition-colors inline-flex items-center gap-2 ${
              viewMode === "scroll" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Mjuk rullning
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              Beta
            </span>
          </button>
        </div>

        {viewMode === "scroll" && (
          <div className="flex flex-col items-center gap-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Fokus-markör</span>
            <div className="inline-flex bg-zinc-800/60 rounded-2xl p-2 gap-1">
              <button
                onClick={() => setFocusStyle("line")}
                className={`px-5 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                  focusStyle === "line" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Fast läs-linje
              </button>
              <button
                onClick={() => setFocusStyle("sentence")}
                className={`px-5 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                  focusStyle === "sentence" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Highlight på aktiv mening
              </button>
            </div>
            {speedWarning && (
              <p className="text-amber-400 text-[13px] max-w-md text-center mt-2">
                ⚠ {speedWarning}
              </p>
            )}
            <p className="text-zinc-600 text-[12px] text-center max-w-md">
              Tangenter: <span className="font-mono text-zinc-500">+/−</span> ändrar hastighet, <span className="font-mono text-zinc-500">R</span> återställer.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          <button
            onClick={() => onStartCountdown({ viewMode, focusStyle })}
            className="rounded-full bg-white text-black px-12 py-6 text-[22px] font-medium hover:bg-zinc-200 transition-colors shadow-2xl shadow-black/30 active:scale-[0.98]"
          >
            Starta med 3 sekunders nedräkning
          </button>
          <button
            onClick={() => onStartInstant({ viewMode, focusStyle })}
            className="rounded-full bg-zinc-900 text-zinc-100 border border-zinc-700 px-12 py-6 text-[22px] font-medium hover:bg-zinc-800 transition-colors active:scale-[0.98]"
          >
            Starta direkt
          </button>
        </div>

        <button
          onClick={onExit}
          className="text-zinc-500 hover:text-zinc-300 text-[15px] py-3 px-6 transition-colors"
        >
          Avsluta och återgå till redigering
        </button>
      </div>
    </div>
  );
}
