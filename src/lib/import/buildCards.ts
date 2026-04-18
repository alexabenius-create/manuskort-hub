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

  if (opts.strategy === "headings") return splitByHeadings(opts.blocks, ctx);
  if (opts.strategy === "wordcount")
    return splitByWordCount(opts.blocks, ctx, opts.wordsPerCard);
  return splitByParagraph(opts.blocks, ctx);
}

export function detectedSpeakerNames(blocks: ParsedBlock[]): string[] {
  return detectSpeakers(blocks).names;
}
