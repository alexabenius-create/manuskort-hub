import { useEffect, useState } from "react";

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

interface Props {
  onStartCountdown: () => void;
  onStartInstant: () => void;
  onExit: () => void;
}

export function PresentationStartMenu({ onStartCountdown, onStartInstant, onExit }: Props) {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onStartCountdown();
      } else if (e.key === " ") {
        e.preventDefault();
        onStartInstant();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [onStartCountdown, onStartInstant, onExit]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-16 bg-zinc-900/95 backdrop-blur-md animate-in fade-in duration-500 px-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-3xl">
        <h1 className="text-zinc-100 text-[44px] md:text-[56px] leading-tight font-medium tracking-tight">
          {message}
        </h1>
        <p className="text-zinc-500 text-[16px] md:text-[18px]">Du är redo.</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          <button
            onClick={onStartCountdown}
            className="rounded-full bg-white text-black px-12 py-6 text-[22px] font-medium hover:bg-zinc-200 transition-colors shadow-2xl shadow-black/30 active:scale-[0.98]"
          >
            Starta med 3 sekunders nedräkning
          </button>
          <button
            onClick={onStartInstant}
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
