import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aktuellt värde i sekunder, eller null. */
  value: number | null;
  /** Spara nytt värde (sekunder), eller null för att ta bort. */
  onSave: (seconds: number | null) => void;
  /** Extra-meddelande, t.ex. "Ange måltid för att starta presentationen." */
  intro?: string;
  /** Etiketten på "Spara"-knappen. Default: "Spara". */
  saveLabel?: string;
}

const QUICK_OPTIONS = [3, 5, 10, 15, 20]; // minuter
const MIN_SECONDS = 30;

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Tillåt "10", "10:00", "10:30"
  if (/^\d+$/.test(trimmed)) {
    const m = parseInt(trimmed, 10);
    return m * 60;
  }
  const match = trimmed.match(/^(\d{1,3}):(\d{1,2})$/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  if (s >= 60) return null;
  return m * 60 + s;
}

export function TargetDurationDialog({ open, onOpenChange, value, onSave, intro, saveLabel = "Spara" }: Props) {
  const [customInput, setCustomInput] = useState("");
  const [touched, setTouched] = useState(false);

  // Synka inputen med inkommande värde när dialogen öppnas
  useEffect(() => {
    if (open) {
      setCustomInput(value !== null ? formatMmSs(value) : "");
      setTouched(false);
    }
  }, [open, value]);

  const parsed = useMemo(() => parseMmSs(customInput), [customInput]);
  const isEmpty = customInput.trim() === "";
  const isInvalidFormat = !isEmpty && parsed === null;
  const isTooShort = parsed !== null && parsed < MIN_SECONDS;
  const canSave = !isEmpty && parsed !== null && !isTooShort;

  const handleQuick = (minutes: number) => {
    onSave(minutes * 60);
    onOpenChange(false);
  };

  const handleSave = () => {
    setTouched(true);
    if (!canSave) return;
    onSave(parsed);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onSave(null);
    onOpenChange(false);
  };

  const helperMessage = (() => {
    if (!touched && !customInput) return null;
    if (isInvalidFormat) return "Ange tid som mm:ss eller bara minuter (t.ex. 10 eller 12:30).";
    if (isTooShort) return "Måltiden måste vara minst 30 sekunder.";
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Måltid för manuset</DialogTitle>
          <DialogDescription>
            {intro ?? "Hur lång ska presentationen vara totalt? Tiden används av presentationsläget för att räkna ner och varna när tiden är på väg att ta slut."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[12px] text-muted-foreground">Snabba val</Label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleQuick(m)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-surface-2 hover:bg-accent-blue/10 hover:text-accent-blue transition-colors"
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="target-duration-custom" className="text-[12px] text-muted-foreground">
              Egen tid (mm:ss eller bara minuter)
            </Label>
            <Input
              id="target-duration-custom"
              value={customInput}
              onChange={(e) => { setCustomInput(e.target.value); setTouched(true); }}
              placeholder="t.ex. 12:30"
              inputMode="numeric"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              aria-invalid={!!helperMessage}
              aria-describedby={helperMessage ? "target-duration-help" : undefined}
            />
            {helperMessage && (
              <p id="target-duration-help" className="text-[12px] text-destructive">
                {helperMessage}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {value !== null && (
            <Button variant="ghost" onClick={handleRemove} className="text-muted-foreground hover:text-destructive">
              Ta bort måltid
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={!canSave} className="bg-accent-blue hover:bg-accent-blue/90 text-white">
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { formatMmSs as formatTargetDuration, parseMmSs as parseTargetDuration };
