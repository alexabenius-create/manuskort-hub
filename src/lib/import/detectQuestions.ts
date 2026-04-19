// Frågedetektering för moderator-läge.
//
// Hittar TILLTAL till en känd panelist och wrappar bara själva tilltalet +
// (om relevant) den efterföljande frågesatsen i:
//   <span data-question-to="{tempId}" data-question-name="Anna" data-panelist-color="#xxx">…</span>
//
// Tre tydliga mönster (i prioritetsordning):
//   1. Direkt tilltal i början av mening:
//        "Anna, vad tycker du om detta?"           → markera "Anna," + frågesatsen
//        "Anders — låt oss zooma in. Vad är …?"    → markera "Anders —" + nästa fråga (≤2 meningar)
//   2. Anrop på slutet:
//        "Vad säger du, Carl?"                     → markera ", Carl?"
//   3. Överlämning:
//        "Då går vi över till Bengt."              → markera bara "Bengt"
//        "Bengt, din tur."                          → markera "Bengt"
//
// Falska positiva som UNDVIKS:
//   "Vad sa Anders i går?"  — namnet saknar tilltals-skiljetecken (komma/dash) och meningen
//                              är inte ett anrop på slutet → ingen markering.

import type { ParsedBlock } from "./parseDocument";
import { hexToDarkText, hexToRgba } from "@/lib/panelistColors";

export interface KnownPanelist {
  tempId: string;
  name: string;
  color: string;
}

const HANDOFF_RES = [
  /\b(?:går vi (?:nu )?(?:över |vidare )?till|vi (?:går|hoppar) över till|överlämnar(?: ordet)?(?: nu)? till|nu är det)\s+/i,
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Match {
  start: number;
  end: number;
  panelist: KnownPanelist;
}

/**
 * Hittar alla tilltals-spans i en text-sträng.
 * Returnerar icke-överlappande, sorterade matchningar.
 */
function findMatches(text: string, panelists: KnownPanelist[]): Match[] {
  const matches: Match[] = [];

  for (const p of panelists) {
    const name = escapeRegex(p.name);

    // 1a. Direkt tilltal i början av mening: "Anna, ..." eller "Anders — ..."
    //     "Början av mening" = textstart eller efter .!?… + whitespace.
    //     Markera namnet + skiljetecken + ev. fortsatt frågesats fram till nästa "?"
    //     (max ~250 tecken så vi inte sväljer halva kortet).
    {
      const re = new RegExp(
        `(^|[.!?…]\\s+)(${name}\\s*[,—–\\-]\\s+)([^?!.…]{0,250}\\?)?`,
        "gu",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const prefix = m[1];
        const tilltal = m[2];
        const fortsattning = m[3] || "";
        const start = m.index + prefix.length;
        const end = start + tilltal.length + fortsattning.length;
        matches.push({ start, end, panelist: p });
      }
    }

    // 1b. Direkt tilltal där frågan kommer i NÄSTA mening:
    //     "Anders, låt oss zooma in på X. Vad är viktigast?"
    //     Markera tilltalet + första meningen + frågan (om den slutar med ?).
    {
      const re = new RegExp(
        `(^|[.!?…]\\s+)(${name}\\s*[,—–\\-]\\s+)([^.!?…]+[.!?…]\\s+)([^?!.…]{0,200}\\?)`,
        "gu",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = m.index + m[1].length;
        const end = start + m[2].length + m[3].length + m[4].length;
        matches.push({ start, end, panelist: p });
      }
    }

    // 2. Anrop på slutet: "..., Anna?" / "..., Anna!"
    //    Utvidgning: gå bakåt till föregående mening-slut så hela frågan
    //    inkluderas, t.ex. "Vad tycker du om det här, Anna?".
    {
      const re = new RegExp(`(,\\s*)(${name})(\\s*[?!])`, "gu");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const matchEnd = m.index + m[0].length;
        // Sök bakåt från m.index efter senaste mening-slut (.!?…) följt av space
        let sentStart = 0;
        const before = text.slice(0, m.index);
        const sentBreak = before.match(/[.!?…]\s+(?=\S)(?=[^]*$)/);
        if (sentBreak && sentBreak.index !== undefined) {
          sentStart = sentBreak.index + sentBreak[0].length;
        }
        // Säkerhetsspärr: max 300 tecken bakåt
        if (m.index - sentStart > 300) sentStart = m.index;
        matches.push({
          start: sentStart,
          end: matchEnd,
          panelist: p,
        });
      }
    }

    // 3. Överlämning: "...går vi över till Anna." / "Anna, din tur."
    {
      // 3a. Handoff-fras → markera bara namnet
      for (const handoff of HANDOFF_RES) {
        const re = new RegExp(handoff.source + name + `\\b`, "giu");
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          // Hitta exakt position för namnet inom matchen
          const nameIdx = m.index + m[0].length - p.name.length;
          matches.push({
            start: nameIdx,
            end: nameIdx + p.name.length,
            panelist: p,
          });
        }
      }

      // 3b. "Namn, kort uppmaning" — bara namnet
      const re = new RegExp(
        `(^|[.!?…]\\s+)(${name})(\\s*[,—–\\-]\\s+\\S{1,40}[.!?]\\s*$)`,
        "gum",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const nameStart = m.index + m[1].length;
        matches.push({
          start: nameStart,
          end: nameStart + p.name.length,
          panelist: p,
        });
      }
    }
  }

  // Sortera och ta bort överlappande (behåll längsta först)
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const result: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      result.push(m);
      lastEnd = m.end;
    }
  }
  return result;
}

/**
 * Wrappar tilltal/frågor till panelister i <span data-question-to>.
 * Operatar på text-noder inuti html, bevarar inline-markup utanför.
 *
 * Strategi: parsa HTML, walka text-noder, för varje text-nod hitta matches
 * och splitta noden i (text, span, text, span, ...).
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
    const matches = findMatches(text, panelists);
    if (matches.length === 0) continue;

    // Bygg ett fragment med text + spans
    const frag = doc.createDocumentFragment();
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) {
        frag.appendChild(doc.createTextNode(text.slice(cursor, m.start)));
      }
      const span = makeQuestionSpan(doc, m.panelist, text.slice(m.start, m.end));
      frag.appendChild(span);
      cursor = m.end;
    }
    if (cursor < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(cursor)));
    }
    tn.parentNode?.replaceChild(frag, tn);
  }

  return root.innerHTML;
}

function makeQuestionSpan(
  doc: Document,
  panelist: KnownPanelist,
  textContent: string,
): HTMLSpanElement {
  const span = doc.createElement("span");
  span.setAttribute("data-question-to", panelist.tempId);
  span.setAttribute("data-question-name", panelist.name);
  // En enda färg-källa: data-panelist-color (samma som PanelistMark använder)
  span.setAttribute("data-panelist-color", panelist.color);
  // Inline-style som CSS kan plocka upp via custom properties
  span.setAttribute("style", buildQuestionStyle(panelist.color));
  span.className = "question-to-mark";
  span.textContent = textContent;
  return span;
}

function buildQuestionStyle(color: string): string {
  const fg = hexToDarkText(color);
  const bg = hexToRgba(color, 0.18);
  const accent = hexToRgba(color, 0.7);
  return `--question-fg: ${fg}; --question-bg: ${bg}; --question-accent: ${accent};`;
}

function buildPanelistStyle(color: string): string {
  const bg = hexToRgba(color, 0.32);
  const fg = hexToDarkText(color);
  return `background-color: ${bg}; color: ${fg}; --panelist-bg: ${bg}; --panelist-fg: ${fg}; border-radius: 10px; padding: 2px 8px; position: relative; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
}

/**
 * Uppdaterar färgen på alla redan-annoterade question-spans i en HTML-sträng.
 * Används när användaren ändrar en panelistens färg i SpeakerMappingPanel.
 *
 * @param html - kort-HTML
 * @param colorByTempId - map från tempId/panelistId → ny hex-färg
 */
export function recolorQuestionsInHtml(
  html: string,
  colorByTempId: Map<string, string>,
): string {
  if (colorByTempId.size === 0 || typeof document === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return html;

  let changed = false;
  const spans = root.querySelectorAll("span[data-question-to], span[data-panelist-id]");
  spans.forEach((el) => {
    const tempId =
      el.getAttribute("data-question-to") || el.getAttribute("data-panelist-id");
    if (!tempId) return;
    const newColor = colorByTempId.get(tempId);
    if (!newColor) return;
    const currentColor = el.getAttribute("data-panelist-color");
    if (currentColor === newColor) return;
    el.setAttribute("data-panelist-color", newColor);

    if (el.hasAttribute("data-question-to")) {
      el.setAttribute("style", buildQuestionStyle(newColor));
    } else {
      el.setAttribute("style", buildPanelistStyle(newColor));
    }
    changed = true;
  });

  return changed ? root.innerHTML : html;
}

// Bakåtkompatibel typ-export
export type { ParsedBlock };
