import { useEffect, useMemo, useState } from "react";
import { Pause, Flag, ArrowRight, ZoomIn, ZoomOut } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import {
  darkAttributionBg,
  darkAttributionBorder,
  darkAttributionLabel,
} from "@/lib/presentationTheme";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

interface Props {
  card: Card;
  panelists: Panelist[];
  textSize: "sm" | "md" | "lg";
  /** Justerbart tilläggsspann: -2 = mindre, +2 = större. */
  sizeOffset: number;
  showNotes: boolean;
  onToggleNotes: () => void;
  /** Callback när användaren redigerar anteckningar. */
  onNotesChange?: (notes: string) => void;
}

const BASE_SIZE = { sm: 24, md: 30, lg: 38 } as const;

/**
 * Transformerar Tiptap-HTML så att panelist-spans får:
 * - mörk attribution-bakgrund anpassad för mörkt tema
 * - en namn-label ovanför första instansen
 * - pausmarkering "/" renderas som tydlig vertikal linje
 */
function transformHtmlForPresentation(html: string, panelists: Panelist[]): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  if (!root) return html;

  // Hitta alla panelist-spans
  const spans = root.querySelectorAll<HTMLElement>("span[data-panelist-id]");
  const seenInThisPass = new Set<string>();

  spans.forEach((span) => {
    const id = span.getAttribute("data-panelist-id");
    const colorAttr = span.getAttribute("data-panelist-color");
    if (!id || !colorAttr) return;

    const panelist = panelists.find((p) => p.id === id);
    const displayColor = panelist?.color ?? colorAttr;
    const displayName = panelist?.name || span.getAttribute("data-panelist-name") || "Namnlös";

    const bg = darkAttributionBg(displayColor, 0.45);
    const border = darkAttributionBorder(displayColor);
    const labelColor = darkAttributionLabel(displayColor);

    span.setAttribute(
      "style",
      `background-color: ${bg}; border: 1px solid ${border}; border-radius: 12px; padding: 4px 12px; box-decoration-break: clone; -webkit-box-decoration-break: clone; color: inherit;`
    );

    // Lägg label ovanför första instansen i denna pass
    if (!seenInThisPass.has(id)) {
      seenInThisPass.add(id);
      const label = doc.createElement("span");
      label.setAttribute(
        "style",
        `display: inline-block; font-family: var(--font-mono); font-size: 0.45em; line-height: 1; letter-spacing: 0.05em; text-transform: uppercase; color: ${labelColor}; margin-right: 8px; vertical-align: 0.55em; opacity: 0.85;`
      );
      label.textContent = displayName;
      span.insertBefore(label, span.firstChild);
    }
  });

  return root.innerHTML;
}

const NOTES_BASE = 18;
const NOTES_MIN_OFFSET = -2;
const NOTES_MAX_OFFSET = 4;
const NOTES_KEY = "presentation-notes-size-offset";

export function PresentationCard({ card, panelists, textSize, sizeOffset, showNotes, onToggleNotes, onNotesChange }: Props) {
  const baseSize = BASE_SIZE[textSize];
  const fontSize = baseSize + sizeOffset * 2;
  const html = useMemo(() => transformHtmlForPresentation(card.content_html ?? "", panelists), [card.content_html, panelists]);

  const [notesOffset, setNotesOffset] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (raw) setNotesOffset(parseInt(raw, 10) || 0);
    } catch { /* ignore */ }
  }, []);
  const changeNotesOffset = (next: number) => {
    const clamped = Math.max(NOTES_MIN_OFFSET, Math.min(NOTES_MAX_OFFSET, next));
    setNotesOffset(clamped);
    try { localStorage.setItem(NOTES_KEY, String(clamped)); } catch { /* ignore */ }
  };
  const notesFontSize = NOTES_BASE + notesOffset * 2;

  const hasNotes = !!card.notes && card.notes.trim().length > 0;
  const hasCueRed = !!card.cue_red?.trim();
  const hasCueAmber = !!card.cue_amber?.trim();
  const hasCueTeal = !!card.cue_teal?.trim();
  const hasAnyCue = hasCueRed || hasCueAmber || hasCueTeal;

  return (
    <div className="relative flex w-full h-full min-h-0 gap-4 px-6 md:px-12 py-4">
      {/* Persistenta signaler — absolut positionerade i överkant av kortet */}
      {hasAnyCue && (
        <div className="absolute top-4 left-6 right-6 md:left-12 md:right-12 flex items-start gap-4 pointer-events-none z-10">
          <div className="flex-1 min-w-0 text-left">
            {hasCueRed && (
              <div className="inline-flex items-start gap-2 text-[14px] text-[hsl(var(--cue-red))]">
                <Pause className="h-3.5 w-3.5 mt-1 flex-shrink-0" />
                <span className="font-medium">{card.cue_red}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-center">
            {hasCueAmber && (
              <div className="inline-flex items-start gap-2 text-[14px] text-[hsl(var(--cue-amber))]">
                <Flag className="h-3.5 w-3.5 mt-1 flex-shrink-0" />
                <span className="font-medium">{card.cue_amber}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-right">
            {hasCueTeal && (
              <div className="inline-flex items-start gap-2 text-[14px] text-[hsl(var(--cue-teal))]">
                <ArrowRight className="h-3.5 w-3.5 mt-1 flex-shrink-0" />
                <span className="font-medium">{card.cue_teal}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manustexten — huvudyta */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center overflow-y-auto">
        <article
          className="presentation-prose max-w-[60ch] mx-auto font-display text-zinc-100"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Anteckningar — sidokolumn (visas alltid när showNotes på desktop, så man kan börja skriva) */}
      {showNotes && (
        <div className="hidden md:flex w-[380px] flex-shrink-0 flex-col bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 relative">
          {/* Header med label + zoom + dölj */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Anteckningar
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeNotesOffset(notesOffset - 1)}
                disabled={notesOffset <= NOTES_MIN_OFFSET}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors disabled:opacity-30"
                aria-label="Mindre anteckningstext"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeNotesOffset(notesOffset + 1)}
                disabled={notesOffset >= NOTES_MAX_OFFSET}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors disabled:opacity-30"
                aria-label="Större anteckningstext"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={onToggleNotes}
                className="ml-1 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                aria-label="Dölj anteckningar"
              >
                Dölj
              </button>
            </div>
          </div>
          {/* Redigerbar, centrerad anteckningstext */}
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            <textarea
              value={card.notes ?? ""}
              onChange={(e) => onNotesChange?.(e.target.value)}
              onKeyDown={(e) => {
                // Esc: låt bubbla upp till Presentation.tsx → avslutar presentationen
                if (e.key === "Escape") return;
                // Enter utan Shift: lämna fältet (ingen radbrytning)
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLTextAreaElement).blur();
                  return;
                }
                // Shift+Enter och övriga tangenter: stoppa propagation så globala genvägar inte triggas
                e.stopPropagation();
              }}
              placeholder="Skriv anteckningar…"
              spellCheck={false}
              className="font-mono text-zinc-200 placeholder:text-zinc-600 whitespace-pre-wrap text-center w-full h-full bg-transparent border-0 outline-none resize-none focus:ring-0 focus:outline-none caret-zinc-300 selection:bg-zinc-700/60"
              style={{ fontSize: `${notesFontSize}px`, lineHeight: 1.6 }}
              readOnly={!onNotesChange}
            />
          </div>
        </div>
      )}

      {/* Knapp för att visa anteckningar igen om de är dolda */}
      {!showNotes && (hasNotes || onNotesChange) && (
        <button
          onClick={onToggleNotes}
          className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2 px-2 py-3 rounded-l-full bg-zinc-900/40 hover:bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-mono uppercase tracking-wider [writing-mode:vertical-rl]"
          aria-label="Visa anteckningar"
        >
          Anteckningar
        </button>
      )}
    </div>
  );
}
