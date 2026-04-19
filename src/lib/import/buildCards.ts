// Orkestrerar: ParsedBlock[] + valfri talar-detektering + strategi → PreviewCard[].

import type { ParsedBlock } from "./parseDocument";
import { detectSpeakers, type SpeakerDetection } from "./detectSpeakers";
import { detectAddressees } from "./detectAddressees";
import {
  splitByHeadings,
  splitByParagraph,
  splitByWordCount,
  type PreviewCard,
  type SplitStrategy,
  type TextSize,
} from "./splitStrategies";
import type { HeadingMode } from "./sanitizeHtml";
import { splitHtmlAtRow, MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";
import { wordCount } from "@/lib/wordCount";
import { annotateQuestionsInHtml, type KnownPanelist } from "./detectQuestions";
import type { ImportMode } from "./importStore";

export interface BuildOptions {
  blocks: ParsedBlock[];
  strategy: SplitStrategy;
  wordsPerCard: number;
  textSize: TextSize;
  // Map: detekterat talar-namn → tempId (skapas av wizarden så den vet vilka som ska bli panelister)
  speakerTempIds: Map<string, string>;
  mode?: ImportMode;
  // Valfri färg-map: detekterat namn → hex-färg. Om ej angiven används palett-fallback i ordning.
  speakerColors?: Map<string, string>;
}

export function autoDetectStrategy(blocks: ParsedBlock[]): SplitStrategy {
  const hasHeadings = blocks.some(
    (b) => b.type === "heading" && (b.level === 1 || b.level === 2)
  );
  return hasHeadings ? "headings" : "wordcount";
}

/**
 * Returnerar slutlig panelist-lista i moderator-mode. Kombinerar:
 *  - explicita talare (Anna: ...)
 *  - adressater (frågor: "Anna, ...")
 *  - intro-lista (punkter med fulla namn)
 * och löser konflikter (förnamn → kanoniskt fullt namn).
 */
function resolvePanelistNames(
  blocks: ParsedBlock[],
  speakers: SpeakerDetection,
): { names: string[] } {
  const addr = detectAddressees(blocks);

  // Slå ihop. Speaker-detekterade namn först (om någon faktiskt talar i manuset),
  // sen fyll på med adressater. Förnamn-kollisioner uppgraderas till längsta namnet.
  const seen = new Set<string>(); // lowercase första-ord
  const names: string[] = [];

  const add = (name: string) => {
    const first = name.split(/\s+/)[0].toLowerCase();
    if (seen.has(first)) {
      const idx = names.findIndex(
        (n) => n.split(/\s+/)[0].toLowerCase() === first,
      );
      if (idx >= 0 && name.split(/\s+/).length > names[idx].split(/\s+/).length) {
        names[idx] = name;
      }
      return;
    }
    seen.add(first);
    names.push(name);
  };

  for (const n of speakers.names) add(n);
  for (const n of addr.names) add(n);

  return { names };
}

export function buildCards(opts: BuildOptions): PreviewCard[] {
  // Speaker-mode: hoppa över talar-detektering helt — det är ett soloföredrag.
  const speakers: SpeakerDetection =
    opts.mode === "speaker"
      ? { names: [], blockSpeaker: new Map() }
      : detectSpeakers(opts.blocks);

  const headingMode: HeadingMode = opts.strategy === "headings" ? "title" : "strong";

  const ctx = {
    speakers,
    panelistTempId: (name: string) => {
      const existing = opts.speakerTempIds.get(name);
      if (existing) return existing;
      const id = `tmp:${name.replace(/\s+/g, "_")}`;
      opts.speakerTempIds.set(name, id);
      return id;
    },
    headingMode,
    mode: opts.mode,
    textSize: opts.textSize,
  };

  let cards: PreviewCard[];
  if (opts.strategy === "headings") cards = splitByHeadings(opts.blocks, ctx);
  else if (opts.strategy === "wordcount")
    cards = splitByWordCount(opts.blocks, ctx, opts.wordsPerCard);
  else cards = splitByParagraph(opts.blocks, ctx);

  // Moderator-mode: annotera frågor TILL panelister i kort-html.
  // Använd den breda panellist-listan (intro-lista + adressater + ev. talare).
  if (opts.mode === "moderator") {
    const resolved = resolvePanelistNames(opts.blocks, speakers);
    if (resolved.names.length > 0) {
      // Skapa KnownPanelist-poster med både fullt namn och förnamn-aliases
      // så att "Anna, ..." matchar "Anna Sjöberg" (samma tempId/färg).
      const known: KnownPanelist[] = [];
      resolved.names.forEach((fullName, i) => {
        const tempId =
          opts.speakerTempIds.get(fullName) ||
          `tmp:${fullName.replace(/\s+/g, "_")}`;
        opts.speakerTempIds.set(fullName, tempId);
        const color = opts.speakerColors?.get(fullName) || PALETTE[i % PALETTE.length];
        // Fullt namn först (matchas i sin helhet om det förekommer i texten)
        known.push({ tempId, name: fullName, color });
        // Alias för förnamn om det fulla namnet är flerordigt
        const first = fullName.split(/\s+/)[0];
        if (first !== fullName) {
          known.push({ tempId, name: first, color });
        }
      });
      cards = cards.map((c) => {
        const annotated = annotateQuestionsInHtml(c.contentHtml, known);
        return annotated === c.contentHtml ? c : { ...c, contentHtml: annotated };
      });
    }
  }

  // Post-processing: säkerställ att inget kort överskrider radgränsen
  // för vald textstorlek. Splitta annars vid ord/meningsgräns.
  return enforceRowLimit(cards, opts.textSize);
}

// Liten lokal palett — matchar PANELIST_PALETTE i ordning så frågor får samma färg
// som talaren när wizarden senare mappar dem.
const PALETTE = [
  "#F6D976", "#A8D8B9", "#A9C8F0", "#F4B6C2", "#C8B6E2",
  "#F4C28C", "#9CD0CF", "#E2C9A0", "#D4B5E8", "#B5DDB0",
];


/**
 * Splittar varje kort som överskrider MAX_ROWS_BY_SIZE[textSize] i flera kort.
 * Fortsättningar får titel "<original> (forts.)" / "(forts. 2)" osv.
 * Talare bevaras från ursprungskortet.
 *
 * Använder splitHtmlAtRow som mäter mot presentationsgeometrin via DOM —
 * därför körs detta endast i browser-miljö.
 */
function enforceRowLimit(cards: PreviewCard[], textSize: TextSize): PreviewCard[] {
  // SSR-safety: om DOM inte finns, hoppa över (sker inte i import-flödet, men säkert).
  if (typeof document === "undefined") return cards;

  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const result: PreviewCard[] = [];
  let idCounter = 0;
  const nextId = () => `pc_split_${Date.now().toString(36)}_${++idCounter}`;

  for (const card of cards) {
    let remaining = card.contentHtml;
    let part = 0;
    // Försök splitta så länge det finns överflöd
    while (remaining && remaining.trim()) {
      const [fits, overflow] = splitHtmlAtRow(remaining, maxRows, textSize);
      const isFirst = part === 0;
      const isOnly = isFirst && !overflow;
      const title = isOnly
        ? card.title
        : isFirst
          ? card.title
          : `${card.title} (forts.${part > 1 ? ` ${part}` : ""})`;
      result.push({
        id: isFirst ? card.id : nextId(),
        title,
        contentHtml: fits,
        // paragraphsHtml förlorar viss precision vid split — sätt till ett enda block
        paragraphsHtml: isFirst ? card.paragraphsHtml : [fits],
        wordCount: wordCount(fits),
        speakerName: card.speakerName,
      });
      if (!overflow) break;
      remaining = overflow;
      part += 1;
      // Säkerhetsnät: undvik oändlig loop om split inte gör framsteg
      if (part > 50) break;
    }
  }
  return result;
}

export function detectedSpeakerNames(blocks: ParsedBlock[], mode?: ImportMode): string[] {
  if (mode === "speaker") return [];
  const speakers = detectSpeakers(blocks);
  if (mode === "moderator") {
    return resolvePanelistNames(blocks, speakers).names;
  }
  return speakers.names;
}
