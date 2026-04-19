import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseDocxFile } from "@/lib/import/parseDocument";
import { detectSpeakers } from "@/lib/import/detectSpeakers";
import { buildCards } from "@/lib/import/buildCards";

describe("Import end-to-end (test-paneldebatt.docx)", () => {
  it("parses docx, detects speakers, lists skipped content, and builds cards", async () => {
    const buf = readFileSync(resolve(__dirname, "../../test/test-paneldebatt.docx"));
    // Skapa en File-liknande wrapper (vitest jsdom har File-stöd)
    const file = new File([buf as unknown as BlobPart], "test-paneldebatt.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await parseDocxFile(file);

    // 1. Skipped content: bilder OCH tabeller ska upptäckas
    console.log("Skipped:", result.skipped);
    console.log("Skipped items:", result.skippedItems);
    expect(result.skipped.images).toBeGreaterThanOrEqual(1);
    expect(result.skipped.tables).toBe(1);
    // Tabellen ska placeras under "Statistik"-sektionen
    const table = result.skippedItems.find((i) => i.kind === "table");
    expect(table?.section).toBe("Statistik");
    expect(table?.description).toMatch(/Tabell 3×2/);

    // 2. Talar-detektering: alla tre namnformat ska fångas
    const det = detectSpeakers(result.blocks);
    console.log("Detected speakers:", det.names);
    expect(det.names).toContain("Anna");
    expect(det.names).toContain("Bengt");
    expect(det.names).toContain("Carl");

    // 3. Build cards via wordcount-strategi och verifiera att kort produceras
    const tempIds = new Map<string, string>();
    const cards = buildCards({
      blocks: result.blocks,
      strategy: "wordcount",
      wordsPerCard: 80,
      textSize: "md",
      speakerTempIds: tempIds,
    });
    console.log(
      "Cards:",
      cards.map((c) => ({ title: c.title, speaker: c.speakerName, wc: c.wordCount }))
    );
    expect(cards.length).toBeGreaterThan(0);
    // Minst ett kort ska ha en talare
    expect(cards.some((c) => c.speakerName)).toBe(true);
  });
});
