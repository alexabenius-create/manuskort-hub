import { useEffect } from "react";
import { X, Keyboard, Hand } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  viewMode: "cards" | "scroll";
}

interface Shortcut {
  keys: string[];
  label: string;
}

const cardShortcuts: Shortcut[] = [
  { keys: ["→", "Space", "PgDn"], label: "Nästa kort" },
  { keys: ["←", "PgUp"], label: "Föregående kort" },
  { keys: ["P"], label: "Hoppa till panik-kort" },
  { keys: ["Esc"], label: "Avsluta presentation" },
];

const scrollShortcuts: Shortcut[] = [
  { keys: ["+"], label: "Höj rullningshastighet" },
  { keys: ["−"], label: "Sänk rullningshastighet" },
  { keys: ["R"], label: "Återställ hastighet (1.00×)" },
  { keys: ["P"], label: "Hoppa till panik-kort" },
  { keys: ["Esc"], label: "Avsluta presentation" },
];

const gestures: Shortcut[] = [
  { keys: ["Svep ←"], label: "Nästa kort" },
  { keys: ["Svep →"], label: "Föregående kort" },
  { keys: ["Tap höger"], label: "Nästa kort" },
  { keys: ["Tap vänster"], label: "Föregående kort" },
];

export function HelpOverlay({ open, onClose, viewMode }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts = viewMode === "scroll" ? scrollShortcuts : cardShortcuts;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-[90%] max-h-[85vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl shadow-black/60 p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          aria-label="Stäng hjälp"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="font-display text-[28px] text-zinc-100 mb-2">Genvägar & gester</h2>
        <p className="font-mono text-[13px] text-zinc-500 mb-8">
          Tryck <Kbd>?</Kbd> eller <Kbd>H</Kbd> när som helst för att öppna denna hjälp igen.
        </p>

        <div className="space-y-8">
          <Section icon={<Keyboard className="h-5 w-5" />} title="Tangentbord">
            <ul className="space-y-3">
              {shortcuts.map((s) => (
                <Row key={s.label} item={s} />
              ))}
            </ul>
          </Section>

          <Section icon={<Hand className="h-5 w-5" />} title="Pekgester (kort-läge)">
            <ul className="space-y-3">
              {gestures.map((s) => (
                <Row key={s.label} item={s} />
              ))}
            </ul>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-[14px] transition-colors"
          >
            Okej, kör igång
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-zinc-400">
        {icon}
        <h3 className="font-mono text-[12px] uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ item }: { item: Shortcut }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-zinc-200 text-[15px]">{item.label}</span>
      <span className="flex items-center gap-1.5">
        {item.keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-600 text-[12px]">eller</span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-[12px] tabular-nums shadow-sm">
      {children}
    </kbd>
  );
}
