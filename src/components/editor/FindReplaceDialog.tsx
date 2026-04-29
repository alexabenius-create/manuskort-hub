import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { replaceInHtml, scanCardsForPlaceholders } from "@/lib/profilePlaceholders";
import { useT } from "@/i18n";

interface CardLite {
  id: string;
  content_html: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: CardLite[];
  /** Anropas med en lista av { id, html } för kort som ska uppdateras. */
  onApply: (updates: { id: string; html: string }[], totalReplacements: number) => Promise<void> | void;
  /** Initial sökterm — t.ex. när användaren klickar på en specifik platshållare. */
  initialSearch?: string;
}

export function FindReplaceDialog({ open, onOpenChange, cards, onApply, initialSearch }: Props) {
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch(initialSearch ?? "");
      setReplace("");
    }
  }, [open, initialSearch]);

  const placeholders = useMemo(() => scanCardsForPlaceholders(cards), [cards]);

  // Räkna preview-träffar utan att modifiera
  const previewCount = useMemo(() => {
    if (!search.trim()) return 0;
    let total = 0;
    for (const c of cards) {
      const { count } = replaceInHtml(c.content_html ?? "", search, replace);
      total += count;
    }
    return total;
  }, [cards, search, replace]);

  const handleApply = async () => {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const updates: { id: string; html: string }[] = [];
      let total = 0;
      for (const c of cards) {
        const { html, count } = replaceInHtml(c.content_html ?? "", search, replace);
        if (count > 0) {
          updates.push({ id: c.id, html });
          total += count;
        }
      }
      await onApply(updates, total);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold flex items-center gap-2">
            <Search className="h-5 w-5" /> Hitta & ersätt
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Söker i hela manuset. Skiftlägeskänslighet ignoreras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="find-search" className="text-[13px] text-muted-foreground font-medium">
              Hitta
            </Label>
            <Input
              id="find-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="t.ex. [ditt namn]"
              className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="find-replace" className="text-[13px] text-muted-foreground font-medium">
              Ersätt med
            </Label>
            <Input
              id="find-replace"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder="lämna tomt för att ta bort"
              className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />
          </div>

          {placeholders.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground font-medium">
                Platshållare i manuset
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSearch(p)}
                    className="inline-flex items-center gap-1 text-[12px] font-mono px-2.5 py-1 rounded-full bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] ring-1 ring-[hsl(var(--cue-amber))]/30 hover:bg-[hsl(var(--cue-amber))]/25 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[13px] text-muted-foreground">
            {search.trim()
              ? previewCount > 0
                ? `${previewCount} träff${previewCount === 1 ? "" : "ar"} hittad${previewCount === 1 ? "" : "e"}.`
                : "Inga träffar."
              : "Skriv något att leta efter."}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
            Avbryt
          </Button>
          <Button
            onClick={handleApply}
            disabled={busy || previewCount === 0}
            className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white"
          >
            Ersätt alla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
