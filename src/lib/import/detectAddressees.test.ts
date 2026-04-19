import { describe, it, expect } from "vitest";
import { detectAddressees } from "@/lib/import/detectAddressees";
import type { ParsedBlock } from "@/lib/import/parseDocument";

const p = (text: string): ParsedBlock => ({
  type: "paragraph",
  html: `<p>${text}</p>`,
  plainText: text,
});

const list = (items: string[]): ParsedBlock => ({
  type: "list",
  ordered: false,
  itemsHtml: items.map((t) => `<strong>${t.split(",")[0]}</strong>${t.includes(",") ? "," + t.split(",").slice(1).join(",") : ""}`),
});

describe("detectAddressees", () => {
  it("hittar panelister från intro-punktlista (fulla namn)", () => {
    const blocks: ParsedBlock[] = [
      p("Jag har med mig tre personer som representerar olika perspektiv."),
      list([
        "Anna Sjöberg, kommunalråd med ansvar för stadsbyggnadsfrågor.",
        "Johan Lind, vd för fastighetsutvecklingsbolaget UrbanCore.",
        "Lisa Bergström, hållbarhetschef på GreenGrid.",
      ]),
      p("Anna, om vi börjar i ditt hörn. Är tempot tillräckligt högt?"),
    ];
    const r = detectAddressees(blocks);
    expect(r.names).toContain("Anna Sjöberg");
    expect(r.names).toContain("Johan Lind");
    expect(r.names).toContain("Lisa Bergström");
    expect(r.firstNameToCanonical.get("anna")).toBe("Anna Sjöberg");
  });

  it("hittar panelister enbart från adress-mönster i frågor", () => {
    const blocks: ParsedBlock[] = [
      p("Anna, vad tycker du om detta?"),
      p("Vad säger du, Johan?"),
      p("Lisa, din syn på frågan?"),
      p("Anna, hur ser du på det?"),
    ];
    const r = detectAddressees(blocks);
    expect(r.names).toEqual(expect.arrayContaining(["Anna", "Johan", "Lisa"]));
  });

  it("ignorerar enstaka namn (count < 2) utan intro-lista", () => {
    const blocks: ParsedBlock[] = [
      p("Anna, vad tycker du?"),
      p("En vanlig mening utan tilltal."),
    ];
    const r = detectAddressees(blocks);
    expect(r.names).toEqual([]);
  });

  it("ignorerar stoppord och rubrik-ord som adressater", () => {
    const blocks: ParsedBlock[] = [
      p("Och, det är så här."),
      p("Samtal, om vad då?"),
      p("Inledning, kort om bakgrunden."),
    ];
    const r = detectAddressees(blocks);
    expect(r.names).toEqual([]);
  });

  it("kombinerar intro-lista + frågor och bevarar fulla namn", () => {
    const blocks: ParsedBlock[] = [
      list([
        "Anna Sjöberg, kommunalråd.",
        "Johan Lind, vd.",
      ]),
      p("Anna, vad är din syn?"),
      p("Johan, hur ser ni på detta?"),
    ];
    const r = detectAddressees(blocks);
    expect(r.names).toEqual(["Anna Sjöberg", "Johan Lind"]);
  });
});
