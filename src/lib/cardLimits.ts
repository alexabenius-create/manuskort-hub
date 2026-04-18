// Max antal visuella rader per kort beroende på textstorlek.
// Optimerat för A5 liggande + framtida visningsläge på iPad/desktop.
export const MAX_ROWS_BY_SIZE = { sm: 10, md: 8, lg: 6 } as const;
export type TextSize = keyof typeof MAX_ROWS_BY_SIZE;

/**
 * Presentationslägets typografi per textstorlek — speglar PresentationCard.
 * Vi mäter alltid mot dessa värden, oavsett editorns visuella bredd, så
 * "X/8 rader" i editorn alltid stämmer med antal rader i presentationsläget.
 *
 * Bredd: 60ch i font-display vid given fontSize. ch ≈ 0.5em för proportionella
 * fonter — vi använder 0.52 som rimligt medel för Inter Tight.
 */
const PRESENTATION_GEOMETRY = {
  sm: { fontSize: 24, lineHeight: 1.7, widthPx: Math.round(60 * 24 * 0.52) },
  md: { fontSize: 30, lineHeight: 1.7, widthPx: Math.round(60 * 30 * 0.52) },
  lg: { fontSize: 38, lineHeight: 1.7, widthPx: Math.round(60 * 38 * 0.52) },
} as const;

let presentationMeasurer: HTMLDivElement | null = null;
function getPresentationMeasurer(textSize: TextSize): HTMLDivElement {
  const g = PRESENTATION_GEOMETRY[textSize];
  if (!presentationMeasurer) {
    const el = document.createElement("div");
    el.setAttribute("data-presentation-measurer", "true");
    el.className = "presentation-prose font-display";
    el.style.position = "fixed";
    el.style.left = "-99999px";
    el.style.top = "0";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.boxSizing = "content-box";
    el.style.padding = "0";
    el.style.margin = "0";
    document.body.appendChild(el);
    presentationMeasurer = el;
  }
  presentationMeasurer.style.width = `${g.widthPx}px`;
  presentationMeasurer.style.fontSize = `${g.fontSize}px`;
  presentationMeasurer.style.lineHeight = String(g.lineHeight);
  return presentationMeasurer;
}

/**
 * Mäter hur många rader `html` skulle bli i presentationsläget.
 * Detta är den enda korrekta källan för radantal — editorns egen DOM
 * har annan bredd/font och ger fel resultat.
 */
export function countPresentationRows(html: string, textSize: TextSize): number {
  const el = getPresentationMeasurer(textSize);
  el.innerHTML = html || "<p></p>";
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!lh || !isFinite(lh) || lh <= 0) return 0;
  return Math.max(1, Math.round(el.scrollHeight / lh));
}

/**
 * Räknar antal visuella rader (inklusive mjuk wrappning) i ett element.
 * Mäter scrollHeight / line-height på roten.
 *
 * OBS: Detta mäter ELEMENTETS egen geometri — för korrekt radantal mot
 * presentationsläget, använd `countPresentationRows` istället.
 */
export function countVisualRows(el: HTMLElement): number {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!lh || !isFinite(lh) || lh <= 0) return 0;
  return Math.max(1, Math.round(el.scrollHeight / lh));
}

/**
 * Skapar en dold mät-div som efterliknar sampleEl exakt — samma klassnamn,
 * samma föräldra-bredd och samma typografi. På det sättet matchar wrappningen
 * det användaren faktiskt ser i editorn (CSS-regler för .ProseMirror p osv.
 * appliceras korrekt).
 */
function createMeasurer(sampleEl: HTMLElement): { el: HTMLDivElement; cleanup: () => void } {
  const width = sampleEl.clientWidth || sampleEl.getBoundingClientRect().width || 600;

  // Wrappa mät-elementet i en container med exakt samma bredd, så att inre
  // CSS-regler (font-size, line-height, padding) räknas på samma sätt.
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-99999px";
  wrapper.style.top = "0";
  wrapper.style.visibility = "hidden";
  wrapper.style.pointerEvents = "none";
  wrapper.style.width = `${width}px`;
  wrapper.style.boxSizing = "border-box";

  // Klona sampleEl-noden (utan innehåll) — så vi får samma klasser och stilar.
  const clone = sampleEl.cloneNode(false) as HTMLDivElement;
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("id");
  clone.style.width = "100%";
  clone.style.minHeight = "0";
  clone.style.height = "auto";
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  clone.innerHTML = "";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return { el: clone, cleanup: () => wrapper.remove() };
}


/**
 * Splitta HTML exakt vid maxRows visuella rader, mätt mot sampleEl.
 * Returnerar [fitsHtml, overflowHtml]. Om allt får plats: [html, ""].
 *
 * Strategi:
 *  1. Bygg upp innehållet block för block tills vi överskrider maxRows.
 *  2. Inom det överskridande blocket: splitta vid meningsslut → mellanslag → tecken.
 *  3. Föredra blockgräns om vi redan ligger nära maxRows (±0 rader marginal).
 */
export function splitHtmlAtRow(
  html: string,
  maxRows: number,
  textSize: TextSize,
): [string, string] {
  if (!html || !html.trim()) return [html, ""];

  const measurer = getPresentationMeasurer(textSize);
  // Kontrollera först om allt får plats
  measurer.innerHTML = html;
  if (countVisualRows(measurer) <= maxRows) {
    return [html, ""];
  }
  // Wrapper try/finally inte längre nödvändig — measurer återanvänds globalt.
  {

    // Parsa HTML till en lista av blockelement
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const blocks = Array.from(tmp.children) as HTMLElement[];

    // Om det inte finns några block (ren text), wrappa i <p>
    if (blocks.length === 0) {
      const p = document.createElement("p");
      p.innerHTML = html;
      blocks.push(p);
    }

    // Steg 1: lägg till block tills vi överskrider
    const fitBlocks: HTMLElement[] = [];
    let overflowBlockIdx = -1;

    for (let i = 0; i < blocks.length; i++) {
      const candidate = [...fitBlocks, blocks[i]];
      measurer.innerHTML = candidate.map((b) => b.outerHTML).join("");
      const rows = countVisualRows(measurer);
      if (rows <= maxRows) {
        fitBlocks.push(blocks[i]);
      } else {
        overflowBlockIdx = i;
        break;
      }
    }

    // Om alla block fick plats men ändå för många rader → fallback: ta bort sista
    if (overflowBlockIdx === -1) {
      // Bör inte hända (vi vet att html överskrider), men säkerhetsnät
      if (fitBlocks.length > 1) {
        const removed = fitBlocks.pop()!;
        const fitsHtml = fitBlocks.map((b) => b.outerHTML).join("");
        const overflowHtml = [removed, ...blocks.slice(blocks.length)].map((b) => b.outerHTML).join("");
        return [fitsHtml, trimEmptyBlocksHtml(overflowHtml)];
      }
      // Enda blocket — gå till ord-split nedan
      overflowBlockIdx = 0;
      fitBlocks.length = 0;
    }

    const overflowBlock = blocks[overflowBlockIdx];
    const remainingBlocks = blocks.slice(overflowBlockIdx + 1);

    // Steg 2: splitta inuti overflowBlock vid ord/meningsgräns
    const tagName = overflowBlock.tagName.toLowerCase();
    // Använd textContent för stabil ordvis splitting (tappar inline-formatering, men håller flödet)
    const fullText = overflowBlock.textContent ?? "";
    const words = fullText.split(/(\s+)/); // behåll mellanslag

    let lo = 0;
    let hi = words.length;
    let bestFit = 0;

    // Binärsökning: hitta största prefix av words som ryms tillsammans med fitBlocks
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const partialText = words.slice(0, mid).join("");
      const partialBlock = partialText
        ? `<${tagName}>${escapeHtml(partialText)}</${tagName}>`
        : "";
      const trial = [
        ...fitBlocks.map((b) => b.outerHTML),
        partialBlock,
      ].filter(Boolean).join("");
      measurer.innerHTML = trial || "<p></p>";
      const rows = countVisualRows(measurer);
      if (rows <= maxRows) {
        bestFit = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    let firstText = words.slice(0, bestFit).join("");
    let secondText = words.slice(bestFit).join("");

    // Justera till närmaste meningsslut bakåt (inom 25% av första delen)
    if (firstText && secondText) {
      const minKeep = Math.floor(firstText.length * 0.75);
      const sentenceMatch = /[.!?…][\s)"'»]*$/;
      // Sök bakåt efter meningsslut
      let cut = firstText.length;
      const re = /[.!?…][\s)"'»]*\s+/g;
      let m: RegExpExecArray | null;
      let lastValid = -1;
      while ((m = re.exec(firstText)) !== null) {
        const end = m.index + m[0].length;
        if (end >= minKeep) lastValid = end;
      }
      if (lastValid > 0 && !sentenceMatch.test(firstText)) {
        const moved = firstText.slice(lastValid);
        firstText = firstText.slice(0, lastValid);
        secondText = moved + secondText;
      }
    }

    firstText = firstText.replace(/\s+$/, "");
    secondText = secondText.replace(/^\s+/, "");

    const fitsParts: string[] = fitBlocks.map((b) => b.outerHTML);
    if (firstText) fitsParts.push(`<${tagName}>${escapeHtml(firstText)}</${tagName}>`);

    const overflowParts: string[] = [];
    if (secondText) overflowParts.push(`<${tagName}>${escapeHtml(secondText)}</${tagName}>`);
    overflowParts.push(...remainingBlocks.map((b) => b.outerHTML));

    const fitsHtml = fitsParts.join("");
    const overflowHtml = overflowParts.join("");

    // Säkerhetsnät: om vi inte fick någon överflödig text alls (allt blev tomt),
    // returnera originalet (ingen meningsfull split möjlig).
    if (!overflowHtml.trim()) return [html, ""];
    if (!fitsHtml.trim()) {
      // Föredra att ändå splitta — lägg första ordet i fits
      const firstWord = words[0] ?? "";
      const rest = words.slice(1).join("");
      return [
        `<${tagName}>${escapeHtml(firstWord)}</${tagName}>`,
        trimEmptyBlocksHtml(`<${tagName}>${escapeHtml(rest)}</${tagName}>` + remainingBlocks.map((b) => b.outerHTML).join("")),
      ];
    }

    return [fitsHtml, trimEmptyBlocksHtml(overflowHtml)];
  }
}

/**
 * Delar HTML i två ungefär lika stora delar vid närmaste blockgräns
 * (paragraf eller mening). Returnerar [förstahalva, andrahalva].
 * Om innehållet inte går att dela meningsfullt: returnera [hela, ""].
 *
 * Behålls som fallback om ingen sample-DOM är tillgänglig.
 */
export function splitHtmlInHalf(html: string): [string, string] {
  if (!html || !html.trim()) return [html, ""];

  const container = document.createElement("div");
  container.innerHTML = html;

  const blocks = Array.from(container.children) as HTMLElement[];

  if (blocks.length >= 2) {
    const lengths = blocks.map((b) => (b.textContent ?? "").length);
    const total = lengths.reduce((a, b) => a + b, 0);
    let acc = 0;
    let splitAt = 1;
    for (let i = 0; i < blocks.length; i++) {
      acc += lengths[i];
      if (acc >= total / 2) { splitAt = i + 1; break; }
    }
    splitAt = Math.max(1, Math.min(blocks.length - 1, splitAt));
    const first = blocks.slice(0, splitAt).map((b) => b.outerHTML).join("");
    const second = blocks.slice(splitAt).map((b) => b.outerHTML).join("");
    return [first, trimEmptyBlocksHtml(second)];
  }

  const block = blocks[0] ?? container;
  const text = block.textContent ?? "";
  if (text.length < 40) return [html, ""];

  const mid = Math.floor(text.length / 2);
  const sentenceEnds: number[] = [];
  const re = /[.!?…]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    sentenceEnds.push(m.index + m[0].length);
  }
  let splitChar = mid;
  if (sentenceEnds.length > 0) {
    splitChar = sentenceEnds.reduce((best, p) =>
      Math.abs(p - mid) < Math.abs(best - mid) ? p : best
    , sentenceEnds[0]);
  } else {
    const space = text.lastIndexOf(" ", mid);
    if (space > 0) splitChar = space + 1;
  }

  const tag = block.tagName.toLowerCase();
  const firstText = text.slice(0, splitChar).trimEnd();
  const secondText = text.slice(splitChar).trimStart();
  if (!secondText) return [html, ""];
  return [`<${tag}>${escapeHtml(firstText)}</${tag}>`, trimEmptyBlocksHtml(`<${tag}>${escapeHtml(secondText)}</${tag}>`)];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Tar bort tomma block (<p></p>, <p><br></p>, <p>&nbsp;</p>, whitespace-only)
 * från BÖRJAN av en HTML-sträng. Bevarar tomma rader i mitten och slutet.
 */
export function trimEmptyBlocksHtml(html: string): string {
  if (!html || !html.trim()) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  while (container.firstElementChild) {
    const el = container.firstElementChild as HTMLElement;
    const text = (el.textContent ?? "").replace(/\u00a0/g, "").trim();
    // Tomt om ingen text och inga meningsfulla barnnoder (bara <br> räknas som tomt)
    const onlyBr = Array.from(el.children).every((c) => c.tagName === "BR");
    if (text === "" && (el.children.length === 0 || onlyBr)) {
      el.remove();
    } else {
      break;
    }
  }
  return container.innerHTML;
}
