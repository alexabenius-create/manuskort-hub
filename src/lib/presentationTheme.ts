/**
 * Färg-derivering för panelist-attributioner i presentationsläget (mörkt tema).
 *
 * I editorn renderas attributionerna med ljus pastellbakgrund + mörk text.
 * I presentationsläget är bakgrunden mörk och vi vill ha ljus serif-text ovanpå
 * en *mättad men dämpad* kulör så identiteten finns kvar utan att tappa kontrast.
 */

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let hDeg = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l0 - 1));
    switch (max) {
      case r: hDeg = ((g - b) / d) % 6; break;
      case g: hDeg = (b - r) / d + 2; break;
      case b: hDeg = (r - g) / d + 4; break;
    }
    hDeg *= 60;
    if (hDeg < 0) hDeg += 360;
  }
  return { h: hDeg, s: s * 100, l: l0 * 100 };
}

/** Mörk, mättad bakgrundsvariant lämplig som highlight under ljus serif-text. */
export function darkAttributionBg(hex: string, alpha = 0.45): string {
  const { h } = hexToHsl(hex);
  // Fast L=22%, S=55% för konsekvent ton oavsett ingångsfärg
  return `hsla(${h.toFixed(0)}, 55%, 22%, ${alpha})`;
}

/** Ljusare, mättad variant för namn-label ovanför attribution. */
export function darkAttributionLabel(hex: string): string {
  const { h } = hexToHsl(hex);
  return `hsl(${h.toFixed(0)} 70% 70%)`;
}

/** Tunn kant (border) för attribution-spannet. */
export function darkAttributionBorder(hex: string): string {
  const { h } = hexToHsl(hex);
  return `hsla(${h.toFixed(0)}, 60%, 55%, 0.35)`;
}
