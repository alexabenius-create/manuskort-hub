import { useEffect, useRef, useState } from "react";
import { splitDocToCards } from "@/lib/docSplit";
import type { TextSize } from "@/lib/cardLimits";

/**
 * PageBreakOverlay — ritar virtuella sidbrytningar ovanpå editorn.
 *
 * Strategi:
 *  - Lyssnar på dokument-HTML.
 *  - Beräknar splittar via splitDocToCards (samma som presentationen mäter mot).
 *  - För varje brytpunkt: skapa ett "ankare" — ett <span data-doc-pos> som
 *    markerar var brytningen ska visas. (Vi använder en enklare strategi:
 *    rita brytlinjer baserat på textens vertikala position via DOM-mätning.)
 *
 * Implementation: vi mäter editorns inre DOM. För varje computed-fragment-
 * längd letar vi rätt på motsvarande textlängd i editor-DOM och hämtar
 * dess bottenkant. Linjer ritas absolut-positionerat i overlay-divet.
 */

interface Props {
  html: string;
  size: TextSize;
  /** Ref till editorns rotelement (.ProseMirror) — överlagras */
  editorRootRef: React.RefObject<HTMLElement | null>;
  /** Callback med antal beräknade kort, för UI-räknare */
  onCardCountChange?: (count: number) => void;
}

interface BreakLine {
  topPx: number;
  cardNumber: number; // 1-indexerat — siffran som visas är "Slut på kort N"
  totalCards: number;
}

export function PageBreakOverlay({
  html,
  size,
  editorRootRef,
  onCardCountChange,
}: Props) {
  const [lines, setLines] = useState<BreakLine[]>([]);
  const [overlayHeight, setOverlayHeight] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      compute();
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, size]);

  // Räkna om vid resize av editorn
  useEffect(() => {
    const root = editorRootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);
    });
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRootRef.current]);

  function compute() {
    const root = editorRootRef.current;
    if (!root) return;

    setOverlayHeight(root.offsetHeight);

    const fragments = splitDocToCards(html, size);
    onCardCountChange?.(fragments.length);

    if (fragments.length <= 1) {
      setLines([]);
      return;
    }

    // För varje fragment (utom det sista): hitta motsvarande karaktärsindex
    // i editor-DOM och mät dess botten-Y.
    // Vi räknar ren textlängd (textContent) per fragment och mappar sedan
    // till editor-DOM med samma räkning.
    const cumulativeTextLens: number[] = [];
    let acc = 0;
    for (let i = 0; i < fragments.length - 1; i++) {
      const tmp = document.createElement("div");
      tmp.innerHTML = fragments[i];
      acc += (tmp.textContent ?? "").length;
      cumulativeTextLens.push(acc);
    }

    const editorRect = root.getBoundingClientRect();
    const breakLines: BreakLine[] = [];

    for (let i = 0; i < cumulativeTextLens.length; i++) {
      const targetLen = cumulativeTextLens[i];
      const yPx = findYAtTextOffset(root, targetLen);
      if (yPx === null) continue;
      breakLines.push({
        topPx: yPx - editorRect.top,
        cardNumber: i + 1,
        totalCards: fragments.length,
      });
    }

    setLines(breakLines);
  }

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ height: overlayHeight || "100%" }}
      aria-hidden="true"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: `${line.topPx}px`, transform: "translateY(-1px)" }}
        >
          <div className="flex-1 border-t-2 border-dashed border-accent-blue/40" />
          <div className="px-3 py-1 mx-3 text-[10px] font-mono uppercase tracking-widest text-accent-blue bg-background/80 backdrop-blur-sm rounded-full border border-accent-blue/30">
            Kort {line.cardNumber} / {line.totalCards}
          </div>
          <div className="flex-1 border-t-2 border-dashed border-accent-blue/40" />
        </div>
      ))}
    </div>
  );
}

/**
 * Hitta Y-koordinaten (relativt viewport) för en given textindex i ett
 * editor-rotelement. Använder TreeWalker + Range.
 */
function findYAtTextOffset(root: HTMLElement, targetOffset: number): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let acc = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? "";
    if (acc + text.length >= targetOffset) {
      const offsetInNode = Math.max(0, targetOffset - acc);
      const range = document.createRange();
      try {
        range.setStart(node, Math.min(offsetInNode, text.length));
        range.setEnd(node, Math.min(offsetInNode, text.length));
      } catch {
        return null;
      }
      const rects = range.getClientRects();
      const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
      // Vi vill ha botten av aktuell rad
      return rect.bottom;
    }
    acc += text.length;
  }
  return null;
}
