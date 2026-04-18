/**
 * Tidsformat: "MM:SS" eller "HH:MM:SS".
 * Returnerar antal sekunder, eller null om strängen inte kan tolkas.
 */
export function parseTime(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.length === 2) {
    const [m, s] = nums;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (nums.length === 3) {
    const [h, m, s] = nums;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/**
 * Formaterar sekunder som "MM:SS" (eller "HH:MM:SS" om ≥ 1h).
 * Speglar input-formatet om möjligt.
 */
export function formatTime(totalSeconds: number, useHours = false): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (useHours || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Räkna ut nästa korts starttid givet sluttiden på föregående kort.
 * Returnerar null om sluttiden inte kan tolkas.
 */
export function nextStartFromEnd(endTime: string): string | null {
  const seconds = parseTime(endTime);
  if (seconds === null) return null;
  const useHours = endTime.split(":").length === 3;
  return formatTime(seconds + 1, useHours);
}
