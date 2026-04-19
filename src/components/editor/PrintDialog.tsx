import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PrintFormat = "a4-2up" | "a5-1up";
type FontSize = 12 | 14 | 16 | 18;
const FONT_SIZES: FontSize[] = [12, 14, 16, 18];

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintDialog({ open, onOpenChange }: PrintDialogProps) {
  const [format, setFormat] = useState<PrintFormat>("a4-2up");
  const [fontSize, setFontSize] = useState<FontSize>(16);

  const handlePrint = () => {
    const STYLE_ID = "print-page-size-style";
    // Injicera @page-regel dynamiskt — @page kan inte villkoras via attribut/klass
    const pageCSS =
      format === "a5-1up"
        ? "@page { size: A5 landscape; margin: 10mm; }"
        : "@page { size: A4 portrait; margin: 12mm; }";
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = pageCSS;

    // Mät-och-skala: räkna ut tillgänglig korthöjd för valt format och
    // sätt --print-script-scale per kort så att långt innehåll får plats.
    const MM_TO_PX = 3.7795275591; // 1mm @ 96dpi
    // A4 portrait: 297mm − 24mm marginal = 273mm för 2 kort (med ~12mm gap).
    // A5 landscape: 148mm höjd − 20mm marginal = 128mm för 1 kort.
    // Subtrahera ~20mm för header/times/cues/notes-padding som INTE skalas av --print-script-scale.
    const HEADER_OVERHEAD_MM = 20;
    const rawAvailableMm = format === "a5-1up" ? 128 - 4 : (273 - 12) / 2;
    const availableMm = rawAvailableMm - HEADER_OVERHEAD_MM;
    const availablePx = availableMm * MM_TO_PX;
    const cardWidthMm = format === "a5-1up" ? 190 : 186;
    const MIN_SCALE = 0.45;

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".manu-card"),
    );
    const scaledCards: HTMLElement[] = [];
    let clampedCount = 0;

    if (cards.length > 0) {
      const sandbox = document.createElement("div");
      sandbox.style.position = "fixed";
      sandbox.style.left = "-99999px";
      sandbox.style.top = "0";
      sandbox.style.width = `${cardWidthMm}mm`;
      sandbox.style.visibility = "hidden";
      sandbox.style.pointerEvents = "none";
      sandbox.setAttribute("data-print-measure-sandbox", "true");
      sandbox.setAttribute("data-print-format", format);
      document.body.appendChild(sandbox);

      // Duplicerar baseline-typografi i sandboxen — @media print kan inte
      // triggas utanför utskrift, så vi simulerar den medan vi mäter.
      const baselineCss =
        format === "a5-1up"
          ? `[data-print-measure-sandbox] .manu-card .ProseMirror { font-size: 16pt; line-height: 1.55; }
             [data-print-measure-sandbox] .manu-card .card-panel-notes textarea { font-size: 12pt; line-height: 1.45; }`
          : `[data-print-measure-sandbox] .manu-card .ProseMirror { font-size: 16pt; line-height: 1.5; }
             [data-print-measure-sandbox] .manu-card .card-panel-notes textarea { font-size: 12pt; line-height: 1.4; }`;
      const measureStyle = document.createElement("style");
      measureStyle.id = "print-measure-style";
      measureStyle.textContent = baselineCss;
      document.head.appendChild(measureStyle);

      try {
        cards.forEach((card) => {
          const clone = card.cloneNode(true) as HTMLElement;
          clone.style.removeProperty("--print-script-scale");
          clone.style.height = "auto";
          clone.style.maxHeight = "none";
          clone.style.overflow = "visible";
          sandbox.innerHTML = "";
          sandbox.appendChild(clone);
          // Mät endast skalbara delar (script + notes), inte hela kortet.
          const script = clone.querySelector<HTMLElement>(".card-panel-script");
          const notes = clone.querySelector<HTMLElement>(".card-panel-notes");
          const measured =
            (script?.scrollHeight ?? 0) + (notes?.scrollHeight ?? 0);
          if (measured > availablePx && measured > 0) {
            const raw = availablePx / measured;
            const scale = Math.max(MIN_SCALE, Math.min(1, raw));
            if (raw < MIN_SCALE) clampedCount += 1;
            card.style.setProperty("--print-script-scale", scale.toFixed(3));
            scaledCards.push(card);
          }
        });
      } finally {
        sandbox.remove();
        measureStyle.remove();
      }
    }

    const onAfterPrint = () => {
      document.documentElement.removeAttribute("data-print-format");
      const el = document.getElementById(STYLE_ID);
      if (el) el.remove();
      scaledCards.forEach((c) => c.style.removeProperty("--print-script-scale"));
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);
    document.documentElement.setAttribute("data-print-format", format);
    onOpenChange(false);
    if (clampedCount > 0) {
      toast.warning(
        `${clampedCount} kort skalades till minsta storlek — innehåll kan vara klippt. Korta texten på de korten för bästa resultat.`,
        { duration: 8000 },
      );
    }
    // Vänta in DOM-uppdateringen så CSS hinner aktiveras innan print-dialogen öppnas
    setTimeout(() => window.print(), 80);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Skriv ut manus</DialogTitle>
          <DialogDescription>
            Välj sidformat. Du kan också välja "Spara som PDF" i nästa dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <FormatOption
            active={format === "a4-2up"}
            onClick={() => setFormat("a4-2up")}
            label="A4 stående"
            sublabel="2 kort per sida"
          >
            <PreviewA4 />
          </FormatOption>

          <FormatOption
            active={format === "a5-1up"}
            onClick={() => setFormat("a5-1up")}
            label="A5 liggande"
            sublabel="1 kort per sida"
          >
            <PreviewA5 />
          </FormatOption>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-accent-blue hover:bg-accent-blue/90 text-white"
          >
            Skriv ut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormatOption({
  active,
  onClick,
  label,
  sublabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border bg-surface p-4 text-left transition-all",
        active
          ? "border-accent-blue ring-2 ring-accent-blue/30 shadow-card"
          : "border-hair hover:border-hair-strong hover:bg-surface-2",
      )}
    >
      <div className="flex h-24 w-full items-center justify-center">
        {children}
      </div>
      <div className="flex w-full flex-col">
        <span className="text-[14px] font-semibold text-foreground">{label}</span>
        <span className="text-[12px] text-muted-foreground">{sublabel}</span>
      </div>
    </button>
  );
}

function PreviewA4() {
  return (
    <svg viewBox="0 0 60 80" className="h-20" aria-hidden>
      <rect x="1" y="1" width="58" height="78" rx="3" fill="hsl(var(--surface))" stroke="hsl(var(--faint))" strokeWidth="1" />
      <rect x="8" y="8" width="44" height="30" rx="2" fill="hsl(var(--surface-2))" />
      <rect x="8" y="42" width="44" height="30" rx="2" fill="hsl(var(--surface-2))" />
    </svg>
  );
}

function PreviewA5() {
  // A5 liggande — 1 kort per sida
  return (
    <svg viewBox="0 0 80 60" className="h-20" aria-hidden>
      <rect x="2" y="6" width="76" height="48" rx="3" fill="hsl(var(--surface))" stroke="hsl(var(--faint))" strokeWidth="1" />
      <rect x="10" y="14" width="60" height="32" rx="2" fill="hsl(var(--surface-2))" />
    </svg>
  );
}
