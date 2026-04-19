import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { PAUSE_STYLE } from "./cueStyles";
import { hexToRgba } from "@/lib/panelistColors";

interface RenderOpts {
  fontSize: number;
  lineHeight?: number;
}

/**
 * Konverterar manustextens HTML (från Tiptap) till @react-pdf/renderer-noder.
 * Hanterar: <p>, <strong>, <em>, <br>, <span class="pause-mark">,
 * <span data-panelist-id="..." data-panelist-color="...">.
 *
 * Allt block-innehåll renderas som <Text> (PDF:ens enda textcontainer).
 */
export function renderHtmlToPdf(html: string, opts: RenderOpts): JSX.Element[] {
  if (!html || !html.trim()) return [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  } catch {
    return [<Text key="raw">{html.replace(/<[^>]+>/g, "")}</Text>];
  }
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return [];

  const blocks: JSX.Element[] = [];
  let key = 0;

  const walkBlock = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim()) {
        blocks.push(
          <Text key={`b${key++}`} style={paragraphStyle(opts)}>
            {renderInline(node, opts)}
          </Text>,
        );
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "p" || tag === "div") {
      const children = renderInline(el, opts);
      blocks.push(
        <Text key={`b${key++}`} style={paragraphStyle(opts)}>
          {children.length > 0 ? children : " "}
        </Text>,
      );
      return;
    }
    if (tag === "ul" || tag === "ol") {
      let i = 1;
      Array.from(el.children).forEach((li) => {
        const bullet = tag === "ol" ? `${i++}. ` : "•  ";
        blocks.push(
          <Text key={`b${key++}`} style={paragraphStyle(opts)}>
            {bullet}
            {renderInline(li, opts)}
          </Text>,
        );
      });
      return;
    }
    if (tag === "br") {
      blocks.push(<Text key={`b${key++}`} style={paragraphStyle(opts)}> </Text>);
      return;
    }
    // Fallback: traversera barn
    Array.from(el.childNodes).forEach(walkBlock);
  };

  Array.from(root.childNodes).forEach(walkBlock);
  return blocks;
}

function paragraphStyle(opts: RenderOpts): Style {
  return {
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight ?? 1.45,
    marginBottom: opts.fontSize * 0.35,
    color: "#111111",
  };
}

/**
 * Renderar inline-innehåll (text + spans + marks) inuti en <Text>.
 * Returnerar en array av <Text> (nested) och strängar.
 */
function renderInline(node: Node, opts: RenderOpts): (JSX.Element | string)[] {
  const out: (JSX.Element | string)[] = [];
  let key = 0;

  const walk = (n: Node, inherited: Style) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent ?? "";
      if (t) out.push(<Text key={`i${key++}`} style={inherited}>{t}</Text>);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      out.push(<Text key={`i${key++}`}>{"\n"}</Text>);
      return;
    }

    // Pause mark — atomic chip
    if (tag === "span" && el.classList.contains("pause-mark")) {
      out.push(
        <Text
          key={`i${key++}`}
          style={{
            backgroundColor: PAUSE_STYLE.bg,
            color: PAUSE_STYLE.text,
            fontFamily: "Helvetica-Bold",
            fontSize: opts.fontSize * 0.85,
            paddingLeft: 4,
            paddingRight: 4,
            borderRadius: 3,
          }}
        >
          {" "}paus{" "}
        </Text>,
      );
      return;
    }

    // Panelist mark
    if (tag === "span" && el.hasAttribute("data-panelist-id")) {
      const color = el.getAttribute("data-panelist-color") || "#999999";
      const bg = hexToRgba(color, 0.32);
      const childStyle: Style = {
        ...inherited,
        backgroundColor: bg,
        color: "#1a1a1a",
        paddingLeft: 3,
        paddingRight: 3,
        borderRadius: 3,
      };
      Array.from(el.childNodes).forEach((c) => walk(c, childStyle));
      return;
    }

    let next: Style = inherited;
    if (tag === "strong" || tag === "b") {
      next = { ...next, fontFamily: "Helvetica-Bold" };
    } else if (tag === "em" || tag === "i") {
      next = { ...next, fontFamily: "Helvetica-Oblique" };
    } else if (tag === "u") {
      next = { ...next, textDecoration: "underline" };
    }
    Array.from(el.childNodes).forEach((c) => walk(c, next));
  };

  Array.from(node.childNodes).forEach((c) => walk(c, {}));
  return out;
}

/**
 * Approximerar antal "rader" som HTML-innehåll tar i en kolumn av given
 * bredd vid given fontSize. Används av usePrintLayout för shrink-to-fit.
 *
 * Heuristik: tecken / (kolumnbredd_pt / (fontSize * 0.5)) per stycke,
 * ceiling per stycke, summera. Inte exakt — men tillräckligt nära för
 * att välja en gemensam fontSize.
 */
export function estimateLines(html: string, columnWidthPt: number, fontSize: number): number {
  if (!html) return 0;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const charsPerLine = Math.max(1, Math.floor(columnWidthPt / (fontSize * 0.48)));
  const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return 0;
  let lines = 0;
  for (const p of paragraphs) {
    lines += Math.max(1, Math.ceil(p.length / charsPerLine));
  }
  return lines;
}
