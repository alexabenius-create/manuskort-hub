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
