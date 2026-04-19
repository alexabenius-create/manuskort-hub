import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import mammoth from "mammoth";
import { detectSpeakers } from "@/lib/import/detectSpeakers";
import { buildCards } from "@/lib/import/buildCards";
import type { ParsedBlock, SkippedItem } from "@/lib/import/parseDocument";

// Återimplementerar parseDocxFile-logiken här men matar mammoth med {buffer}
// (Node-vänlig variant). I browsern används {arrayBuffer} via File.
async function parseBuf(buf: Buffer) {
  const result = await mammoth.convertToHtml({ buffer: buf });
  const html = result.value || "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r")!;

  const blocks: ParsedBlock[] = [];
  const skippedItems: SkippedItem[] = [];
  let currentSection = "Början av dokumentet";

  const collect = (container: Element) => {
    container.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt") || "";
      const src = img.getAttribute("src") || "";
      let format = "";
      if (src.startsWith("data:image/")) {
        const m = src.match(/^data:image\/([a-z0-9+]+)/i);
        if (m) format = m[1].toUpperCase();
      }
      const desc = alt
        ? `Bild: "${alt}"${format ? ` (${format})` : ""}`
        : `Bild${format ? ` (${format})` : ""}`;
      skippedItems.push({ kind: "image", section: currentSection, description: desc });
    });
    container.querySelectorAll("table").forEach((table) => {
      const rows = table.querySelectorAll("tr").length;
      const cols = table.querySelector("tr")?.querySelectorAll("td, th").length || 0;
      const firstCell = (table.querySelector("td, th")?.textContent || "").trim().slice(0, 40);
      skippedItems.push({
        kind: "table",
        section: currentSection,
        description: `Tabell ${rows}×${cols}${firstCell ? ` — "${firstCell}…"` : ""}`,
      });
    });
  };

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent || "").trim();
    collect(node);
    if (!text && tag !== "ul" && tag !== "ol" && tag !== "table") continue;
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
      currentSection = text || currentSection;
      blocks.push({ type: "heading", level, text, html: node.innerHTML });
    } else if (tag === "p") {
      blocks.push({ type: "paragraph", html: node.outerHTML, plainText: text });
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.querySelectorAll(":scope > li")).map((li) => li.innerHTML);
      if (items.length) blocks.push({ type: "list", ordered: tag === "ol", itemsHtml: items });
    } else if (tag !== "table" && text) {
      blocks.push({ type: "paragraph", html: `<p>${node.innerHTML}</p>`, plainText: text });
    }
  }

  return { blocks, skippedItems };
}

describe("Import end-to-end (test-paneldebatt.docx)", () => {
  it("parses docx, detects speakers, lists skipped content, and builds cards", async () => {
    const buf = readFileSync(resolve(__dirname, "../../test/test-paneldebatt.docx"));
    const { blocks, skippedItems } = await parseBuf(buf);

    console.log("Skipped items:");
    for (const item of skippedItems) {
      console.log(`  [${item.kind}] (${item.section}) ${item.description}`);
    }

    // 1. Skipped content: bild OCH tabell ska upptäckas, korrekt sektion
    const tableItem = skippedItems.find((i) => i.kind === "table");
    expect(tableItem).toBeDefined();
    expect(tableItem!.section).toBe("Statistik");
    expect(tableItem!.description).toMatch(/Tabell 3×2/);

    const imageItem = skippedItems.find((i) => i.kind === "image");
    expect(imageItem).toBeDefined();
    // Bilden ligger efter "Inledning" i dokumentet
    expect(imageItem!.section).toBe("Inledning");

    // 2. Talar-detektering: alla tre namnformat ska fångas
    const det = detectSpeakers(blocks);
    console.log("Detected speakers:", det.names);
    console.log("Speaker block map:");
    for (const [idx, info] of det.blockSpeaker.entries()) {
      console.log(`  block ${idx}: ${info.name} → "${info.restText.slice(0, 50)}"`);
    }
    expect(det.names).toContain("Anna");
    expect(det.names).toContain("Bengt");
    expect(det.names).toContain("Carl");

    // 3. Build cards & verifiera att talare kopplas till rätt kort
    const tempIds = new Map<string, string>();
    const cards = buildCards({
      blocks,
      strategy: "wordcount",
      wordsPerCard: 30,
      textSize: "md",
      speakerTempIds: tempIds,
    });
    console.log("Cards:");
    for (const c of cards) {
      console.log(`  - "${c.title}" speaker=${c.speakerName ?? "—"} wc=${c.wordCount}`);
    }
    expect(cards.length).toBeGreaterThan(0);
    const speakerNames = new Set(cards.map((c) => c.speakerName).filter(Boolean));
    expect(speakerNames.has("Anna")).toBe(true);
    expect(speakerNames.has("Bengt")).toBe(true);
    expect(speakerNames.has("Carl")).toBe(true);
  });
});
