// Max antal visuella rader per kort beroende på textstorlek.
// Optimerat för A5 liggande + framtida visningsläge på iPad/desktop.
export const MAX_ROWS_BY_SIZE = { sm: 10, md: 8, lg: 6 } as const;
export type TextSize = keyof typeof MAX_ROWS_BY_SIZE;

/**
 * Räknar antal visuella rader (inklusive mjuk wrappning) i ett element.
 * Mäter scrollHeight / line-height på roten.
 */
export function countVisualRows(el: HTMLElement): number {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!lh || !isFinite(lh) || lh <= 0) return 0;
  return Math.max(1, Math.round(el.scrollHeight / lh));
}

/**
 * Delar HTML i två ungefär lika stora delar vid närmaste blockgräns
 * (paragraf eller mening). Returnerar [förstahalva, andrahalva].
 * Om innehållet inte går att dela meningsfullt: returnera [hela, ""].
 */
export function splitHtmlInHalf(html: string): [string, string] {
  if (!html || !html.trim()) return [html, ""];

  const container = document.createElement("div");
  container.innerHTML = html;

  const blocks = Array.from(container.children) as HTMLElement[];

  // Fall 1: flera blockelement → hitta mittpunkt baserat på textlängd
  if (blocks.length >= 2) {
    const lengths = blocks.map((b) => (b.textContent ?? "").length);
    const total = lengths.reduce((a, b) => a + b, 0);
    let acc = 0;
    let splitAt = 1;
    for (let i = 0; i < blocks.length; i++) {
      acc += lengths[i];
      if (acc >= total / 2) { splitAt = i + 1; break; }
    }
    splitAt = Math.max(1, Math.min(blocks.length - 1, splitAt));
    const first = blocks.slice(0, splitAt).map((b) => b.outerHTML).join("");
    const second = blocks.slice(splitAt).map((b) => b.outerHTML).join("");
    return [first, second];
  }

  // Fall 2: ett enda block (typ <p>) → dela på meningar
  const block = blocks[0] ?? container;
  const text = block.textContent ?? "";
  if (text.length < 40) return [html, ""];

  // Hitta meningsslut närmast mitten
  const mid = Math.floor(text.length / 2);
  const sentenceEnds: number[] = [];
  const re = /[.!?…]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    sentenceEnds.push(m.index + m[0].length);
  }
  let splitChar = mid;
  if (sentenceEnds.length > 0) {
    splitChar = sentenceEnds.reduce((best, p) =>
      Math.abs(p - mid) < Math.abs(best - mid) ? p : best
    , sentenceEnds[0]);
  } else {
    // Fallback: närmaste mellanslag
    const space = text.lastIndexOf(" ", mid);
    if (space > 0) splitChar = space + 1;
  }

  const tag = block.tagName.toLowerCase();
  const firstText = text.slice(0, splitChar).trimEnd();
  const secondText = text.slice(splitChar).trimStart();
  if (!secondText) return [html, ""];
  return [`<${tag}>${escapeHtml(firstText)}</${tag}>`, `<${tag}>${escapeHtml(secondText)}</${tag}>`];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
