import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Flag, ArrowRight } from "lucide-react";
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

export function PresentationCard({ card, panelists, textSize, sizeOffset, showNotes, onToggleNotes }: Props) {
  const baseSize = BASE_SIZE[textSize];
  const fontSize = baseSize + sizeOffset * 2;
  const html = useMemo(() => transformHtmlForPresentation(card.content_html ?? "", panelists), [card.content_html, panelists]);

  const hasNotes = !!card.notes && card.notes.trim().length > 0;
  const hasCueRed = !!card.cue_red?.trim();
  const hasCueAmber = !!card.cue_amber?.trim();
  const hasCueTeal = !!card.cue_teal?.trim();
  const hasAnyCue = hasCueRed || hasCueAmber || hasCueTeal;

  // Aktiv cue-toast
  const [activeCue, setActiveCue] = useState<null | { color: "red" | "amber" | "teal"; text: string }>(null);
  const cueTimerRef = useRef<number | null>(null);

  const showCue = (color: "red" | "amber" | "teal", text: string) => {
    setActiveCue({ color, text });
    if (cueTimerRef.current) window.clearTimeout(cueTimerRef.current);
    cueTimerRef.current = window.setTimeout(() => setActiveCue(null), 4000);
  };

  useEffect(() => {
    // Reset cue när kortet byts
    setActiveCue(null);
    if (cueTimerRef.current) {
      window.clearTimeout(cueTimerRef.current);
      cueTimerRef.current = null;
    }
  }, [card.id]);

  return (
    <div className="relative flex w-full h-full min-h-0 gap-4 px-6 md:px-12 py-4">
      {/* Cue-prickar uppe till vänster */}
      {hasAnyCue && (
        <div className="absolute top-2 left-6 md:left-12 flex gap-1.5 z-20 pointer-events-auto">
          {hasCueRed && (
            <button
              onClick={() => showCue("red", card.cue_red!)}
              className="h-3 w-3 rounded-full bg-[hsl(var(--cue-red))] hover:scale-125 transition-transform shadow-lg shadow-[hsl(var(--cue-red))]/40"
              aria-label={`Visa signal: ${card.cue_red}`}
              title={card.cue_red}
            />
          )}
          {hasCueAmber && (
            <button
              onClick={() => showCue("amber", card.cue_amber!)}
              className="h-3 w-3 rounded-full bg-[hsl(var(--cue-amber))] hover:scale-125 transition-transform shadow-lg shadow-[hsl(var(--cue-amber))]/40"
              aria-label={`Visa signal: ${card.cue_amber}`}
              title={card.cue_amber}
            />
          )}
          {hasCueTeal && (
            <button
              onClick={() => showCue("teal", card.cue_teal!)}
              className="h-3 w-3 rounded-full bg-[hsl(var(--cue-teal))] hover:scale-125 transition-transform shadow-lg shadow-[hsl(var(--cue-teal))]/40"
              aria-label={`Visa signal: ${card.cue_teal}`}
              title={card.cue_teal}
            />
          )}
        </div>
      )}

      {/* Cue-toast */}
      {activeCue && (
        <div
          className={`absolute top-8 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-full backdrop-blur-md text-[15px] font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
            activeCue.color === "red"
              ? "bg-[hsl(var(--cue-red))]/15 text-[hsl(var(--cue-red))] border border-[hsl(var(--cue-red))]/40"
              : activeCue.color === "amber"
                ? "bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))] border border-[hsl(var(--cue-amber))]/40"
                : "bg-[hsl(var(--cue-teal))]/15 text-[hsl(var(--cue-teal))] border border-[hsl(var(--cue-teal))]/40"
          }`}
        >
          {activeCue.color === "red" && <Pause className="inline h-4 w-4 mr-2 mb-0.5" />}
          {activeCue.color === "amber" && <Flag className="inline h-4 w-4 mr-2 mb-0.5" />}
          {activeCue.color === "teal" && <ArrowRight className="inline h-4 w-4 mr-2 mb-0.5" />}
          {activeCue.text}
        </div>
      )}

      {/* Manustexten — huvudyta */}
      <div className="flex-1 min-w-0 flex items-center justify-center overflow-y-auto">
        <article
          className="presentation-prose max-w-[60ch] mx-auto font-display text-zinc-100"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Anteckningar — sidokolumn */}
      {showNotes && hasNotes && (
        <button
          onClick={onToggleNotes}
          className="hidden md:flex w-[260px] flex-shrink-0 flex-col items-start text-left bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5 overflow-y-auto transition-colors"
          aria-label="Dölj anteckningar"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-3">
            Anteckningar
          </span>
          <p className="font-mono text-[14px] leading-[1.6] text-zinc-300 whitespace-pre-wrap">
            {card.notes}
          </p>
        </button>
      )}

      {/* Knapp för att visa anteckningar igen om de är dolda men finns */}
      {!showNotes && hasNotes && (
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
