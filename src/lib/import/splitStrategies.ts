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

// Mode forwardas in så vi kan styra wrap-beteende. I moderator-läge
// är texten i grunden moderatorns egna ord — vi vill INTE färga hela
// stycken som "talare", bara markera frågor riktade till panelister.
export type CardBuildMode = "moderator" | "speaker" | undefined;

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
  if (b.type === "blockquote") return b.html;
  if (b.type === "list") {
    const tag = b.ordered ? "ol" : "ul";
    return `<${tag}>${b.itemsHtml.map((i) => `<li>${i}</li>`).join("")}</${tag}>`;
  }
  return "";
}

function blockToPlainText(b: ParsedBlock): string {
  if (b.type === "heading") return b.text;
  if (b.type === "paragraph") return b.plainText;
  if (b.type === "blockquote") return b.plainText;
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
  mode?: CardBuildMode;
  textSize?: TextSize;
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

    // Talar-detektering: om detta block har en talare, byt ut till restHtml och wrappa.
    // restHtml är redan ett komplett block (typiskt "<p>...</p>") från stripPrefixFromHtml,
    // så vi får INTE wrappa det i ytterligare en <p>.
    const sp = ctx.speakers.blockSpeaker.get(idx);
    if (sp) {
      html = sp.restHtml;
      textForCount = sp.restText;
      // I moderator-läge: hoppa över talar-wrap helt. Texten betraktas
      // som moderatorns egna ord; frågor TILL panelister markeras
      // separat via annotateQuestionsInHtml och får då panelistens färg.
      if (ctx.mode !== "moderator") {
        html = withSpeakerWrap(html, ctx, sp.name);
      }
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

// =================== Strategi: Ordantal (rad-baserad) ===================

// Importera dynamiskt för att undvika cirkulär import med cardLimits.
// Vi använder rad-mätning som primär signal — ordantalet är kvar som fallback
// när DOM ej finns (SSR).
import { countPresentationRows, MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";

export function splitByWordCount(
  blocks: ParsedBlock[],
  ctx: BuildContext,
  wordsPerCard: number
): PreviewCard[] {
  const cards: PreviewCard[] = [];
  let currentIndices: number[] = [];
  let currentWords = 0;

  // Mål: fyll till ~80% av max-rader. Tak: 100%. Mätning sker mot
  // den ackumulerade html-strängen i presentationsgeometri.
  const hasDom = typeof document !== "undefined";
  const textSize: TextSize = ctx.textSize ?? "md";
  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const targetRows = Math.max(2, Math.floor(maxRows * 0.8));

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

    // Om DOM finns: kolla rader. Annars fall tillbaka på ord-mål.
    if (hasDom) {
      const html = currentIndices.map((idx) => blockToInlineHtml(blocks[idx])).join("");
      const rows = countPresentationRows(html, textSize);
      if (rows >= maxRows) {
        // Hård gräns nådd — flush
        flush();
      } else if (rows >= targetRows) {
        // Lookahead: skulle nästa block få oss över maxRows? Om ja — flush nu.
        const next = blocks[i + 1];
        if (next) {
          const nextHtml = html + blockToInlineHtml(next);
          const nextRows = countPresentationRows(nextHtml, textSize);
          if (nextRows > maxRows) flush();
        } else {
          flush();
        }
      }
    } else if (currentWords >= wordsPerCard) {
      flush();
    }
  });
  flush();

  // Post-pass: slå ihop sista kortet med föregående om det blir < 30% av målet
  if (cards.length >= 2) {
    const last = cards[cards.length - 1];
    if (last.wordCount < wordsPerCard * 0.3) {
      const prev = cards[cards.length - 2];
      const mergedHtml = prev.contentHtml + last.contentHtml;
      cards[cards.length - 2] = {
        ...prev,
        contentHtml: mergedHtml,
        paragraphsHtml: [...prev.paragraphsHtml, ...last.paragraphsHtml],
        wordCount: wordCount(mergedHtml),
      };
      cards.pop();
    }
  }

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
