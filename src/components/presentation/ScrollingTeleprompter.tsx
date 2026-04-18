import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Panelist } from "@/hooks/usePanelists";
import type { FocusStyle } from "./PresentationStartMenu";
import { splitSentences } from "@/lib/sentenceSplit";
import {
  darkAttributionBg,
  darkAttributionBorder,
  darkAttributionLabel,
} from "@/lib/presentationTheme";

type Card = Database["public"]["Tables"]["cards"]["Row"];

const BASE_SIZE = { sm: 24, md: 30, lg: 38 } as const;
const SPEED_MIN = 0.25;
const SPEED_MAX = 3.0;
const FOCUS_LINE_RATIO = 0.35; // läs-linjen vid 35% från toppen
const DRIFT_THRESHOLD_PX = 24; // hur stor avvikelse innan korrigering
const DRIFT_LERP_DURATION_MS = 1000; // mjuk korrigering över 1s
const DRIFT_CHECK_INTERVAL_MS = 5000; // kolla var 5:e sekund

interface Props {
  cards: Card[];
  panelists: Panelist[];
  textSize: "sm" | "md" | "lg";
  sizeOffset: number;
  focusStyle: FocusStyle;
  /** Sekunder förflutna från usePresentationTimer. */
  elapsedSeconds: number;
  /** Måltid i sekunder. */
  targetSeconds: number;
  isPaused: boolean;
  countdownActive: boolean;
  /** 0.25–3.0. Styrs av Presentation via tangenter. */
  speedFactor: number;
  /** Klickbara hastighetskontroller — bör spegla samma logik som +/-/R-tangenter. */
  onSpeedUp: () => void;
  onSpeedDown: () => void;
  onSpeedReset: () => void;
}

/** Strippar HTML till ren text för meningssplit. */
function htmlToPlainText(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

/** Renderar HTML med panelist-markeringar för mörkt tema. Återanvänds från PresentationCard-logiken. */
function transformHtmlForPresentation(html: string, panelists: Panelist[]): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  if (!root) return html;
  const spans = root.querySelectorAll<HTMLElement>("span[data-panelist-id]");
  const seen = new Set<string>();
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
    if (!seen.has(id)) {
      seen.add(id);
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

/** Beräknar idealisk pixels/sek baserat på total höjd och måltid. */
export function computeRequiredSpeedFactor(totalHeightPx: number, viewportHeightPx: number, targetSeconds: number): number {
  if (targetSeconds <= 0 || totalHeightPx <= viewportHeightPx) return 1.0;
  // "Normal läsfart" referens: ~120 px/sek i basalt typsnitt @ 30px / 1.7 line-height ≈ 51px/rad,
  // ~2.3 rader/sek vid 200 WPM med snittlängd 5.5 ord/rad → 2.3 * 51 ≈ 117 px/s. Vi använder 120.
  const NORMAL_SPEED = 120;
  const required = (totalHeightPx - viewportHeightPx) / targetSeconds;
  return required / NORMAL_SPEED;
}

export function ScrollingTeleprompter({
  cards,
  panelists,
  textSize,
  sizeOffset,
  focusStyle,
  elapsedSeconds,
  targetSeconds,
  isPaused,
  countdownActive,
  speedFactor,
  onSpeedUp,
  onSpeedDown,
  onSpeedReset,
}: Props) {
  const baseSize = BASE_SIZE[textSize];
  const fontSize = baseSize + sizeOffset * 2;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0); // current translateY (positive = scrolled up)
  const lastTickRef = useRef<number | null>(null);
  const driftCorrectionRef = useRef<{ start: number; from: number; to: number } | null>(null);
  const lastDriftCheckRef = useRef<number>(0);

  const [, forceTick] = useState(0); // för att tvinga re-render av sentence-highlight
  const [totalHeight, setTotalHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Förbered kortinnehåll
  const renderedCards = useMemo(() => {
    return cards.map((c) => {
      const html = transformHtmlForPresentation(c.content_html ?? "", panelists);
      const plain = htmlToPlainText(c.content_html ?? "");
      const sentences = focusStyle === "sentence" ? splitSentences(plain) : [];
      return { card: c, html, sentences };
    });
  }, [cards, panelists, focusStyle]);

  // Mät höjder
  useEffect(() => {
    const measure = () => {
      if (contentRef.current) setTotalHeight(contentRef.current.scrollHeight);
      if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (contentRef.current) ro.observe(contentRef.current);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [renderedCards, fontSize]);

  // Beräkna pixels per sekund (clampad)
  const pixelsPerSecond = useMemo(() => {
    if (targetSeconds <= 0 || totalHeight <= viewportHeight) return 0;
    const ideal = (totalHeight - viewportHeight) / targetSeconds;
    const clampedFactor = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speedFactor));
    return ideal * clampedFactor;
  }, [totalHeight, viewportHeight, targetSeconds, speedFactor]);

  // RAF-loop för smooth scroll
  useEffect(() => {
    if (countdownActive) return;
    let raf = 0;
    const tick = (ts: number) => {
      const last = lastTickRef.current;
      lastTickRef.current = ts;
      const dt = last === null ? 0 : (ts - last) / 1000;

      if (!isPaused && pixelsPerSecond > 0) {
        offsetRef.current += pixelsPerSecond * dt;
      }

      // Mjuk drift-korrigering
      const correction = driftCorrectionRef.current;
      if (correction) {
        const elapsedCorr = ts - correction.start;
        if (elapsedCorr >= DRIFT_LERP_DURATION_MS) {
          offsetRef.current = correction.to;
          driftCorrectionRef.current = null;
        } else {
          const t = elapsedCorr / DRIFT_LERP_DURATION_MS;
          // Lägg till delta så att animationen "interpoleras ovanpå" pågående scroll
          const delta = (correction.to - correction.from) * t;
          offsetRef.current = correction.from + delta + (pixelsPerSecond * (elapsedCorr / 1000));
        }
      }

      // Periodisk drift-koll
      if (!isPaused && ts - lastDriftCheckRef.current > DRIFT_CHECK_INTERVAL_MS) {
        lastDriftCheckRef.current = ts;
        const expected = elapsedSeconds * pixelsPerSecond;
        if (Math.abs(offsetRef.current - expected) > DRIFT_THRESHOLD_PX) {
          driftCorrectionRef.current = {
            start: ts,
            from: offsetRef.current,
            to: expected,
          };
        }
      }

      // Clamp i intervall
      const maxOffset = Math.max(0, totalHeight - viewportHeight);
      if (offsetRef.current < 0) offsetRef.current = 0;
      if (offsetRef.current > maxOffset) offsetRef.current = maxOffset;

      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${-offsetRef.current}px)`;
      }

      // Trigga re-render för sentence-highlight ungefär 4 ggr/sek
      if (focusStyle === "sentence" && Math.floor(ts / 250) % 1 === 0) {
        forceTick((n) => (n + 1) % 1000000);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTickRef.current = null;
    };
  }, [isPaused, countdownActive, pixelsPerSecond, elapsedSeconds, totalHeight, viewportHeight, focusStyle]);

  // Sentence-highlight: hitta vilken mening som korsar läs-linjen
  const focusLineY = viewportHeight * FOCUS_LINE_RATIO;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">
      {/* Vignettering top/bottom för fokus */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 82%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Hastighetskontroller — ikonknappar längst ner */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-900/80 backdrop-blur border border-zinc-800/60 shadow-lg shadow-black/40">
        <button
          onClick={onSpeedDown}
          className="p-3 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors active:scale-95"
          aria-label="Sänk hastighet (−)"
          title="Sänk hastighet (−)"
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="px-3 min-w-[64px] text-center font-mono text-[15px] tabular-nums text-zinc-100">
          {speedFactor.toFixed(2)}×
        </div>
        <button
          onClick={onSpeedUp}
          className="p-3 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors active:scale-95"
          aria-label="Höj hastighet (+)"
          title="Höj hastighet (+)"
        >
          <Plus className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-zinc-800 mx-1" />
        <button
          onClick={onSpeedReset}
          className="p-3 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors active:scale-95"
          aria-label="Återställ hastighet (R)"
          title="Återställ hastighet (R)"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>


      {/* Fast läs-linje */}
      {focusStyle === "line" && viewportHeight > 0 && (
        <div
          className="teleprompter-line pointer-events-none absolute left-0 right-0 z-20"
          style={{ top: `${focusLineY}px` }}
        />
      )}

      {/* Innehåll */}
      <div
        ref={contentRef}
        className="absolute left-0 right-0 top-0 will-change-transform"
        style={{ transform: `translateY(0px)` }}
      >
        {/* Top spacer så första texten startar vid läs-linjen */}
        <div style={{ height: `${focusLineY}px` }} />

        {renderedCards.map(({ card, html, sentences }, idx) => (
          <section key={card.id} className="px-6 md:px-16 py-8" data-card-idx={idx}>
            <header className="mb-4 font-mono text-[12px] uppercase tracking-wider text-zinc-600 flex items-center gap-3">
              <span>Kort {idx + 1}</span>
              {card.title && <span className="text-zinc-500">· {card.title}</span>}
              {(card.start_time || card.end_time) && (
                <span className="ml-auto tabular-nums">
                  {card.start_time}{card.end_time ? `–${card.end_time}` : ""}
                </span>
              )}
            </header>

            {focusStyle === "sentence" && sentences.length > 0 ? (
              <SentenceRenderer
                sentences={sentences}
                fontSize={fontSize}
                focusLineY={focusLineY}
                offsetRef={offsetRef}
              />
            ) : (
              <article
                className="presentation-prose max-w-[60ch] mx-auto font-display text-zinc-100"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </section>
        ))}

        {/* Bottom spacer */}
        <div style={{ height: `${viewportHeight - focusLineY}px` }} />
      </div>
    </div>
  );
}

interface SentenceProps {
  sentences: string[];
  fontSize: number;
  focusLineY: number;
  offsetRef: React.MutableRefObject<number>;
}

function SentenceRenderer({ sentences, fontSize, focusLineY, offsetRef }: SentenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const container = containerRef.current;
      if (container) {
        const containerTop = container.getBoundingClientRect().top;
        // läs-linjens absoluta Y i viewporten = focusLineY (eftersom container är i fixed-parenten)
        const lineY = focusLineY;
        let found = -1;
        for (let i = 0; i < sentenceRefs.current.length; i++) {
          const el = sentenceRefs.current[i];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.top <= lineY && r.bottom >= lineY) {
            found = i;
            break;
          }
          if (r.top > lineY) break;
        }
        if (found >= 0 && found !== activeIdx) setActiveIdx(found);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [focusLineY, activeIdx, offsetRef]);

  return (
    <article
      ref={containerRef}
      className="presentation-prose max-w-[60ch] mx-auto font-display text-zinc-100"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
    >
      {sentences.map((s, i) => (
        <span
          key={i}
          ref={(el) => { sentenceRefs.current[i] = el; }}
          className={
            i === activeIdx
              ? "teleprompter-sentence-active"
              : "teleprompter-sentence-dim"
          }
        >
          {s}{" "}
        </span>
      ))}
    </article>
  );
}
