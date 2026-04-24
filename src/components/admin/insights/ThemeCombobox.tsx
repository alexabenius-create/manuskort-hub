import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  themes: string[];
  placeholder?: string;
  className?: string;
}

export function ThemeCombobox({ value, onChange, themes, placeholder = "Välj eller skapa tema…", className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...themes].sort((a, b) => a.localeCompare(b, "sv")), [themes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.toLowerCase().includes(q));
  }, [sorted, query]);

  const exactMatch = useMemo(
    () => sorted.some((t) => t.toLowerCase() === query.trim().toLowerCase()),
    [sorted, query],
  );

  const select = (t: string) => {
    onChange(t);
    setQuery("");
    setOpen(false);
  };

  const createNew = () => {
    const t = query.trim();
    if (!t) return;
    onChange(t);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal text-[14px] h-10", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onChange("");
                  }
                }}
                className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-surface-2 cursor-pointer"
                aria-label="Rensa tema"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök eller skriv nytt tema…"
            className="h-9 text-[14px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length > 0 && (!query.trim() || exactMatch)) {
                  select(filtered[0]);
                } else if (query.trim()) {
                  createNew();
                }
              }
            }}
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 && !query.trim() && (
            <p className="px-3 py-4 text-[13px] text-muted-foreground text-center">
              Inga teman än. Skriv för att skapa.
            </p>
          )}
          {filtered.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => select(t)}
              className="w-full text-left px-3 py-2 text-[14px] hover:bg-surface-2 flex items-center justify-between"
            >
              <span>{t}</span>
              {value === t && <Check className="h-3.5 w-3.5 text-accent-blue" />}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createNew}
              className="w-full text-left px-3 py-2 text-[14px] hover:bg-accent-blue/10 text-accent-blue flex items-center gap-2 border-t border-border mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Skapa nytt tema: <span className="font-medium">"{query.trim()}"</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
