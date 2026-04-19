// Mjuka pasteller — auto-tilldelas i ordning till nya paneldeltagare.
// HSL-strängar för enklare manipulation; lagras som hex i DB för enkelhet i input.
export const PANELIST_PALETTE: string[] = [
  "#F6D976", // varm gul
  "#A8D8B9", // mintgrön
  "#A9C8F0", // mjuk himmelsblå
  "#F4B6C2", // dammig rosa
  "#C8B6E2", // lavendel
  "#F4C28C", // persika
  "#9CD0CF", // mjuk turkos
  "#E2C9A0", // sand
  "#D4B5E8", // ljuslila
  "#B5DDB0", // bladgrön
];

export function nextPanelistColor(usedColors: string[]): string {
  for (const c of PANELIST_PALETTE) {
    if (!usedColors.includes(c)) return c;
  }
  // Fallback — börja om från början om alla använda
  return PANELIST_PALETTE[usedColors.length % PANELIST_PALETTE.length];
}

// Konvertera hex till rgba med given alfa (för bakgrund i editorn)
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Returnerar en mörkare, mättad variant av färgen — lämplig som textfärg ovanpå
// den ljusa bakgrunden. Behåller samma kulör (hue) men sänker ljushet och höjer
// mättnaden så texten får god kontrast och tydlig färgidentitet.
//
// Mål: WCAG AA (≥ 4.5:1) mot vit bakgrund. Tidigare targetL=28 gav vissa
// pasteller (mint, persika, gul) en dämpad ton som upplevdes "grå". Vi sänker
// L till 22 och höjer min-mättnaden — färgen blir tydligt identifierbar.
export function hexToDarkText(hex: string): string {
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
  // Mörkna och mätta — målar en djup, läsbar variant med stark kulör-identitet
  const targetL = 22; // % — tillräckligt mörk för AA mot vit
  const targetS = Math.min(95, Math.max(70, s * 100 + 30));
  return `hsl(${hDeg.toFixed(0)} ${targetS.toFixed(0)}% ${targetL}%)`;
}
