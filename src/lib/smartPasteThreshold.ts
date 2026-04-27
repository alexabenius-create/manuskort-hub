/**
 * Smart paste — tröskel-beräkning.
 *
 * MAX_WORDS_PER_CARD härleds från presentationsgeometrin:
 *   rows = floor(cardHeight / lineHeight)
 *   wordsPerRow = floor(cardWidth / avgWordWidth)
 *   max = floor(rows * wordsPerRow * SAFETY)
 *
 * Vi mäter en gång per textstorlek och cachear. Om presentations-CSS
 * ändras → anropa invalidateThresholdCache() för att räkna om.
 */
import { MAX_ROWS_BY_SIZE, type TextSize } from "./cardLimits";

const SAFETY_FACTOR = 0.85;
const FALLBACK = 150;

// Lorem-sample för att mäta avg ordbredd. ~50 ord, varierande längd.
const SAMPLE_WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
  "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
  "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo " +
  "consequat duis aute irure dolor in reprehenderit voluptate velit esse " +
  "cillum dolore fugiat nulla pariatur"
).split(/\s+/);

const cache = new Map<TextSize, number>();

export function invalidateThresholdCache(): void {
  cache.clear();
}

/**
 * Returnerar uppskattat max antal ord ett kort kan innehålla utan att
 * spilla över i presentationsläget.
 */
export function computeMaxWordsPerCard(textSize: TextSize = "md"): number {
  const cached = cache.get(textSize);
  if (cached !== undefined) return cached;

  if (typeof document === "undefined") return FALLBACK;

  try {
    // Skapa egen measurer (vi vill inte mutera den globala från cardLimits)
    const el = document.createElement("div");
    el.className = "presentation-prose font-display";
    el.style.position = "fixed";
    el.style.left = "-99999px";
    el.style.top = "0";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.boxSizing = "content-box";
    el.style.padding = "0";
    el.style.margin = "0";

    // Samma konservativa geometri-konstanter som cardLimits internt.
    // Viktigt: paste-tröskeln måste matcha presentationsmätningen, annars
    // blir inklistrade manus uppdelade i för stora kort.
    const PRES_GEOM = {
      sm: { fontSize: 30, lineHeight: 1.85, widthPx: Math.round(38 * 30 * 0.5) },
      md: { fontSize: 38, lineHeight: 1.85, widthPx: Math.round(38 * 38 * 0.5) },
      lg: { fontSize: 46, lineHeight: 1.85, widthPx: Math.round(38 * 46 * 0.5) },
    } as const;
    const g = PRES_GEOM[textSize];
    el.style.width = `${g.widthPx}px`;
    el.style.fontSize = `${g.fontSize}px`;
    el.style.lineHeight = String(g.lineHeight);

    document.body.appendChild(el);

    try {
      // Mät ordbredd: rendera samplet i en bred container och ta width / antal ord
      const widthProbe = document.createElement("span");
      widthProbe.style.whiteSpace = "nowrap";
      widthProbe.textContent = SAMPLE_WORDS.join(" ");
      el.appendChild(widthProbe);
      const sampleWidth = widthProbe.getBoundingClientRect().width;
      el.removeChild(widthProbe);
      const avgWordWidth = sampleWidth / SAMPLE_WORDS.length;

      if (!isFinite(avgWordWidth) || avgWordWidth <= 0) {
        cache.set(textSize, FALLBACK);
        return FALLBACK;
      }

      const wordsPerRow = Math.max(1, Math.floor(g.widthPx / avgWordWidth));
      const maxRows = MAX_ROWS_BY_SIZE[textSize];
      const max = Math.max(40, Math.floor(maxRows * wordsPerRow * SAFETY_FACTOR));
      cache.set(textSize, max);
      return max;
    } finally {
      document.body.removeChild(el);
    }
  } catch {
    return FALLBACK;
  }
}
