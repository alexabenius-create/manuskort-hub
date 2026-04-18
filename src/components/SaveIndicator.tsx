import { useSaveStatus } from "@/lib/saveStatus";
import { Check, Loader2, AlertCircle } from "lucide-react";

export function SaveIndicator() {
  const status = useSaveStatus();
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
