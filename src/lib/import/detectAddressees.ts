// Detekterar panelister när manuset är ett MODERATOR-manus där moderatorn
// ställer frågor till panelister (vilket är det vanliga). Då finns inga
// "Talare:"-prefix i texten — istället är panelisterna ADRESSATER för frågor.
//
// Två kompletterande källor:
//   A) Adressat-mönster i frågor:
//        "Anna, vad tycker du om X?"
//        "Vad säger du, Johan?"
//        "Vi går över till Lisa."
//   B) Panel-introduktionslista — punktlista där varje item börjar med
//      ett namn (typiskt "**Anna Sjöberg**, kommunalråd...").
//
// Resultat: lista av kanoniska namn (helst för- + efternamn när det går att
// härleda från intro-listan) plus en map från första-namn → kanoniskt namn
// så att senare matchningar i frågor kan slå upp rätt panelist.

import type { ParsedBlock } from "./parseDocument";

export interface AddresseeDetection {
  /** Unika kanoniska namn att skapa panelister av (i upptäckts-ordning). */
  names: string[];
  /** Map: lowercase-förnamn → kanoniskt namn (för att binda "Anna" → "Anna Sjöberg"). */
  firstNameToCanonical: Map<string, string>;
}

const NAME_TOKEN = `[A-ZÅÄÖ][a-zåäö'’\\-]{1,24}`;
const FIRST_NAME = NAME_TOKEN;
const FULL_NAME = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){0,2}`; // 1-3 ord

// Ord som inte är namn även om de matchar (samma logik som detectSpeakers).
const STOPWORD_LOWER = new Set([
  "och", "eller", "men", "om", "att", "det", "den", "de", "en", "ett",
  "vi", "du", "jag", "han", "hon", "hen", "ni", "man", "så", "nu", "då",
  "kapitel", "avsnitt", "del", "sida", "sektion", "rubrik", "stycke",
  "inledning", "introduktion", "intro", "bakgrund", "syfte",
  "samtal", "panelsamtal", "diskussion", "frågor", "fråga",
  "avslutning", "avrundning", "slutord", "summering", "sammanfattning",
  "paus", "break", "tack",
  "manus", "manuskript", "agenda", "program", "innehåll", "översikt",
  "obs", "notera", "anteckning", "exempel", "övning",
  "moderator", "talare", "panel", "panelen", "panelist", "deltagare",
]);

function isLikelyFirstName(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 2) return false;
  if (STOPWORD_LOWER.has(trimmed.toLowerCase())) return false;
  return /^[A-ZÅÄÖ][a-zåäö'’\-]+$/.test(trimmed);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * (B) Hitta panel-introduktionslista. Letar efter list-block där minst
 * 2 items börjar med ett troligt namn (1-3 ord, valfritt följt av komma/dash
 * och beskrivning). Returnerar fulla namn i listans ordning.
 */
function detectFromIntroList(blocks: ParsedBlock[]): string[] {
  const NAME_AT_START = new RegExp(`^(${FULL_NAME})\\s*(?:[,—–\\-]|$)`);

  for (const b of blocks) {
    if (b.type !== "list") continue;
    const candidates: string[] = [];
    for (const itemHtml of b.itemsHtml) {
      const text = stripTags(itemHtml);
      const m = text.match(NAME_AT_START);
      if (!m) {
        candidates.length = 0; // hela listan måste se enhetlig ut
        break;
      }
      const name = m[1].trim();
      const first = name.split(/\s+/)[0];
      if (!isLikelyFirstName(first)) {
        candidates.length = 0;
        break;
      }
      candidates.push(name);
    }
    if (candidates.length >= 2) return candidates;
  }
  return [];
}

/**
 * (A) Räkna förnamn som förekommer som adressater i frågor / handoffs.
 * Mönster:
 *   - "^Namn[,—–-]\s"        (början av mening)
 *   - ",\s*Namn\s*[?!]"      (anrop på slutet)
 *   - "till Namn[.\s]"       (handoff — enkelt mönster)
 */
function countAddresseeFirstNames(blocks: ParsedBlock[]): Map<string, number> {
  const counts = new Map<string, number>();

  // Ett enda generiskt mönster som fångar för-namns-tilltal i tre former.
  // Vi extraherar förnamnet ur grupp 1, 2 eller 3.
  const RE = new RegExp(
    [
      // 1) Början av mening: "Anna, ..." / "Anna — ..."
      `(?:^|[.!?…]\\s+)(${FIRST_NAME})\\s*[,—–\\-]\\s+`,
      // 2) Anrop på slutet: ", Anna?" / ", Anna!"
      `,\\s*(${FIRST_NAME})\\s*[?!]`,
      // 3) Handoff: "till Anna." / "till Anna,"
      `\\btill\\s+(${FIRST_NAME})\\b`,
    ].join("|"),
    "gu",
  );

  for (const b of blocks) {
    if (b.type !== "paragraph") continue;
    const text = b.plainText;
    let m: RegExpExecArray | null;
    RE.lastIndex = 0;
    while ((m = RE.exec(text)) !== null) {
      const name = m[1] || m[2] || m[3];
      if (!name || !isLikelyFirstName(name)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return counts;
}

export function detectAddressees(blocks: ParsedBlock[]): AddresseeDetection {
  // B först — fulla namn vinner.
  const introNames = detectFromIntroList(blocks);
  const introFirstSet = new Set(introNames.map((n) => n.split(/\s+/)[0].toLowerCase()));

  // A — räkna adressater i texten
  const addressCounts = countAddresseeFirstNames(blocks);

  // Bygg kanonisk lista i denna ordning:
  //   1. introNames (fulla namn) — alltid med, även om count är låg, för
  //      explicit panel-presentation är ett starkt signal.
  //   2. övriga förnamn ur adress-räkningen som förekommer ≥2 gånger.
  const names: string[] = [];
  const firstNameToCanonical = new Map<string, string>();

  for (const full of introNames) {
    names.push(full);
    firstNameToCanonical.set(full.split(/\s+/)[0].toLowerCase(), full);
  }

  // Om vi har en intro-lista är vi liberala — alla extra adressater (count≥1) tas med.
  // Annars kräver vi count≥1 men totalt ≥3 träffar och ≥2 unika namn.
  const uniqueAddrCount = addressCounts.size;
  const totalAddr = Array.from(addressCounts.values()).reduce((a, b) => a + b, 0);
  const liberalThreshold = introNames.length >= 2;
  const passesAOnly = uniqueAddrCount >= 2 && totalAddr >= 3;

  for (const [first, count] of addressCounts) {
    const lower = first.toLowerCase();
    if (introFirstSet.has(lower)) continue; // redan med via intro-listan
    if (!liberalThreshold && !passesAOnly) continue;
    if (!liberalThreshold && count < 1) continue;
    names.push(first);
    firstNameToCanonical.set(lower, first);
  }

  if (introNames.length >= 2) return { names, firstNameToCanonical };
  if (passesAOnly) return { names, firstNameToCanonical };
  return { names: [], firstNameToCanonical: new Map() };
}
