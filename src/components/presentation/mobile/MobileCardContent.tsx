import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Zap, Play, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import {
  darkAttributionBg,
  darkAttributionBorder,
  darkAttributionLabel,
} from "@/lib/presentationTheme";
import { readCuesWithLegacyFallback } from "@/lib/cues";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

interface Props {
  card: Card;
  panelists: Panelist[];
  textSize: "sm" | "md" | "lg";
  sizeOffset: number;
}

const BASE_SIZE = { sm: 24, md: 30, lg: 38 } as const;

function transformHtmlForPresentation(html: string, panelists: Panelist[]): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  if (!root) return html;

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

/**
 * Mobil-v2 manustext: kant-till-kant svart yta, auto-fit font, ingen rounded.
 * Endast cue-pillar absolut positionerade i toppen om de finns.
 */
export function MobileCardContent({ card, panelists, textSize, sizeOffset }: Props) {
  const baseSize = BASE_SIZE[textSize];
  const desiredFontSize = baseSize + sizeOffset * 2;
  const html = useMemo(
    () => transformHtmlForPresentation(card.content_html ?? "", panelists),
    [card.content_html, panelists]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const MIN_FONT = Math.max(12, baseSize - 10);
  const [fittedFontSize, setFittedFontSize] = useState(desiredFontSize);
  const [overflowAtMin, setOverflowAtMin] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const article = articleRef.current;
    if (!container || !article) return;

    let raf = 0;
    const measure = () => {
      let size = desiredFontSize;
      article.style.fontSize = `${size}px`;
      article.style.lineHeight = "1.55";
      let guard = 0;
      while (article.scrollHeight > container.clientHeight && size > MIN_FONT && guard < 60) {
        size -= 1;
        article.style.fontSize = `${size}px`;
        if (size <= desiredFontSize - 4) {
          article.style.lineHeight = "1.4";
        }
        guard += 1;
      }
      const stillOverflow = article.scrollHeight > container.clientHeight + 1;
      setFittedFontSize(size);
      setOverflowAtMin(stillOverflow);
    };

    raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(container);
    ro.observe(article);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [html, desiredFontSize, MIN_FONT, card.id]);

  const lineHeight = fittedFontSize <= desiredFontSize - 4 ? 1.4 : 1.55;

  const cues = useMemo(() => readCuesWithLegacyFallback(card), [card]);
  const energyCues = cues.filter((c) => c.kind === "energy");
  const actionCues = cues.filter((c) => c.kind === "action");
  const panelCues = cues.filter((c) => c.kind === "panel");
  const hasAnyCue = energyCues.length > 0 || actionCues.length > 0 || panelCues.length > 0;

  return (
    <div className="row-start-2 relative w-full h-full min-h-0 bg-black overflow-hidden">
      {hasAnyCue && (
        <div className="absolute top-1 left-2 right-2 flex justify-center items-center gap-1.5 flex-wrap pointer-events-none z-10">
          {energyCues.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--cue-yellow))] bg-[hsl(var(--cue-yellow)/0.15)] border border-[hsl(var(--cue-yellow)/0.4)]"
            >
              <Zap className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{c.text}</span>
            </div>
          ))}
          {actionCues.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--accent-blue))] bg-[hsl(var(--accent-blue)/0.15)] border border-[hsl(var(--accent-blue)/0.3)]"
            >
              <Play className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{c.text}</span>
            </div>
          ))}
          {panelCues.map((c) => {
            const p = panelists.find((x) => x.id === c.panelistId);
            return (
              <div
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--cue-red))] bg-[hsl(var(--cue-red)/0.15)] border border-[hsl(var(--cue-red)/0.3)]"
              >
                <Users className="h-2.5 w-2.5 flex-shrink-0" />
                {p?.name && (
                  <span className="font-mono text-[8px] uppercase tracking-wider opacity-80">{p.name}</span>
                )}
                <span className="text-zinc-100">{c.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center overflow-hidden px-3"
        style={{
          paddingTop: hasAnyCue ? 36 : 0,
          ...(overflowAtMin
            ? {
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)",
              }
            : {}),
        }}
      >
        <article
          ref={articleRef}
          className="presentation-prose max-w-[95ch] mx-auto font-display text-zinc-100"
          style={{ fontSize: `${fittedFontSize}px`, lineHeight }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
