/**
 * docSplit — virtuella sidbrytningar för EditorV2.
 *
 * Princip: en lång HTML-sträng (hela manuset) delas vid presentations-
 * geometrins maxRows. Brytpunkterna är *virtuella* — de styr bara hur
 * dokumentet visualiseras och hur det persisteras till `cards`-tabellen.
 *
 * Viktigt:
 *  - Vi mäter mot exakt samma geometri som presentationsläget
 *    (via splitHtmlAtRow/countPresentationRows i cardLimits.ts).
 *    → 1:1 mellan editor och presentation.
 *  - Vi muterar aldrig dokumentet på grund av brytpunktsberäkning.
 *    Caret är orört, undo/redo orört.
 */

import { splitHtmlAtRow, MAX_ROWS_BY_SIZE, type TextSize } from "./cardLimits";

/**
 * Splitta en hel manus-HTML i N kort-fragments baserat på maxRows.
 * Returnerar lista med HTML-bitar — en per kort, i ordning.
 *
 * Tomma slut-bitar slängs.
 */
export function splitDocToCards(
  html: string,
  textSize: TextSize,
): string[] {
  const max = MAX_ROWS_BY_SIZE[textSize];
  if (!html || !html.trim()) return [""];

  const out: string[] = [];
  let remaining = html;
  let safety = 500;

  while (remaining && remaining.trim() && safety-- > 0) {
    const [fits, overflow] = splitHtmlAtRow(remaining, max, textSize);
    if (!overflow || !overflow.trim()) {
      out.push(fits);
      break;
    }
    if (fits === remaining) {
      // Ingen meningsfull split — stoppa
      out.push(fits);
      break;
    }
    out.push(fits);
    remaining = overflow;
  }

  return out.length > 0 ? out : [""];
}

/**
 * Bygg HTML från lista av kort-fragment (för initial laddning av editorn).
 * Sätter en HTML-kommentar mellan kort som hint för debugging — ProseMirror
 * ignorerar den vid parsning.
 */
export function joinCardsToDoc(cards: { content_html: string }[]): string {
  if (cards.length === 0) return "<p></p>";
  return cards
    .map((c) => c.content_html || "<p></p>")
    .join("\n<!-- card-break -->\n");
}

/**
 * Diff:a beräknade kort-HTML mot existerande DB-rader och returnera
 * en plan för persistans.
 *
 * Strategi:
 *  - Position 0..N-1 mappas mot existerande rader i samma ordning.
 *  - Om HTML är oförändrad: behåll id (ingen update behövs).
 *  - Om HTML ändrats: behåll id men markera som update.
 *  - Överflödiga existerande rader: delete.
 *  - Nya positioner utan motsvarande rad: insert.
 */
export interface CardSyncPlan {
  updates: { id: string; position: number; content_html: string }[];
  inserts: { position: number; content_html: string }[];
  deletes: string[]; // ids
  unchanged: string[]; // ids (för debugging)
}

export function planCardSync(
  computedHtmls: string[],
  existing: { id: string; position: number; content_html: string }[],
): CardSyncPlan {
  const sorted = [...existing].sort((a, b) => a.position - b.position);
  const updates: CardSyncPlan["updates"] = [];
  const inserts: CardSyncPlan["inserts"] = [];
  const deletes: string[] = [];
  const unchanged: string[] = [];

  for (let i = 0; i < computedHtmls.length; i++) {
    const html = computedHtmls[i];
    const row = sorted[i];
    if (row) {
      if (row.content_html === html && row.position === i) {
        unchanged.push(row.id);
      } else {
        updates.push({ id: row.id, position: i, content_html: html });
      }
    } else {
      inserts.push({ position: i, content_html: html });
    }
  }

  for (let i = computedHtmls.length; i < sorted.length; i++) {
    deletes.push(sorted[i].id);
  }

  return { updates, inserts, deletes, unchanged };
}
