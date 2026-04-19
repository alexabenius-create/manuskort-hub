import { describe, it, expect } from "vitest";
import {
  annotateQuestionsInHtml,
  stripQuestionsForTempIds,
  type KnownPanelist,
} from "@/lib/import/detectQuestions";

const panelists: KnownPanelist[] = [
  { tempId: "tmp:Anders", name: "Anders", color: "#A8D8B9" },
  { tempId: "tmp:Anna", name: "Anna", color: "#F6D976" },
  { tempId: "tmp:Bengt", name: "Bengt", color: "#A9C8F0" },
];

function countSpans(html: string): number {
  return (html.match(/data-question-to=/g) || []).length;
}

function spanContent(html: string, idx = 0): string {
  const matches = [...html.matchAll(/<span[^>]*data-question-to[^>]*>([^<]*)<\/span>/g)];
  return matches[idx]?.[1] || "";
}

describe("annotateQuestionsInHtml", () => {
  it("markerar direkt tilltal + frågesats: 'Anders, vad tycker du?'", () => {
    const html = "<p>Anders, vad tycker du om detta?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    expect(spanContent(out)).toContain("Anders");
    expect(spanContent(out)).toContain("?");
    // Färgkälla ska vara data-panelist-color (inte data-question-color)
    expect(out).toContain('data-panelist-color="#A8D8B9"');
    expect(out).not.toContain("data-question-color");
  });

  it("markerar tilltal som spänner över två meningar", () => {
    const html =
      "<p>Anders, låt oss zooma in på mobiliteten. Vad är den viktigaste förändringen vi sett det senaste decenniet?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    const content = spanContent(out);
    expect(content).toContain("Anders");
    expect(content).toContain("Vad är den viktigaste");
    expect(content).toMatch(/\?$/);
  });

  it("markerar anrop på slutet: 'Vad säger du, Anna?'", () => {
    const html = "<p>Vad säger du om detta, Anna?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    const content = spanContent(out);
    expect(content).toContain("Anna");
    expect(content).toContain(",");
    expect(content).toContain("?");
  });

  it("markerar överlämning: 'Då går vi över till Bengt.'", () => {
    const html = "<p>Då går vi över till Bengt.</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    expect(spanContent(out)).toBe("Bengt");
  });

  it("undviker falska positiva: 'Vad sa Anders i går?'", () => {
    const html = "<p>Vad sa Anders i går?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(0);
  });

  it("returnerar oförändrad html om inga panelister", () => {
    const html = "<p>Anders, vad tycker du?</p>";
    const out = annotateQuestionsInHtml(html, []);
    expect(out).toBe(html);
  });

  it("hoppar över redan-markerad text", () => {
    const html =
      '<p><span data-question-to="tmp:Anders" data-question-name="Anders" data-panelist-color="#A8D8B9">Anders, vad tycker du?</span></p>';
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
  });

  it("inkluderar hela meningen FÖRE namnet vid anrop på slutet", () => {
    const html = "<p>Vad tycker du om det här, Anna?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    const content = spanContent(out);
    expect(content).toContain("Vad tycker du om det här");
    expect(content).toContain("Anna");
    expect(content).toMatch(/\?$/);
  });

  it("börjar inte före föregående mening vid anrop på slutet", () => {
    const html = "<p>Det är ett stort ämne. Vad säger du, Anna?</p>";
    const out = annotateQuestionsInHtml(html, panelists);
    expect(countSpans(out)).toBe(1);
    const content = spanContent(out);
    expect(content).toContain("Vad säger du");
    expect(content).not.toContain("stort ämne");
  });
});

describe("stripQuestionsForTempIds", () => {
  it("unwrappar question-spans för givna tempIds", () => {
    const html =
      '<p><span data-question-to="tmp:Anders" data-question-name="Anders" data-panelist-color="#A8D8B9" class="question-to-mark">Anders, vad tycker du?</span></p>';
    const out = stripQuestionsForTempIds(html, new Set(["tmp:Anders"]));
    expect(out).not.toContain("data-question-to");
    expect(out).not.toContain("question-to-mark");
    expect(out).toContain("Anders, vad tycker du?");
  });

  it("lämnar spans för andra tempIds orörda", () => {
    const html =
      '<p><span data-question-to="tmp:Anna" data-question-name="Anna" data-panelist-color="#F6D976" class="question-to-mark">Anna?</span></p>';
    const out = stripQuestionsForTempIds(html, new Set(["tmp:Anders"]));
    expect(out).toContain("data-question-to");
  });
});
