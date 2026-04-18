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

type PrintFormat = "a4-2up" | "a5-1up";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintDialog({ open, onOpenChange }: PrintDialogProps) {
  const [format, setFormat] = useState<PrintFormat>("a4-2up");

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

    const onAfterPrint = () => {
      document.documentElement.removeAttribute("data-print-format");
      const el = document.getElementById(STYLE_ID);
      if (el) el.remove();
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);
    document.documentElement.setAttribute("data-print-format", format);
    onOpenChange(false);
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
            label="A5 stående"
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
  return (
    <svg viewBox="0 0 60 80" className="h-20" aria-hidden>
      <rect x="6" y="8" width="48" height="64" rx="3" fill="hsl(var(--surface))" stroke="hsl(var(--faint))" strokeWidth="1" />
      <rect x="12" y="16" width="36" height="48" rx="2" fill="hsl(var(--surface-2))" />
    </svg>
  );
}
