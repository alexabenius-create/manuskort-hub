// Parsar .docx via mammoth eller .txt direkt → ParsedBlock[].
// Räknar även bortskalat innehåll (bilder, tabeller, fotnoter).

import mammoth from "mammoth";

export type ParsedBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string; html: string }
  | { type: "paragraph"; html: string; plainText: string }
  | { type: "list"; ordered: boolean; itemsHtml: string[] };

export interface ParseResult {
  blocks: ParsedBlock[];
  title: string | null; // ev. första H1
  skipped: { images: number; tables: number; footnotes: number };
}

export type FileKind = "docx" | "txt" | "doc" | "unsupported";

export function detectFileKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".doc")) return "doc";
  // Fallback på MIME om extension saknas
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime === "text/plain") return "txt";
  if (mime === "application/msword") return "doc";
  return "unsupported";
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

function htmlToParsedBlocks(html: string): ParsedBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return [];

  const blocks: ParsedBlock[] = [];
  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent || "").trim();
    if (!text && tag !== "ul" && tag !== "ol") continue;

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text, html: node.innerHTML });
      continue;
    }
    if (tag === "p") {
      blocks.push({ type: "paragraph", html: node.outerHTML, plainText: text });
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.querySelectorAll(":scope > li")).map(
        (li) => li.innerHTML
      );
      if (items.length) {
        blocks.push({ type: "list", ordered: tag === "ol", itemsHtml: items });
      }
      continue;
    }
    // Övriga okända block — behandla som paragraf
    if (text) {
      blocks.push({
        type: "paragraph",
        html: `<p>${node.innerHTML}</p>`,
        plainText: text,
      });
    }
  }

  return blocks;
}

export async function parseDocxFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const html = result.value || "";
  const messages = result.messages || [];

  // Räkna bortskalat — mammoth skickar en "warning" per ignorerad bild/tabell
  const skipped = { images: 0, tables: 0, footnotes: 0 };
  for (const m of messages) {
    const msg = (m.message || "").toLowerCase();
    if (msg.includes("image") || msg.includes("picture")) skipped.images += 1;
    else if (msg.includes("table")) skipped.tables += 1;
    else if (msg.includes("footnote") || msg.includes("endnote")) skipped.footnotes += 1;
  }

  // Räkna bilder via HTML också (mammoth ger ibland <img> kvar)
  const imgMatches = html.match(/<img\b/gi);
  if (imgMatches) skipped.images = Math.max(skipped.images, imgMatches.length);
  const tableMatches = html.match(/<table\b/gi);
  if (tableMatches) skipped.tables = Math.max(skipped.tables, tableMatches.length);

  const blocks = htmlToParsedBlocks(html);

  let title: string | null = null;
  const firstH1 = blocks.find((b) => b.type === "heading" && b.level === 1);
  if (firstH1 && firstH1.type === "heading") title = firstH1.text;

  return { blocks, title, skipped };
}

export async function parseTxtFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\r?\n/g, " ").trim())
    .filter(Boolean);

  const blocks: ParsedBlock[] = paragraphs.map((p) => ({
    type: "paragraph" as const,
    html: `<p>${escapeHtml(p)}</p>`,
    plainText: p,
  }));

  return { blocks, title: null, skipped: { images: 0, tables: 0, footnotes: 0 } };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function parseFile(file: File): Promise<ParseResult> {
  const kind = detectFileKind(file);
  if (kind === "docx") return parseDocxFile(file);
  if (kind === "txt") return parseTxtFile(file);
  throw new Error(`Filformatet stöds inte: ${kind}`);
}
