import { useMemo } from "react";
import { estimateLines } from "./htmlToPdfNodes";
import type { Cue } from "@/lib/cues";

export interface PrintCardInput {
  id: string;
  content_html: string;
  notes: string;
  cues: Cue[];
  hasNotes: boolean;
}

export interface CardSplit {
  /** Kortets ursprungs-id */
  cardId: string;
  /** "a", "b", … för flera sidor; null för hela kort */
  suffix: string | null;
  /** HTML för denna del */
  html: string;
}

export interface PrintLayoutResult {
  /** Gemensam fontSize i pt för alla kort */
  fontSize: number;
  /** Splits: ett kort kan bli flera (sida 3a, 3b) */
  splits: Map<string, CardSplit[]>;
}

/**
 * Beräknar gemensam textstorlek (14–18 pt) som passar alla kort.
 *
 * Algoritm:
 *   1. Räkna ut tillgängliga rader vid varje fontSize från 18 ned till 14.
 *   2. Vid varje storlek: kolla om alla kort ryms.
 *   3. Välj högsta storlek där alla utom ev. de allra längsta ryms.
 *   4. Vid 14pt: dela kort som fortfarande inte ryms på styckegräns.
 */
export function usePrintLayout(
  cards: PrintCardInput[],
  layout: "a5" | "a4-2up",
): PrintLayoutResult {
  return useMemo(() => {
    // Kort-yta i punkter (1mm = 2.8346 pt). Båda layouter använder kort 210×148mm.
    // Reservera ~32mm för header (12mm) + cue-chippar (10mm) + sidfot (10mm).
    // Anteckningar ligger bredvid (höger 35%), så scriptkolumn är ~57% av bredden.
    const CARD_WIDTH_MM = 210;
    const CARD_HEIGHT_MM = 148;
    const PADDING_MM = 12;
    const HEADER_FOOTER_MM = 32;
    const MM_TO_PT = 2.8346;

    const innerWidthMm = CARD_WIDTH_MM - PADDING_MM * 2;
    const innerHeightMm = CARD_HEIGHT_MM - PADDING_MM * 2 - HEADER_FOOTER_MM;
    const innerHeightPt = innerHeightMm * MM_TO_PT;

    const computeAvailableLines = (fontSize: number) =>
      Math.floor(innerHeightPt / (fontSize * 1.45));

    const computeColumnWidth = (_hasNotes: boolean) => {
      const widthPt = innerWidthMm * MM_TO_PT;
      // Notes-ytan visas alltid vid utskrift (för handskrift) → scriptkolumn = 75%.
      return widthPt * 0.71;
    };

    const fitsAll = (fontSize: number): boolean => {
      const available = computeAvailableLines(fontSize);
      for (const c of cards) {
        const colWidth = computeColumnWidth(c.hasNotes);
        // cue-chippar tar ~1.5 rader vardera
        const cueLines = c.cues.length * 1.5;
        const lines = estimateLines(c.content_html, colWidth, fontSize) + cueLines;
        if (lines > available) return false;
      }
      return true;
    };

    let chosenFontSize = 14;
    for (let fs = 18; fs >= 14; fs -= 1) {
      if (fitsAll(fs)) {
        chosenFontSize = fs;
        break;
      }
    }

    // Bygg splits — vid 14pt: dela för långa kort på styckegräns.
    const splits = new Map<string, CardSplit[]>();
    const availableAt14 = computeAvailableLines(14);

    for (const c of cards) {
      const colWidth = computeColumnWidth(c.hasNotes);
      const cueLines = c.cues.length * 1.5;
      const totalLines = estimateLines(c.content_html, colWidth, chosenFontSize) + cueLines;
      const maxLines = computeAvailableLines(chosenFontSize);

      if (totalLines <= maxLines || chosenFontSize > 14) {
        splits.set(c.id, [{ cardId: c.id, suffix: null, html: c.content_html }]);
        continue;
      }

      // Vi är på 14pt och kortet flödar — dela på <p>-gränser.
      const parts = splitHtmlByParagraphs(c.content_html, colWidth, 14, availableAt14 - cueLines);
      if (parts.length <= 1) {
        splits.set(c.id, [{ cardId: c.id, suffix: null, html: c.content_html }]);
      } else {
        splits.set(
          c.id,
          parts.map((html, i) => ({
            cardId: c.id,
            suffix: String.fromCharCode(97 + i), // a, b, c…
            html,
          })),
        );
      }
    }

    return { fontSize: chosenFontSize, splits };
  }, [cards, layout]);
}

/**
 * Delar HTML på <p>-gränser så att varje del rymmer ≤ maxLines rader.
 * Bevarar wrappande element. Inga stycken delas mitt itu.
 */
function splitHtmlByParagraphs(
  html: string,
  columnWidthPt: number,
  fontSize: number,
  maxLines: number,
): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return [html];

  const blocks = Array.from(root.children) as HTMLElement[];
  if (blocks.length === 0) return [html];

  const parts: string[] = [];
  let current: HTMLElement[] = [];
  let currentLines = 0;

  for (const block of blocks) {
    const blockHtml = block.outerHTML;
    const blockLines = estimateLines(blockHtml, columnWidthPt, fontSize);
    if (currentLines + blockLines > maxLines && current.length > 0) {
      parts.push(current.map((b) => b.outerHTML).join(""));
      current = [block];
      currentLines = blockLines;
    } else {
      current.push(block);
      currentLines += blockLines;
    }
  }
  if (current.length > 0) parts.push(current.map((b) => b.outerHTML).join(""));
  return parts.length > 0 ? parts : [html];
}
