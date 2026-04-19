// Parsar .docx via mammoth eller .txt direkt → ParsedBlock[].
// Räknar även bortskalat innehåll (bilder, tabeller, fotnoter) med kontext om
// var i dokumentet de fanns (närmaste rubrik/avsnitt).

import mammoth from "mammoth";

export type ParsedBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string; html: string }
  | { type: "paragraph"; html: string; plainText: string }
  | { type: "list"; ordered: boolean; itemsHtml: string[] };

export interface SkippedItem {
  kind: "image" | "table" | "footnote";
  // Närmaste föregående rubrik (eller "Inledning" om ingen)
  section: string;
  // Mänsklig beskrivning ("Tabell, 3 rader × 4 kolumner", "Bild (PNG)", "Fotnot: …")
  description: string;
}

export interface ParseResult {
  blocks: ParsedBlock[];
  title: string | null; // ev. första H1
  skipped: { images: number; tables: number; footnotes: number };
  skippedItems: SkippedItem[];
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

/**
 * Bygger ParsedBlock[] från HTML och samlar samtidigt skipped-items
 * (bilder, tabeller, fotnoter) tillsammans med närmaste föregående rubrik.
 */
function htmlToParsedBlocks(html: string): { blocks: ParsedBlock[]; skippedItems: SkippedItem[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return { blocks: [], skippedItems: [] };

  const blocks: ParsedBlock[] = [];
  const skippedItems: SkippedItem[] = [];
  let currentSection = "Början av dokumentet";

  const collectFromContainer = (container: Element) => {
    // Bilder
    container.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt") || "";
      const src = img.getAttribute("src") || "";
      let format = "";
      if (src.startsWith("data:image/")) {
        const m = src.match(/^data:image\/([a-z0-9+]+)/i);
        if (m) format = m[1].toUpperCase();
      }
      const desc = alt
        ? `Bild: "${alt.slice(0, 60)}"${format ? ` (${format})` : ""}`
        : `Bild${format ? ` (${format})` : ""}`;
      skippedItems.push({ kind: "image", section: currentSection, description: desc });
    });

    // Tabeller — inklusive containern själv om den är en table
    const tables: Element[] = Array.from(container.querySelectorAll("table"));
    if (container.tagName === "TABLE") tables.unshift(container);
    tables.forEach((table) => {
      const rows = table.querySelectorAll("tr").length;
      const firstRow = table.querySelector("tr");
      const cols = firstRow ? firstRow.querySelectorAll("td, th").length : 0;
      const firstCell = (table.querySelector("td, th")?.textContent || "")
        .trim()
        .slice(0, 40);
      const desc = `Tabell ${rows}×${cols}${firstCell ? ` — "${firstCell}…"` : ""}`;
      skippedItems.push({ kind: "table", section: currentSection, description: desc });
    });
  };

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent || "").trim();

    // Kolla efter bilder/tabeller i ALLA noder (inklusive de vi ändå behåller)
    collectFromContainer(node);

    if (!text && tag !== "ul" && tag !== "ol" && tag !== "table") continue;

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
      currentSection = text || currentSection;
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
    if (tag === "table") {
      // Hoppa — redan loggad i collectFromContainer
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

  return { blocks, skippedItems };
}

export async function parseDocxFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const html = result.value || "";
  const messages = result.messages || [];

  const skipped = { images: 0, tables: 0, footnotes: 0 };
  const skippedItems: SkippedItem[] = [];

  // Mammoth-meddelanden om fotnoter/endnotes
  for (const m of messages) {
    const msg = (m.message || "").toLowerCase();
    if (msg.includes("footnote") || msg.includes("endnote")) {
      skipped.footnotes += 1;
      skippedItems.push({
        kind: "footnote",
        section: "—",
        description: m.message || "Fotnot",
      });
    }
  }

  const { blocks, skippedItems: htmlItems } = htmlToParsedBlocks(html);
  skippedItems.push(...htmlItems);

  // Räkna från items (källa är skippedItems)
  skipped.images = skippedItems.filter((s) => s.kind === "image").length;
  skipped.tables = skippedItems.filter((s) => s.kind === "table").length;
  skipped.footnotes = skippedItems.filter((s) => s.kind === "footnote").length;

  let title: string | null = null;
  const firstH1 = blocks.find((b) => b.type === "heading" && b.level === 1);
  if (firstH1 && firstH1.type === "heading") title = firstH1.text;

  return { blocks, title, skipped, skippedItems };
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

  return {
    blocks,
    title: null,
    skipped: { images: 0, tables: 0, footnotes: 0 },
    skippedItems: [],
  };
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
