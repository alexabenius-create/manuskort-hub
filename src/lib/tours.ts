// Definitionsdata för rundturerna. Varje steg pekar ut ett mål-element via
// data-tour-attribut och innehåller rubrik + brödtext för tooltipen.

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
        "Det här är ett färdigt manus du kan utforska, ändra och presentera. Se det som ett sandlåde-manus — ändra allt du vill, eller radera det när du är klar.",
    },
    {
      target: '[data-tour="library.new-button"]',
      title: "Skapa nytt manus",
      body:
        "Klicka här när du vill skapa ett tomt manus från grunden. Du kan också importera ett befintligt manus från PDF eller Word.",
      preferredPlacement: "left",
    },
  ],
};

export const MANUS_TOUR: TourDefinition = {
  id: "manus",
  flag: "manus_tour_completed",
  steps: [
    {
      target: '[data-tour="editor.display-settings"]',
      title: "Måltid, textstorlek och visning",
      body:
        "Ställ in manusets måltid (hur långt ska det vara), justera textstorleken för att förlänga eller korta ner, och bestäm om anteckningar och tider ska visas i redigeringsvyn.",
      preferredPlacement: "bottom",
    },
    {
      target: '[data-tour="editor.panelists"]',
      title: "Deltagare",
      body:
        "Lägg till de personer som ska tala i manuset. Varje deltagare får en färg, och du kan koppla dem till kort via talare-chipen på varje kort.",
      preferredPlacement: "bottom",
    },
    {
      target: '[data-tour="editor.add-print"]',
      title: "Nytt kort och utskrift",
      body:
        "Lägg till ett nytt tomt kort i slutet av manuset, eller skriv ut hela manuset på papper om du föredrar det framför skärmen under framträdandet.",
      preferredPlacement: "bottom",
    },
    {
      target: '[data-tour="editor.present"]',
      title: "Starta presentationsläget",
      body:
        "Klicka här när det är dags att framträda. Skärmen tar över helt, skärmen hålls vaken och du navigerar kort för kort med svep, tangentbord eller presentationsklickare.",
      preferredPlacement: "bottom",
    },
    // Kort-steg — alla på första kortet
    {
      target: '[data-tour="card.role"]',
      title: "Talare",
      body:
        "Tryck på chipen för att byta eller lägga till talare för det här kortet. Chipens färg följer deltagaren och syns även i presentationsläget.",
    },
    {
      target: '[data-tour="card.title"]',
      title: "Kortets rubrik",
      body:
        "En kort beskrivande rubrik som hjälper dig snabbt identifiera kortet — både i redigeringen och i presentationsläget. Tänk på det som en kapiteltitel.",
    },
    {
      target: '[data-tour="card.script"]',
      title: "Manustexten",
      body:
        "Här skriver du det du faktiskt ska säga. Tryck på snedstreck (/) i texten där du vill lägga in en medveten paus — markören syns tydligt i presentationsläget som en andningspåminnelse.",
    },
    {
      target: '[data-tour="card.notes"]',
      title: "Anteckningar",
      body:
        "Skriv egna påminnelser som bara du ser — tonläge, kroppsspråk, saker att komma ihåg. Anteckningarna syns i presentationsläget men aldrig i utskriften som delas med andra.",
      preferredPlacement: "left",
    },
    {
      target: '[data-tour="card.times"]',
      title: "Tider",
      body:
        "Sätt hur långt in i framträdandet det här kortet börjar och slutar. I presentationsläget syns en ring runt kortet som visar om du ligger i fas eller måste skynda på.",
    },
    {
      target: '[data-tour="card.cues"]',
      title: "Signaler",
      body:
        "Skriv korta regi-kommentarer i de tre fälten — t.ex. \"vänta på applåder\" eller \"signalera till tekniker\". I presentationsläget syns de som färgade prickar i kortets hörn; tappa pricken för att läsa signalen under framträdandet.",
    },
    {
      target: '[data-tour="card.menu"]',
      title: "Kortmenyn",
      body:
        "Via menyn kan du markera kortet som panik-kort, duplicera det, splitta långa kort i två, eller ta bort det helt.",
      preferredPlacement: "left",
    },
  ],
};

export const TOURS: Record<TourId, TourDefinition> = {
  bibliotek: BIBLIOTEK_TOUR,
  manus: MANUS_TOUR,
};
