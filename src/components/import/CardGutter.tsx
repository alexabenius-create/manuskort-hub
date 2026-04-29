import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Merge, Plus } from "lucide-react";

interface Props {
  /** Index för det gap som denna gutter representerar (mellan kort i-1 och i, eller före första: i=0). */
  index: number;
  /** Slå ihop kort i-1 med i. */
  onMerge: () => void;
  /** Lägg in ett tomt kort vid denna position. */
  onInsertEmpty: () => void;
  /** Anropas vid drop — index för kortet som släpptes. -1 om ingen aktiv drag. */
  onDropCard: (sourceIndex: number) => void;
  /** Är merge möjligt? (false för första gutter). */
  canMerge: boolean;
}

export function CardGutter({ index, onMerge, onInsertEmpty, onDropCard, canMerge }: Props) {
  const [hover, setHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-card-index")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData("application/x-card-index");
        setDragOver(false);
        if (!raw) return;
        const src = parseInt(raw, 10);
        if (!isNaN(src)) onDropCard(src);
      }}
      className="relative h-6 -my-1 group"
      aria-label={`Gap mellan kort ${index} och ${index + 1}`}
    >
      {/* Tunn linje i vila */}
      <div
        className={`absolute left-12 right-12 top-1/2 -translate-y-1/2 h-px transition-colors ${
          dragOver ? "bg-accent-blue h-[2px]" : hover ? "bg-border" : "bg-transparent"
        }`}
      />
      {/* Knappar i mitten — visas vid hover */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity ${
          hover && !dragOver ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {canMerge && (
          <button
            type="button"
            onClick={onMerge}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 shadow-card border border-border"
            title="Slå ihop med föregående kort"
          >
            <Merge className="h-3 w-3" />
            Slå ihop
          </button>
        )}
        <button
          type="button"
          onClick={onInsertEmpty}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 shadow-card border border-border"
          title="Lägg in ett tomt kort här"
        >
          <Plus className="h-3 w-3" />
          Nytt kort
        </button>
      </div>
      {/* Drop-indikator-text */}
      {dragOver && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-wider text-accent-blue bg-surface px-2 py-0.5 rounded-full border border-accent-blue/40">
          Släpp för att flytta hit
        </div>
      )}
    </div>
  );
}
