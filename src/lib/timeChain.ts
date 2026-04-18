/**
 * Tidsformat:
 *  - "elapsed": MM:SS eller HH:MM:SS (förfluten tid från start)
 *  - "clock":   HH:MM (klockslag på dygnet, 24h)
 */
export type TimeFormat = "elapsed" | "clock";

/**
 * Returnerar antal sekunder sedan referenspunkten (programstart eller midnatt),
 * eller null om strängen inte kan tolkas.
 */
export function parseTime(value: string, format: TimeFormat = "elapsed"): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));

  if (format === "clock") {
    if (nums.length === 2) {
      const [h, m] = nums;
      if (h >= 24 || m >= 60) return null;
      return h * 3600 + m * 60;
    }
    if (nums.length === 3) {
      const [h, m, s] = nums;
      if (h >= 24 || m >= 60 || s >= 60) return null;
      return h * 3600 + m * 60 + s;
    }
    return null;
  }

  // elapsed
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
 * Formaterar sekunder enligt önskat format.
 *  - "clock":   alltid HH:MM (24h, wrappar runt midnatt)
 *  - "elapsed": MM:SS, eller HH:MM:SS om ≥ 1h
 */
export function formatTime(totalSeconds: number, format: TimeFormat = "elapsed"): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");

  if (format === "clock") {
    const wrapped = ((safe % 86400) + 86400) % 86400;
    const h = Math.floor(wrapped / 3600);
    const m = Math.floor((wrapped % 3600) / 60);
    return `${pad(h)}:${pad(m)}`;
  }

  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Räkna ut nästa korts starttid givet sluttiden på föregående kort.
 *  - clock:   + 1 minut (HH:MM visar inte sekunder)
 *  - elapsed: + 1 sekund
 * Returnerar null om sluttiden inte kan tolkas.
 */
export function nextStartFromEnd(endTime: string, format: TimeFormat = "elapsed"): string | null {
  const seconds = parseTime(endTime, format);
  if (seconds === null) return null;
  const increment = format === "clock" ? 60 : 1;
  return formatTime(seconds + increment, format);
}

export function placeholderForFormat(format: TimeFormat): string {
  return format === "clock" ? "14:00" : "00:00";
}
