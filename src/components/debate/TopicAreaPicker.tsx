import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { TOPIC_AREA_SUGGESTIONS } from "@/lib/debateTopics";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (next: string, opts?: { flushNow?: boolean }) => void;
}

export function TopicAreaPicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value);

  // Synka externt värde till lokalt utkast om det ändras utifrån
  useMemo(() => setDraft(value), [value]);

  const isActive = (chip: string) => chip.toLowerCase() === value.trim().toLowerCase();

  const handleChip = (chip: string) => {
    const next = isActive(chip) ? "" : chip;
    setDraft(next);
    onChange(next, { flushNow: true });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-semibold text-v2-ink">
          Sakområde <span className="text-v2-muted font-normal">(valfritt)</span>
        </label>
        <span className="text-[11px] text-v2-muted">Hjälper AI:n att fokusera</span>
      </div>
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="t.ex. Skola, Infrastruktur, Vård och omsorg"
        className="rounded-xl"
        maxLength={80}
      />
      <div className="flex flex-wrap gap-1.5">
        {TOPIC_AREA_SUGGESTIONS.map((chip) => {
          const active = isActive(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleChip(chip)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] border transition-all",
                active
                  ? "border-v2-violet bg-v2-violet/10 text-v2-violet font-semibold"
                  : "border-v2-line bg-white text-v2-muted hover:border-v2-violet/40 hover:text-v2-ink",
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}
