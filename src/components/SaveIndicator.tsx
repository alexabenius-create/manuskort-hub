import { useSaveStatus } from "@/lib/saveStatus";
import { Check, Loader2, AlertCircle } from "lucide-react";

export function SaveIndicator() {
  const status = useSaveStatus();
  if (status === "idle") return <span aria-live="polite" className="sr-only">Sparat</span>;
  return (
    <span
      aria-live="polite"
      className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5"
    >
      {status === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Sparar…</>)}
      {status === "saved" && (<><Check className="h-3 w-3" /> Sparat</>)}
      {status === "error" && (<><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">Försöker igen…</span></>)}
    </span>
  );
}
