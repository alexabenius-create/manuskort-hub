// Definitionsdata för rundturerna. Varje steg pekar ut ett mål-element via
// data-tour-attribut och innehåller rubrik + brödtext för tooltipen.
//
// Touren är medvetet kort (max 4 steg per vy). Detaljerad hjälp finns i
// HelpSheet (frågetecken-knappen i topbar) — se src/lib/helpContent.ts.

export type TourId = "bibliotek" | "manus";

export interface TourStep {
  /** CSS-selector — vi använder data-tour-attribut för stabilitet. */
  target: string;
  title: string;
  body: string;
  /** Föredragen placering om utrymme finns. */
  preferredPlacement?: "right" | "left" | "top" | "bottom";
}

export interface TourDefinition {
  id: TourId;
  /** DB-flagga som markeras som true när rundturen avslutas. */
  flag: "bibliotek_tour_completed" | "manus_tour_completed";
  steps: TourStep[];
}

export const BIBLIOTEK_TOUR: TourDefinition = {
  id: "bibliotek",
  flag: "bibliotek_tour_completed",
  steps: [
    {
      target: '[data-tour="library.example-card"]',
      title: "Exempelmanuset",
      body:
        "Här är ett färdigt manus du kan utforska och ändra. Klicka på det för att öppna och se hur kort, signaler och paneldeltagare fungerar.",
    },
    {
      target: '[data-tour="library.new-button"]',
      title: "Skapa eller importera",
      body:
        "Skapa ett tomt manus från grunden, eller importera ett befintligt Word-dokument med \"Importera\" bredvid.",
      preferredPlacement: "left",
    },
  ],
};

export const MANUS_TOUR: TourDefinition = {
  id: "manus",
  flag: "manus_tour_completed",
  steps: [
    {
      target: '[data-tour="card.script"]',
      title: "Skriv ditt manus",
      body:
        "Här skriver du det du faktiskt ska säga. Markera text för att formatera. Använd menyn för att lägga in en medveten paus.",
    },
    {
      target: '[data-tour="card.cues"]',
      title: "Lägg till signaler (cues)",
      body:
        "Färgade signaler som syns under framträdandet — paus, avslutningssignal, överlämning. Detta är vad som gör Manuskort unikt.",
    },
    {
      target: '[data-tour="card.menu"]',
      title: "Markera ett panik-kort",
      body:
        "I kortmenyn kan du markera ett kort som panik-kort. Under presentationen kommer du dit direkt med P-tangenten — en räddningsfras alltid inom räckhåll.",
      preferredPlacement: "left",
    },
    {
      target: '[data-tour="editor.present"]',
      title: "Starta presentationsläget",
      body:
        "När du är klar — tryck här för att gå in i helskärm. Skärmen hålls vaken, aviseringar tystas, och du navigerar kort för kort.",
      preferredPlacement: "bottom",
    },
  ],
};

export const TOURS: Record<TourId, TourDefinition> = {
  bibliotek: BIBLIOTEK_TOUR,
  manus: MANUS_TOUR,
};
