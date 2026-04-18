// Orkestrerar: ParsedBlock[] + valfri talar-detektering + strategi → PreviewCard[].

import type { ParsedBlock } from "./parseDocument";
import { detectSpeakers } from "./detectSpeakers";
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

export interface BuildOptions {
  blocks: ParsedBlock[];
  strategy: SplitStrategy;
  wordsPerCard: number;
  textSize: TextSize;
  // Map: detekterat talar-namn → tempId (skapas av wizarden så den vet vilka som ska bli panelister)
  speakerTempIds: Map<string, string>;
}

export function autoDetectStrategy(blocks: ParsedBlock[]): SplitStrategy {
  const hasHeadings = blocks.some(
    (b) => b.type === "heading" && (b.level === 1 || b.level === 2)
  );
  return hasHeadings ? "headings" : "wordcount";
}

export function buildCards(opts: BuildOptions): PreviewCard[] {
  const speakers = detectSpeakers(opts.blocks);
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
  };

  let cards: PreviewCard[];
  if (opts.strategy === "headings") cards = splitByHeadings(opts.blocks, ctx);
  else if (opts.strategy === "wordcount")
    cards = splitByWordCount(opts.blocks, ctx, opts.wordsPerCard);
  else cards = splitByParagraph(opts.blocks, ctx);

  // Post-processing: säkerställ att inget kort överskrider radgränsen
  // för vald textstorlek. Splitta annars vid ord/meningsgräns.
  return enforceRowLimit(cards, opts.textSize);
}

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

export function detectedSpeakerNames(blocks: ParsedBlock[]): string[] {
  return detectSpeakers(blocks).names;
}
