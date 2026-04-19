// Detekterar talare i form av flera mönster i början av stycken.
// Stödjer:
//   "NAMN:"            → "Anna:"
//   "Förnamn Efternamn:" → "Anna Svensson:"
//   "Anna —" / "Anna –" / "Anna -"  (em/en-dash, eller bindestreck)
//   "Anna (moderator):" / "Anna [moderator]:"
//   Namn på egen rad följt av talartext (heading-liknande paragraf)
//
// Returnerar lista av unika namn samt en map paragraf-index → namn.

import type { ParsedBlock } from "./parseDocument";

export interface SpeakerDetection {
  names: string[]; // unika namn i upptäckts-ordning
  // För varje paragraph-block-index, namnet på den talare som inleder
  blockSpeaker: Map<number, { name: string; restHtml: string; restText: string }>;
}

// Namn-token: börjar med versal (inkl Å/Ä/Ö), kan innehålla bindestreck.
// Tillåter 1-2 ord (För-/efternamn) men håller längd i schack.
const NAME_TOKEN = `[A-ZÅÄÖ][A-ZÅÄÖa-zåäö'’\\-]{1,24}`;
const NAME_PART = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?`;
// Valfri parentes/hakparentes-roll: " (moderator)" / " [gäst]"
const ROLE_OPT = `(?:\\s*[\\(\\[][^\\)\\]]{1,40}[\\)\\]])?`;
// Avskiljare: kolon, em-dash, en-dash, bindestreck (ev omgivet av spaces)
const SEP = `(?::|\\s+[—–-])`;

const SPEAKER_RE = new RegExp(`^(${NAME_PART})${ROLE_OPT}${SEP}\\s+`);

// Regex för "namn på egen rad" — hela paragrafens text matchar bara namnet.
const NAME_ONLY_RE = new RegExp(`^(${NAME_PART})${ROLE_OPT}\\s*[:.]?\\s*$`);

// Ord vi NÄSTAN ALDRIG vill behandla som talare även om de matchar mönstret.
// Inkluderar både gemen- och versal-form (för rubriker som "SAMTAL", "INLEDNING").
const STOPWORD_LOWER = new Set([
  // Vanliga småord/pronomen
  "och", "eller", "men", "om", "att", "det", "den", "de", "en", "ett",
  "vi", "du", "jag", "han", "hon", "hen", "ni", "man", "så", "nu", "då",
  // Dokumentstruktur / rubrik-ord (svenska)
  "kapitel", "avsnitt", "del", "sida", "sektion", "rubrik", "stycke",
  "inledning", "introduktion", "intro", "bakgrund", "syfte",
  "samtal", "panelsamtal", "diskussion", "frågor", "fråga",
  "avslutning", "avrundning", "slutord", "summering", "sammanfattning",
  "paus", "break", "tack",
  "manus", "manuskript", "agenda", "program", "innehåll", "översikt",
  "obs", "notera", "anteckning", "exempel", "övning",
  "moderator", "talare", "panel", "panelen", "panelist", "deltagare",
]);

// Heuristik: ALL-CAPS-ord (>2 tecken) är nästan alltid rubriker, inte namn.
function isAllCaps(s: string): boolean {
  if (s.length < 3) return false;
  // Måste innehålla minst en bokstav och inga gemener.
  return /[A-ZÅÄÖ]/.test(s) && !/[a-zåäö]/.test(s);
}

function isLikelyName(name: string): boolean {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  if (first.length < 2) return false;
  // ALL-CAPS → behandla som rubrik, inte namn (även "MARIA" på egen rad).
  if (parts.every(isAllCaps)) return false;
  if (STOPWORD_LOWER.has(first.toLowerCase())) return false;
  return true;
}

export function detectSpeakers(blocks: ParsedBlock[]): SpeakerDetection {
  const counts = new Map<string, number>();
  const blockSpeaker = new Map<number, { name: string; restHtml: string; restText: string }>();

  // Pass 1: direkta inline-mönster ("Anna: ...", "Anna — ...")
  blocks.forEach((b, i) => {
    if (b.type !== "paragraph") return;
    const m = b.plainText.match(SPEAKER_RE);
    if (!m) return;
    const name = m[1];
    if (!isLikelyName(name)) return;

    counts.set(name, (counts.get(name) || 0) + 1);
    const restText = b.plainText.slice(m[0].length);
    const restHtml = stripPrefixFromHtml(b.html, m[0]);
    blockSpeaker.set(i, { name, restHtml, restText });
  });

  // Pass 2: "Namn på egen rad" — paragraf är bara ett namn, NÄSTA paragraf är repliken.
  blocks.forEach((b, i) => {
    if (b.type !== "paragraph") return;
    if (blockSpeaker.has(i)) return;
    const m = b.plainText.trim().match(NAME_ONLY_RE);
    if (!m) return;
    const name = m[1];
    if (!isLikelyName(name)) return;

    // Hitta nästa paragraf-block
    let next = i + 1;
    while (next < blocks.length && blocks[next].type !== "paragraph") next++;
    if (next >= blocks.length) return;
    const nb = blocks[next];
    if (nb.type !== "paragraph") return;
    if (blockSpeaker.has(next)) return;

    // Markera nästa paragraf som tillhörande denna talare; ursprungs-paragrafen
    // markeras som tom så den filtreras bort i bygg-steget.
    counts.set(name, (counts.get(name) || 0) + 1);
    blockSpeaker.set(next, { name, restHtml: nb.html, restText: nb.plainText });
    // Töm name-only paragrafen så den inte producerar ett tomt kort
    blockSpeaker.set(i, { name, restHtml: "", restText: "" });
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
