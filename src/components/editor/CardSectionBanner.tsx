/**
 * CardSectionBanner — visas ovanför första kortet i en sektion.
 * Klickbar rubrik + chevron som växlar kollaps via sectionCollapseStore.
 */
import { ChevronRight, ChevronDown } from "lucide-react";
import { toggleSection } from "@/lib/sectionCollapseStore";

interface Props {
  manuscriptId: string;
  sectionId: string;
  label: string;
  cardCount: number;
  collapsed: boolean;
}

export function CardSectionBanner({
  manuscriptId,
  sectionId,
  label,
  cardCount,
  collapsed,
}: Props) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <div contentEditable={false} className="mb-2 -mt-1">
      <button
        type="button"
        onClick={() => toggleSection(manuscriptId, sectionId)}
        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Visa" : "Dölj"} sektion ${label}`}
      >
        <Chevron className="h-3.5 w-3.5 transition-transform" />
        <span className="tracking-wide">{label}</span>
        <span className="opacity-50 tabular-nums">
          ({cardCount} {cardCount === 1 ? "kort" : "kort"})
        </span>
      </button>
    </div>
  );
}
