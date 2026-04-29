import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Image as ImageIcon, Table as TableIcon, FileText } from "lucide-react";
import type { SkippedItem } from "@/lib/import/parseDocument";

interface Props {
  items: SkippedItem[];
}

export function SkippedContentPanel({ items }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const counts = {
    image: items.filter((i) => i.kind === "image").length,
    table: items.filter((i) => i.kind === "table").length,
    footnote: items.filter((i) => i.kind === "footnote").length,
  };

  // Gruppera efter sektion
  const bySection = new Map<string, SkippedItem[]>();
  for (const item of items) {
    const arr = bySection.get(item.section) || [];
    arr.push(item);
    bySection.set(item.section, arr);
  }

  const pluralize = (kind: "image" | "table" | "footnote", n: number) =>
    n > 0
      ? t(`import.skipped.${kind}_${n === 1 ? "one" : "other"}`, { count: n })
      : null;
  const summary = [
    pluralize("image", counts.image),
    pluralize("table", counts.table),
    pluralize("footnote", counts.footnote),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-2xl bg-surface-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--cue-amber)/0.15)] text-[hsl(var(--cue-amber))] flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">
            {items.length} element kunde inte importeras
          </p>
          <p className="text-[12px] text-muted-foreground truncate">
            {summary} — lägg till manuellt i redigeringsläget om du behöver dem
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {Array.from(bySection.entries()).map(([section, list]) => (
            <div key={section}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                {section}
              </p>
              <ul className="space-y-1">
                {list.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-foreground/90"
                  >
                    <span className="text-muted-foreground shrink-0 mt-0.5">
                      {item.kind === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : item.kind === "table" ? (
                        <TableIcon className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 break-words">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
