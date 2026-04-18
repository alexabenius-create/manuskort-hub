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
