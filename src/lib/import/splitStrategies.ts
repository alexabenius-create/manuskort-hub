// Tre split-strategier som omvandlar ParsedBlock[] → PreviewCard[].
// Talar-detektering har redan körts; om ett block har en talare så
// startar talar-byte ett nytt kort (oavsett strategi).

import type { ParsedBlock } from "./parseDocument";
import type { SpeakerDetection } from "./detectSpeakers";
import { sanitizeHtml, type HeadingMode } from "./sanitizeHtml";
import { splitSentences } from "@/lib/sentenceSplit";
import { wordCount } from "@/lib/wordCount";

export type SplitStrategy = "headings" | "wordcount" | "paragraph";
export type TextSize = "sm" | "md" | "lg";

export interface PreviewCard {
  id: string; // lokalt UUID för React keys
  title: string;
  contentHtml: string; // sanerad och editor-kompatibel
  // Lista av enskilda paragraph-html för "Splitta här"-funktionen
  paragraphsHtml: string[];
  wordCount: number;
  // Talare som dominerar i kortet (om något stycke har en talare)
  speakerName?: string;
}

export const WORDS_PER_CARD_DEFAULT: Record<TextSize, number> = {
  sm: 180,
  md: 130,
  lg: 75,
};

const CARD_THRESHOLDS: Record<TextSize, number> = {
  sm: 220,
  md: 160,
  lg: 90,
};

export function exceedsThreshold(card: PreviewCard, size: TextSize): boolean {
  return card.wordCount > CARD_THRESHOLDS[size];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `pc_${Date.now().toString(36)}_${idCounter}`;
}

function blockToInlineHtml(b: ParsedBlock): string {
  if (b.type === "heading") return `<p><strong>${escapeHtml(b.text)}</strong></p>`;
  if (b.type === "paragraph") return b.html;
  if (b.type === "list") {
    const tag = b.ordered ? "ol" : "ul";
    return `<${tag}>${b.itemsHtml.map((i) => `<li>${i}</li>`).join("")}</${tag}>`;
  }
  return "";
}

function blockToPlainText(b: ParsedBlock): string {
  if (b.type === "heading") return b.text;
  if (b.type === "paragraph") return b.plainText;
  if (b.type === "list") return b.itemsHtml.map((h) => stripTags(h)).join(". ");
  return "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clipTitle(s: string, max = 60): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function firstSentenceTitle(text: string): string {
  const sentences = splitSentences(text);
  const first = sentences[0] || text;
  return clipTitle(first);
}

interface BuildContext {
  speakers: SpeakerDetection;
  panelistTempId: (name: string) => string; // mappa namn → tempId för data-panelist-id
  headingMode: HeadingMode;
}

/**
 * Wrappa text i talar-span om talare finns. HTML-strängen som kommer in är
 * en hel paragraf-html (t.ex. "<p>...</p>"). Vi sätter span runt p-innehållet.
 */
function withSpeakerWrap(html: string, ctx: BuildContext, speakerName?: string): string {
  if (!speakerName) return html;
  const tempId = ctx.panelistTempId(speakerName);
  // Sätt span runt innehållet i FÖRSTA p-blocket som finns
  return html.replace(
    /^(<p[^>]*>)([\s\S]*?)(<\/p>)/,
    (_m, open, inner, close) =>
      `${open}<span data-panelist-id="${tempId}" data-panelist-name="${escapeAttr(speakerName)}">${inner}</span>${close}`
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function buildCard(
  blocks: ParsedBlock[],
  blockIndices: number[],
  ctx: BuildContext,
  forcedTitle?: string
): PreviewCard {
  const paragraphsHtml: string[] = [];
  let combinedPlain = "";
  let speakerName: string | undefined;

  for (const idx of blockIndices) {
    const b = blocks[idx];
    let html = blockToInlineHtml(b);
    let textForCount = blockToPlainText(b);

    // Talar-detektering: om detta block har en talare, byt ut till restHtml och wrappa
    const sp = ctx.speakers.blockSpeaker.get(idx);
    if (sp) {
      html = `<p>${sp.restHtml}</p>`;
      textForCount = sp.restText;
      html = withSpeakerWrap(html, ctx, sp.name);
      if (!speakerName) speakerName = sp.name;
    }

    paragraphsHtml.push(html);
    combinedPlain += " " + textForCount;
  }

  const rawHtml = paragraphsHtml.join("");
  const sanitized = sanitizeHtml(rawHtml, ctx.headingMode);

  let title = forcedTitle;
  if (!title) {
    title = firstSentenceTitle(combinedPlain.trim()) || "Kort";
  }

  return {
    id: nextId(),
    title: clipTitle(title),
    contentHtml: sanitized,
    paragraphsHtml,
    wordCount: wordCount(sanitized),
    speakerName,
  };
}

// =================== Strategi: Rubriker ===================

export function splitByHeadings(blocks: ParsedBlock[], ctx: BuildContext): PreviewCard[] {
  const cards: PreviewCard[] = [];
  let currentTitle: string | null = null;
  let currentIndices: number[] = [];

  const flush = () => {
    if (currentIndices.length === 0 && !currentTitle) return;
    cards.push(buildCard(blocks, currentIndices, ctx, currentTitle ?? undefined));
    currentIndices = [];
    currentTitle = null;
  };

  blocks.forEach((b, i) => {
    if (b.type === "heading" && (b.level === 1 || b.level === 2)) {
      flush();
      currentTitle = b.text;
      return;
    }
    // Talar-byte forcerar nytt kort också
    const sp = ctx.speakers.blockSpeaker.get(i);
    const lastSpeaker = currentIndices.length > 0
      ? ctx.speakers.blockSpeaker.get(currentIndices[currentIndices.length - 1])?.name
      : undefined;
    if (sp && lastSpeaker && sp.name !== lastSpeaker) {
      flush();
    }
    currentIndices.push(i);
  });
  flush();

  // Om första kortet har "Inledning"-text utan titel → ge titel
  if (cards.length > 0 && !cards[0].title) cards[0].title = "Inledning";
  return cards.filter((c) => c.contentHtml.trim() || c.title);
}

// =================== Strategi: Ordantal ===================

export function splitByWordCount(
  blocks: ParsedBlock[],
  ctx: BuildContext,
  wordsPerCard: number
): PreviewCard[] {
  const cards: PreviewCard[] = [];
  let currentIndices: number[] = [];
  let currentWords = 0;

  const flush = () => {
    if (currentIndices.length === 0) return;
    cards.push(buildCard(blocks, currentIndices, ctx));
    currentIndices = [];
    currentWords = 0;
  };

  blocks.forEach((b, i) => {
    // Talar-byte forcerar nytt kort
    const sp = ctx.speakers.blockSpeaker.get(i);
    const lastSpeaker = currentIndices.length > 0
      ? ctx.speakers.blockSpeaker.get(currentIndices[currentIndices.length - 1])?.name
      : undefined;
    if (sp && lastSpeaker && sp.name !== lastSpeaker && currentIndices.length > 0) {
      flush();
    }

    currentIndices.push(i);
    const txt = blockToPlainText(b);
    currentWords += txt.split(/\s+/).filter(Boolean).length;

    // Stäng vid meningsgräns när vi når målet
    if (currentWords >= wordsPerCard) {
      // Eftersom vi alltid stänger på block-gräns och varje block är ett
      // helt stycke (avslutas typiskt med punkt) bryter vi aldrig en mening.
      flush();
    }
  });
  flush();

  return cards;
}

// =================== Strategi: En per stycke ===================

export function splitByParagraph(blocks: ParsedBlock[], ctx: BuildContext): PreviewCard[] {
  // Slå ihop paragraf-block med <15 ord till föregående
  const groups: number[][] = [];
  blocks.forEach((b, i) => {
    const txt = blockToPlainText(b);
    const wc = txt.split(/\s+/).filter(Boolean).length;

    const sp = ctx.speakers.blockSpeaker.get(i);
    const lastGroup = groups[groups.length - 1];
    const lastSpeaker = lastGroup
      ? ctx.speakers.blockSpeaker.get(lastGroup[lastGroup.length - 1])?.name
      : undefined;

    // Talar-byte → nytt kort
    if (sp && lastSpeaker && sp.name !== lastSpeaker) {
      groups.push([i]);
      return;
    }

    if (wc < 15 && lastGroup && !sp) {
      lastGroup.push(i);
    } else {
      groups.push([i]);
    }
  });

  return groups.map((indices) => buildCard(blocks, indices, ctx));
}
