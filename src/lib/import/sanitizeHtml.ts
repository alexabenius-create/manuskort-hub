// Sanering av HTML från mammoth/txt så den matchar editorns extensions exakt:
// StarterKit (utan heading/codeBlock/blockquote/horizontalRule),
// Underline, Highlight, Link, PanelistMark, PauseMarkNode.
//
// Tillåtna taggar: p, strong, em, u, s, mark, a (href), br, ul, ol, li,
// span[data-panelist-id|data-panelist-color|data-panelist-name].
//
// H1/H2/H3 hanteras av kallande kod via "headingMode":
//   - "title": rubriker plockas ut till kort-titel (görs i splitByHeadings),
//              här konverteras kvarvarande H3 → <p><strong>...</strong></p>.
//   - "strong": ALLA rubriker konverteras till <p><strong>...</strong></p>.

export type HeadingMode = "title" | "strong";

const ALLOWED_INLINE = new Set(["STRONG", "B", "EM", "I", "U", "S", "MARK", "A", "BR", "SPAN"]);
const ALLOWED_BLOCK = new Set(["P", "UL", "OL", "LI"]);

function isYellowHighlight(style: string): boolean {
  const s = style.toLowerCase();
  return /background(-color)?\s*:\s*(yellow|#ff[ef]|rgb\(\s*255\s*,\s*255\s*,\s*0)/.test(s);
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function convertHeadingToStrong(doc: Document, h: Element) {
  const p = doc.createElement("p");
  const strong = doc.createElement("strong");
  while (h.firstChild) strong.appendChild(h.firstChild);
  p.appendChild(strong);
  h.replaceWith(p);
}

/**
 * Sanera en HTML-sträng till editor-kompatibel HTML.
 * Talar-spans (med tempId) lämnas intakta om de redan har data-panelist-id.
 */
export function sanitizeHtml(rawHtml: string, headingMode: HeadingMode = "strong"): string {
  if (!rawHtml || !rawHtml.trim()) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${rawHtml}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";

  // 1) Hantera rubriker först
  if (headingMode === "strong") {
    Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).forEach((h) =>
      convertHeadingToStrong(doc, h)
    );
  } else {
    // "title": H1/H2 ska redan ha plockats ut av splitByHeadings.
    // Eventuellt kvarvarande H3+ blir strong i brödtext.
    Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).forEach((h) =>
      convertHeadingToStrong(doc, h)
    );
  }

  // 2) Konvertera Word-style highlight (background-color: yellow) → <mark>
  Array.from(root.querySelectorAll("span[style], font[style]")).forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (isYellowHighlight(style)) {
      const mark = doc.createElement("mark");
      while (el.firstChild) mark.appendChild(el.firstChild);
      el.replaceWith(mark);
    }
  });

  // 3) Walk noder och rensa allt utanför whitelist.
  // OBS: anropa ALDRIG walk på root-elementet självt — bara på dess barn.
  const walk = (node: Element) => {
    // Iterera kopia av barn — vi kan modifiera under iteration
    const children = Array.from(node.children);
    for (const child of children) {
      walk(child);
    }

    const tag = node.tagName;

    // Tillåtna inline/block — behåll men strippa alla attribut utom whitelistade
    if (ALLOWED_INLINE.has(tag) || ALLOWED_BLOCK.has(tag)) {
      // Normalisera B → STRONG, I → EM
      if (tag === "B") {
        const s = doc.createElement("strong");
        while (node.firstChild) s.appendChild(node.firstChild);
        node.replaceWith(s);
        return;
      }
      if (tag === "I") {
        const e = doc.createElement("em");
        while (node.firstChild) e.appendChild(node.firstChild);
        node.replaceWith(e);
        return;
      }

      // Attribut-vit-lista
      const attrs = Array.from(node.attributes).map((a) => a.name);
      for (const name of attrs) {
        if (tag === "A" && name === "href") {
          // Validera URL-schema: tillåt endast http(s), mailto, ankare och relativa länkar.
          // Blockerar javascript:, data:, vbscript: m.fl. för att förhindra self-XSS.
          const href = node.getAttribute("href") || "";
          if (!/^(https?:\/\/|mailto:|#|\/)/i.test(href.trim())) {
            node.removeAttribute("href");
          }
          continue;
        }
        if (
          tag === "SPAN" &&
          (name === "data-panelist-id" ||
            name === "data-panelist-color" ||
            name === "data-panelist-name" ||
            name === "data-question-to" ||
            name === "data-question-name" ||
            name === "style")
        ) {
          // Behåll panelist/question-attribut; style hanteras nedan (vi tar bort om inte specialspan)
          if (
            name === "style" &&
            !node.hasAttribute("data-panelist-id") &&
            !node.hasAttribute("data-question-to")
          ) {
            node.removeAttribute("style");
          }
          continue;
        }
        node.removeAttribute(name);
      }

      // Tom span utan panelist/question-id → unwrappa
      if (
        tag === "SPAN" &&
        !node.hasAttribute("data-panelist-id") &&
        !node.hasAttribute("data-question-to")
      ) {
        unwrap(node);
      }
      return;
    }

    // Okänd tagg — unwrappa (behåll innehåll men kasta wrappern)
    unwrap(node);
  };

  // Kör walk på rotens barn — INTE på root själv (annars skulle root unwrappas och bli borta)
  Array.from(root.children).forEach((child) => walk(child));

  // 4) Säkerställ att top-level text wrappas i <p>
  const out = doc.createElement("div");
  let currentP: HTMLParagraphElement | null = null;
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent || "").trim();
      if (!text) continue;
      if (!currentP) {
        currentP = doc.createElement("p");
        out.appendChild(currentP);
      }
      currentP.appendChild(child.cloneNode(true));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (ALLOWED_BLOCK.has(el.tagName)) {
        currentP = null;
        out.appendChild(child.cloneNode(true));
      } else {
        if (!currentP) {
          currentP = doc.createElement("p");
          out.appendChild(currentP);
        }
        currentP.appendChild(child.cloneNode(true));
      }
    }
  }

  return out.innerHTML.trim();
}
