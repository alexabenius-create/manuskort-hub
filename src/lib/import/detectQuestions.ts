// Frågedetektering för moderator-läge.
// Hittar meningar som riktar sig TILL en känd panelist:
//   "Anna, vad tycker du om …?"      (namn + komma + fråga)
//   "Vad säger du om detta, Carl?"   (namn på slutet + ?)
//   "Då går vi över till Anna —"     (överlämnings-fras)
//   "Bengt, din tur."                 (namn + komma + kort uppmaning)
//
// Returnerar HTML där matchande meningar wrappas i
//   <span data-question-to="{tempId}" data-question-name="Anna" data-question-color="#xxx">…</span>

import { hexToDarkText, hexToRgba } from "@/lib/panelistColors";

export interface KnownPanelist {
  tempId: string;
  name: string;
  color: string;
}

const HANDOFF_PHRASES = [
  /\bgår vi (?:nu )?(?:över |vidare )?till\b/i,
  /\bvi (?:går|hoppar) över till\b/i,
  /\böverlämnar(?: ordet)?(?: nu)? till\b/i,
  /\bnu är det\b/i,
  /\bdin tur\b/i,
];

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splittar en text-sträng i meningar och bibehåller punktuering.
 * Enklare än sentenceSplit eftersom vi behöver behålla exakt original-text för replace.
 */
function splitIntoSentences(text: string): { sentence: string; trailing: string }[] {
  const result: { sentence: string; trailing: string }[] = [];
  // Matcha mening = något som slutar med .!?… följt av ev whitespace
  const re = /([^.!?…]+[.!?…]+)(\s*)/g;
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = re.exec(text)) !== null) {
    result.push({ sentence: m[1], trailing: m[2] });
    lastEnd = re.lastIndex;
  }
  // Eventuell rest utan slutpunkt
  if (lastEnd < text.length) {
    const rest = text.slice(lastEnd);
    if (rest.trim()) result.push({ sentence: rest, trailing: "" });
  }
  return result;
}

/**
 * Returnerar tempId+name+color om meningen är en fråga TILL en panelist,
 * annars null.
 */
function matchQuestionTo(
  sentence: string,
  panelists: KnownPanelist[],
): KnownPanelist | null {
  const trimmed = sentence.trim();
  if (!trimmed) return null;

  for (const p of panelists) {
    const nameRe = new RegExp(
      `(^|[\\s"'„(])${escapeRegex(p.name)}([\\s,.?!:;)\\-—–"'”]|$)`,
      "u",
    );
    if (!nameRe.test(trimmed)) continue;

    // Är det en fråga? (slutar med ? eller innehåller fråge-mönster)
    const isQuestion = /\?\s*$/.test(trimmed);
    // Eller en överlämning?
    const isHandoff = HANDOFF_PHRASES.some((re) => re.test(trimmed));
    // Eller "Namn, kort uppmaning."
    const isAddress =
      new RegExp(`^${escapeRegex(p.name)}\\s*[,—–-]\\s+`, "u").test(trimmed) &&
      trimmed.length < 80;

    if (isQuestion || isHandoff || isAddress) {
      return p;
    }
  }
  return null;
}

/**
 * Wrappar matchande meningar i <span data-question-to>.
 * Operatar på text-noder inuti html, bevarar inline-markup utanför.
 *
 * Strategi: parsa HTML, walka text-noder, för varje text-nod splitta
 * i meningar och wrappa de som matchar.
 */
export function annotateQuestionsInHtml(
  html: string,
  panelists: KnownPanelist[],
): string {
  if (panelists.length === 0 || typeof document === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return html;

  // Samla text-noder först (annars muteras trädet under iteration)
  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null = walker.nextNode();
  while (n) {
    // Hoppa över text inuti existerande question/panelist-spans
    let parent: HTMLElement | null = (n as Text).parentElement;
    let inside = false;
    while (parent && parent !== root) {
      if (
        parent.hasAttribute("data-question-to") ||
        parent.hasAttribute("data-panelist-id")
      ) {
        inside = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (!inside) textNodes.push(n as Text);
    n = walker.nextNode();
  }

  for (const tn of textNodes) {
    const text = tn.textContent || "";
    if (!text.trim()) continue;
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) continue;

    // Bygg ny fragment-HTML
    let changed = false;
    const frag = doc.createDocumentFragment();
    for (const { sentence, trailing } of sentences) {
      const match = matchQuestionTo(sentence, panelists);
      if (match) {
        const span = doc.createElement("span");
        span.setAttribute("data-question-to", match.tempId);
        span.setAttribute("data-question-name", match.name);
        span.setAttribute("data-question-color", match.color);
        const fg = hexToDarkText(match.color);
        const accent = hexToRgba(match.color, 0.55);
        span.setAttribute(
          "style",
          `--question-fg: ${fg}; --question-accent: ${accent};`,
        );
        span.className = "question-to-mark";
        span.textContent = sentence;
        frag.appendChild(span);
        if (trailing) frag.appendChild(doc.createTextNode(trailing));
        changed = true;
      } else {
        frag.appendChild(doc.createTextNode(sentence + trailing));
      }
    }

    if (changed) {
      tn.parentNode?.replaceChild(frag, tn);
    }
  }

  return root.innerHTML;
}
