// Hjälpare för platshållare i manus, t.ex. [ditt namn].
// Används för:
// - Autofyllning vid seedning av exempelmanus
// - Hitta & ersätt-funktion i editorn
// - Pre-flight-varning innan presentation startar

export interface ProfileValues {
  display_name?: string | null;
  display_title?: string | null;
  display_org?: string | null;
}

/** Mappar platshållartext (utan hakparenteser, lowercase) → profilfält. */
const PLACEHOLDER_MAP: Record<string, keyof ProfileValues> = {
  "ditt namn": "display_name",
  "din titel": "display_title",
  "din organisation": "display_org",
};

/**
 * Ersätter [ditt namn], [din titel], [din organisation] (case-insensitive)
 * mot motsvarande profilvärden om de finns. Lämnar resten orört.
 */
export function autofillProfilePlaceholders(html: string, profile: ProfileValues): string {
  if (!html) return html;
  return html.replace(/\[([^\]]+)\]/g, (full, inner: string) => {
    const key = inner.trim().toLowerCase();
    const field = PLACEHOLDER_MAP[key];
    if (!field) return full;
    const value = profile[field];
    if (!value || !value.trim()) return full;
    return value;
  });
}

/**
 * Hittar alla [...]-platshållare i en HTML-sträng. Returnerar unika
 * trimmade etiketter med hakparenteser, t.ex. "[ditt namn]".
 */
export function findPlaceholders(html: string): string[] {
  if (!html) return [];
  // Matcha enbart inom textnoder, dvs hoppa över taggar
  const stripped = html.replace(/<[^>]*>/g, " ");
  const matches = stripped.match(/\[[^\]\n]+\]/g) ?? [];
  const unique = new Set<string>();
  for (const m of matches) unique.add(m.trim());
  return Array.from(unique);
}

/** Skannar flera korts content_html och returnerar sorterad unik lista. */
export function scanCardsForPlaceholders(
  cards: { content_html: string | null }[]
): string[] {
  const set = new Set<string>();
  for (const c of cards) {
    for (const p of findPlaceholders(c.content_html ?? "")) set.add(p);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
}

/**
 * Ersätter alla förekomster av en exakt sträng i HTML, men hoppar över
 * matches inuti taggar (mellan < och >). Case-insensitive matchning.
 * Returnerar ny HTML + antal ersättningar.
 */
export function replaceInHtml(
  html: string,
  search: string,
  replacement: string
): { html: string; count: number } {
  if (!html || !search) return { html, count: 0 };

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRe = new RegExp(escaped, "gi");

  let count = 0;
  let result = "";
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) {
        result += html.slice(i);
        break;
      }
      result += html.slice(i, close + 1);
      i = close + 1;
    } else {
      const next = html.indexOf("<", i);
      const segment = next === -1 ? html.slice(i) : html.slice(i, next);
      const replaced = segment.replace(searchRe, () => {
        count += 1;
        return replacement;
      });
      result += replaced;
      i = next === -1 ? html.length : next;
    }
  }

  return { html: result, count };
}
