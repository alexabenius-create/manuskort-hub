import { useSaveStatus } from "@/lib/saveStatus";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Kompakt = bara ikon + tooltip. Default: false (ikon + text). */
  compact?: boolean;
}

export function SaveIndicator({ compact = false }: Props) {
  const status = useSaveStatus();

  if (compact) {
    const label =
      status === "saving" ? "Sparar ändringar…" :
      status === "error" ? "Kunde inte spara — försöker igen" :
      "Alla ändringar sparade";
    const dot =
      status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> :
      status === "error" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> :
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--cue-teal))]" aria-hidden />;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            aria-live="polite"
            aria-label={label}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-2 transition-colors cursor-default"
          >
            {dot}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px] rounded-lg">{label}</TooltipContent>
      </Tooltip>
    );
  }

  if (status === "idle") return <span aria-live="polite" className="sr-only">Sparat</span>;
  return (
    <span
      aria-live="polite"
      className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5"
    >
      {status === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sparar…</>)}
      {status === "saved" && (<><Check className="h-3.5 w-3.5" /> Sparat</>)}
      {status === "error" && (<><AlertCircle className="h-3.5 w-3.5 text-destructive" /> <span className="text-destructive">Försöker igen…</span></>)}
    </span>
  );
}
