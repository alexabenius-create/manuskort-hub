// Detekterar talare i form av "NAMN:" eller "Namn:" i början av stycken.
// Returnerar lista av unika namn samt en map paragraf-index → namn.

import type { ParsedBlock } from "./parseDocument";

export interface SpeakerDetection {
  names: string[]; // unika namn i upptäckts-ordning
  // För varje paragraph-block-index, namnet på den talare som inleder
  blockSpeaker: Map<number, { name: string; restHtml: string; restText: string }>;
}

const SPEAKER_RE = /^([A-ZÅÄÖ][A-ZÅÄÖa-zåäö-]{1,30}):\s+/;

export function detectSpeakers(blocks: ParsedBlock[]): SpeakerDetection {
  const counts = new Map<string, number>();
  const blockSpeaker = new Map<number, { name: string; restHtml: string; restText: string }>();

  blocks.forEach((b, i) => {
    if (b.type !== "paragraph") return;
    const m = b.plainText.match(SPEAKER_RE);
    if (!m) return;
    const name = m[1];
    counts.set(name, (counts.get(name) || 0) + 1);

    const restText = b.plainText.slice(m[0].length);
    // Ta bort "NAMN: " från HTML också — enklast: använd plain text-prefixet att
    // hitta i innerText och klippa motsvarande från HTML-strängen försiktigt.
    const restHtml = stripPrefixFromHtml(b.html, m[0]);
    blockSpeaker.set(i, { name, restHtml, restText });
  });

  // Tröskel: minst 2 unika namn × ≥3 förekomster totalt
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const unique = Array.from(counts.keys());
  if (unique.length < 2 || total < 3) {
    return { names: [], blockSpeaker: new Map() };
  }

  return { names: unique, blockSpeaker };
}

/**
 * Tar bort prefix-text från HTML genom att operera på första text-noden.
 * Antagande: prefix finns i början av första text-noden av första p-elementet.
 */
function stripPrefixFromHtml(html: string, prefix: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let remaining = prefix;
  while (node && remaining.length > 0) {
    const text = node.textContent || "";
    if (text.startsWith(remaining)) {
      node.textContent = text.slice(remaining.length);
      remaining = "";
      break;
    } else if (remaining.startsWith(text)) {
      remaining = remaining.slice(text.length);
      node.textContent = "";
      node = walker.nextNode();
    } else {
      // Fall back — försök ta bort så mycket som möjligt från början
      const overlap = commonPrefixLen(text, remaining);
      if (overlap > 0) {
        node.textContent = text.slice(overlap);
        remaining = remaining.slice(overlap);
      }
      break;
    }
  }

  return root.innerHTML;
}

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}
