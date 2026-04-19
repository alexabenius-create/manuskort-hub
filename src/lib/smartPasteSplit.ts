/**
 * Smart paste — split-logik.
 *
 * Tar emot HTML (eller plain text) och delar upp i N kort:
 *   1. H1/H2 → alltid ny korbrytning (sektion).
 *   2. Inom sektion: greedy klumpa stycken tills nästa skulle överskrida maxWords.
 *   3. Om enskilt stycke > maxWords → splitta vid meningsgräns.
 *
 * Returnerar HTML-strängar (en per kort) + räknare för användartoast.
 */
import { splitSentences } from "./sentenceSplit";

export interface SplitResult {
  cardsHtml: string[];
  totalWords: number;
  sectionCount: number; // antal H1/H2-baserade sektioner
  lengthSplitCount: number; // antal kort som splittats pga längd
}

interface Block {
  kind: "heading" | "paragraph" | "list" | "blockquote";
  html: string;
  text: string;
  level?: 1 | 2; // för headings
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Konvertera plain text till HTML: \n\n → paragrafer.
 */
export function plainTextToHtml(text: string): string {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return "";
  return paras
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Parsa HTML till en lista block. Stödjer h1-h6, p, ul/ol, blockquote.
 * Okända noder konverteras till paragraph med textContent.
 */
function parseHtmlBlocks(html: string): Block[] {
  if (typeof document === "undefined") return [];
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const blocks: Block[] = [];

  // Om inga block-element: wrap allt i p
  const hasBlocks = Array.from(tmp.children).some((el) =>
    /^(P|H[1-6]|UL|OL|BLOCKQUOTE|DIV)$/i.test(el.tagName),
  );
  if (!hasBlocks) {
    const text = (tmp.textContent ?? "").trim();
    if (text) {
      blocks.push({ kind: "paragraph", html: `<p>${escapeHtml(text)}</p>`, text });
    }
    return blocks;
  }

  for (const el of Array.from(tmp.children)) {
    const tag = el.tagName.toUpperCase();
    const text = (el.textContent ?? "").trim();
    if (!text && tag !== "BR") continue;

    if (tag === "H1" || tag === "H2") {
      blocks.push({
        kind: "heading",
        html: `<p><strong>${escapeHtml(text)}</strong></p>`,
        text,
        level: tag === "H1" ? 1 : 2,
      });
    } else if (tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6") {
      // Sub-headings → paragraf med bold (ingen sektionsbrytning)
      blocks.push({
        kind: "paragraph",
        html: `<p><strong>${escapeHtml(text)}</strong></p>`,
        text,
      });
    } else if (tag === "UL" || tag === "OL") {
      blocks.push({ kind: "list", html: el.outerHTML, text });
    } else if (tag === "BLOCKQUOTE") {
      blocks.push({ kind: "blockquote", html: el.outerHTML, text });
    } else {
      // p, div, etc. — använd som paragraf
      blocks.push({
        kind: "paragraph",
        html: `<p>${el.innerHTML || escapeHtml(text)}</p>`,
        text,
      });
    }
  }
  return blocks;
}

/**
 * Splitta ett enstaka stycke (för långt) på meningsgräns till N delar
 * där varje del < maxWords.
 */
function splitParagraphBySentences(text: string, maxWords: number): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    // Single mega-mening — fall back till att skära vid ord
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(" "));
    }
    return chunks.map((c) => `<p>${escapeHtml(c)}</p>`);
  }
  const chunks: string[] = [];
  let buf: string[] = [];
  let bufWords = 0;
  for (const s of sentences) {
    const w = wordCount(s);
    if (bufWords + w > maxWords && buf.length > 0) {
      chunks.push(buf.join(" "));
      buf = [];
      bufWords = 0;
    }
    buf.push(s);
    bufWords += w;
  }
  if (buf.length > 0) chunks.push(buf.join(" "));
  return chunks.map((c) => `<p>${escapeHtml(c)}</p>`);
}

/**
 * Klumpa blocks till kort. Greedy: lägg till tills nästa skulle överskrida.
 * Returnerar HTML-strängar + antal kort som splittats pga längd.
 */
function chunkBlocks(blocks: Block[], maxWords: number): { cards: string[]; lengthSplits: number } {
  const cards: string[] = [];
  let lengthSplits = 0;
  let buf: string[] = [];
  let bufWords = 0;

  const flush = () => {
    if (buf.length === 0) return;
    cards.push(buf.join(""));
    buf = [];
    bufWords = 0;
  };

  for (const b of blocks) {
    const w = wordCount(b.text);

    // Ett enstaka block som överskrider maxWords → splitta på meningsgräns
    if (w > maxWords && b.kind === "paragraph") {
      flush();
      const subParts = splitParagraphBySentences(b.text, maxWords);
      for (const part of subParts) {
        cards.push(part);
      }
      if (subParts.length > 1) lengthSplits += subParts.length - 1;
      continue;
    }

    // Skulle detta block få oss över? → flush först
    if (bufWords + w > maxWords && buf.length > 0) {
      flush();
      lengthSplits++;
    }
    buf.push(b.html);
    bufWords += w;
  }
  flush();
  return { cards, lengthSplits };
}

/**
 * Huvudfunktion. Splittar HTML till kort enligt:
 *   1. H1/H2 → ny sektion
 *   2. Greedy paragraph-klumpning till maxWords
 *   3. Långa stycken splittas på meningsgräns
 */
export function splitPastedHtml(html: string, maxWords: number): SplitResult {
  const blocks = parseHtmlBlocks(html);
  const totalWords = blocks.reduce((sum, b) => sum + wordCount(b.text), 0);

  // Dela upp i sektioner per H1/H2
  const sections: Block[][] = [];
  let current: Block[] = [];
  for (const b of blocks) {
    if (b.kind === "heading" && (b.level === 1 || b.level === 2)) {
      if (current.length > 0) sections.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length > 0) sections.push(current);

  const allCards: string[] = [];
  let totalLengthSplits = 0;
  for (const sec of sections) {
    const { cards, lengthSplits } = chunkBlocks(sec, maxWords);
    allCards.push(...cards);
    totalLengthSplits += lengthSplits;
  }

  return {
    cardsHtml: allCards.filter((c) => c.trim()),
    totalWords,
    sectionCount: sections.length,
    lengthSplitCount: totalLengthSplits,
  };
}
