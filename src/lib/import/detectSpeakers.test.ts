import { describe, it, expect } from "vitest";
import { detectSpeakers } from "@/lib/import/detectSpeakers";
import type { ParsedBlock } from "@/lib/import/parseDocument";

const p = (text: string): ParsedBlock => ({
  type: "paragraph",
  html: `<p>${text}</p>`,
  plainText: text,
});

describe("detectSpeakers", () => {
  it("detects four speaker formats: NAMN:, em-dash, parenthetical role, name-on-own-line", () => {
    const blocks: ParsedBlock[] = [
      p("Anna: Jag tror att vi kommer se en stor förändring."),
      p("Bengt — Jag håller delvis med."),
      p("Carl (moderator): Tack båda två."),
      p("Anna: Vi måste tänka bredare."),
      p("Bengt"),
      p("Det är en bra poäng."),
      p("Carl: Tack till alla."),
    ];

    const result = detectSpeakers(blocks);

    expect(result.names).toContain("Anna");
    expect(result.names).toContain("Bengt");
    expect(result.names).toContain("Carl");

    // Block 0: Anna: ... → restText utan prefix
    expect(result.blockSpeaker.get(0)?.name).toBe("Anna");
    expect(result.blockSpeaker.get(0)?.restText).toBe(
      "Jag tror att vi kommer se en stor förändring."
    );

    // Block 1: Bengt — ...
    expect(result.blockSpeaker.get(1)?.name).toBe("Bengt");
    expect(result.blockSpeaker.get(1)?.restText).toBe("Jag håller delvis med.");

    // Block 2: Carl (moderator): ...
    expect(result.blockSpeaker.get(2)?.name).toBe("Carl");
    expect(result.blockSpeaker.get(2)?.restText).toBe("Tack båda två.");

    // Block 4 (namn på egen rad) → tom, block 5 (replik) får namnet
    expect(result.blockSpeaker.get(4)?.restText).toBe("");
    expect(result.blockSpeaker.get(5)?.name).toBe("Bengt");
    expect(result.blockSpeaker.get(5)?.restText).toBe("Det är en bra poäng.");
  });

  it("ignores stopwords like 'Och:', 'Det:'", () => {
    const blocks: ParsedBlock[] = [
      p("Och: detta är inte en talare."),
      p("Det: ska inte heller räknas."),
      p("Men: nej."),
    ];
    const result = detectSpeakers(blocks);
    expect(result.names).toEqual([]);
  });

  it("returns empty when threshold not met (< 2 unique names)", () => {
    const blocks: ParsedBlock[] = [
      p("Anna: hej"),
      p("Anna: igen"),
      p("Anna: tre gånger"),
    ];
    const result = detectSpeakers(blocks);
    expect(result.names).toEqual([]);
  });
});
